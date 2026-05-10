import express from 'express';
import crypto from 'crypto';
import { supabase } from '../app.js';
import { calculatePaymentAmounts, generatePaymentReference } from '../services/payment.service.js';
import { getGhsToNgnRate } from '../app.js';

const router = express.Router();
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT || '20');
const EARLY_REFUND_PCT = parseFloat(process.env.EARLY_REFUND_PERCENT || '70');
const REFUND_HOST_GHOSTED = 95;      // Host never clicked link
const REFUND_HOST_NO_MARKDONE = 80;  // Host clicked but never marked done
const REFUND_HOST_REJECTED = 90;     // Host rejected themselves
const REFUND_DISPUTE_WATCHER = 85;   // Dispute ruled for watcher
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Window (ms) during which watcher can claim "host didn't contact me"
const NO_CONTACT_WINDOW_MS = 3 * 60 * 1000;
const EVIDENCE_WINDOW_MS = 20 * 60 * 1000;
const FOLLOWUP_WINDOW_MS = 10 * 60 * 1000;
const PAYSTACK_NG_SECRET = process.env.PAYSTACK_NG_SECRET_KEY || process.env.PAYSTACK_SECRET_KEY;

// ADD THIS:
const initializeAttempts = new Map();
function rateLimit(ip, max, windowMs) {
  const now = Date.now();
  const entry = initializeAttempts.get(ip) || { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + windowMs; }
  entry.count++;
  initializeAttempts.set(ip, entry);
  return entry.count > max;
}

// Get the right Paystack key based on payment currency
function getPaystackKey(payment) {
  return payment?.currency === 'NGN' ? PAYSTACK_NG_SECRET : PAYSTACK_SECRET;
}

// Issue a Paystack refund using the correct key for the payment's currency
async function issuePaystackRefund(payment, amountInSubunit) {
  const key = getPaystackKey(payment);
  const res = await fetch('https://api.paystack.co/refund', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction: payment.paystack_ref, amount: amountInSubunit }),
  });
  return res.json();
}

async function paystackRequest(method, path, body) {
  const res = await fetch(`https://api.paystack.co${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

// POST /api/pay/initialize
router.post('/initialize', async (req, res) => {
  try {
    if (rateLimit(req.ip, 5, 60 * 60 * 1000)) {
  return res.status(429).json({ error: 'Too many payment attempts. Please wait an hour.' });
}
    const { hostId, watcherId, watcherName, watcherContact, watcherPlatform } = req.body;

    if (!hostId || !watcherName || !watcherContact) {
      return res.status(400).json({ error: 'hostId, watcherName, and watcherContact are required' });
    }

    const cleanContact = watcherContact.replace(/\D/g, '');
    if (cleanContact.length !== 10 && cleanContact.length !== 11) {
      return res.status(400).json({ error: 'Contact number must be 10 digits (Ghana) or 11 digits (Nigeria)' });
    }

    const { data: host, error: hostErr } = await supabase
      .from('users')
      .select('id, name, rate, platform, contact_number, paystack_recipient_code')
      .eq('id', hostId)
      .single();

    if (hostErr || !host) return res.status(404).json({ error: 'Host not found' });

    const amounts = calculatePaymentAmounts(host.rate);

    const safeName = watcherName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15) || 'user';
    const watcherEmail = `${safeName}_${Date.now().toString().slice(-6)}@connectcallpay.com`;
    const reference = generatePaymentReference();

    // Detect currency from host's country
    const { data: hostForCurrency } = await supabase.from('users').select('country').eq('id', hostId).single();
    const currency = hostForCurrency?.country === 'Nigeria' ? 'NGN' : 'GHS';

    const { error: insertErr } = await supabase.from('payments').insert([{
      target_user_id: hostId,
      watcher_id: watcherId || null,
      watcher_name: watcherName,
      watcher_contact: watcherContact,
      watcher_platform: watcherPlatform || 'WhatsApp',
      watcher_email: watcherEmail,
      amount: amounts.hostRate,
      platform_fee: amounts.platformFee,
      total_charged: amounts.totalAmount,
      status: 'pending_init',
      paystack_ref: reference,
      payout_status: 'pending',
      payout_attempts: 0,
      currency,
    }]);

    if (insertErr) {
      return res.status(500).json({ error: 'Failed to create payment record' });
    }

    const psRes = await paystackRequest('POST', '/transaction/initialize', {
      email: watcherEmail,
      amount: amounts.amountPesewas,
      reference,
      currency,
      metadata: { hostId, watcherId, reference, hostName: host.name },
      callback_url: `${FRONTEND_URL}/payment-callback?ref=${reference}`,
    });

    if (!psRes.status) {
      return res.status(500).json({ error: psRes.message || 'Paystack error' });
    }

    console.log(`[Init] Payment created — ref: ${reference}, total: GHS ${amounts.totalAmount}`);

    try {
      const { notifyHostNewBooking } = await import('../services/notification.service.js');
      if (host.contact_number) {
        await notifyHostNewBooking(host.contact_number, watcherName, watcherPlatform || 'WhatsApp');
      }
    } catch (notifyErr) {
      console.error('[Init] Notification failed (non-fatal):', notifyErr.message);
    }

    return res.json({
      authorizationUrl: psRes.data.authorization_url,
      reference,
      hostRate: amounts.hostRate,
      platformFee: amounts.platformFee,
      totalAmount: amounts.totalAmount,
    });

  } catch (err) {
    console.error('[Init] Exception:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/pay/verify/:reference
router.get('/verify/:reference', async (req, res) => {
  try {
    const { reference } = req.params;

    const { data: existing } = await supabase
      .from('payments')
      .select('*')
      .eq('paystack_ref', reference)
      .single();

    if (!existing) return res.status(404).json({ error: 'Payment reference not found' });

    if (['pending', 'confirmed', 'completed'].includes(existing.status)) {
      return res.json({ success: true, payment: existing, alreadyVerified: true });
    }

    const psRes = await paystackRequest('GET', `/transaction/verify/${reference}`);

    if (!psRes.status || psRes.data.status !== 'success') {
      await supabase.from('payments').update({ status: 'failed' }).eq('paystack_ref', reference);
      return res.status(400).json({ error: 'Payment verification failed' });
    }

    const expectedPesewas = Math.round(parseFloat(existing.total_charged) * 100);
    const receivedPesewas = psRes.data.amount;

    if (receivedPesewas < expectedPesewas) {
      await supabase.from('payments').update({ status: 'amount_mismatch' }).eq('paystack_ref', reference);
      return res.status(400).json({ error: 'Amount mismatch detected' });
    }

    const { data: host } = await supabase
      .from('users')
      .select('contact_number, platform')
      .eq('id', existing.target_user_id)
      .single();

    // Record when contact was revealed so the 3-min window can be calculated client-side
    const contactRevealedAt = new Date().toISOString();

    const { data: updated } = await supabase
      .from('payments')
      .update({
        status: 'confirmed',
        paystack_verified: true,
        paystack_channel: psRes.data.channel,
        verified_at: new Date().toISOString(),
        confirmed_at: contactRevealedAt,
        host_contact_revealed: host?.contact_number || null,
        host_platform_revealed: host?.platform || null,
        contact_revealed_at: contactRevealedAt,
      })
      .eq('paystack_ref', reference)
      .select()
      .single();

    console.log(`[Verify] Payment verified — ref: ${reference}`);
    return res.json({ success: true, payment: updated });

  } catch (err) {
    console.error('[Verify] Exception:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/pay/watcher/refund
// Handles four cases:
//   1. status=pending (not confirmed)           → 70% auto-refund
//   2. no_contact within 3-min, host NOT marked done → 70% auto-refund (existing logic)
//   3. no_contact within 3-min, host ALREADY marked done → Open dispute with evidence window
//   4. dispute after host marks done             → admin review
router.post('/watcher/refund', async (req, res) => {
  try {
    const { paymentId, reason, watcherId } = req.body;
    if (!paymentId) return res.status(400).json({ error: 'paymentId is required' });

   const { data: pay } = await supabase.from('payments').select('*').eq('id', paymentId).single();
    if (!pay) return res.status(404).json({ error: 'Payment not found' });

    // Verify watcher owns this payment
    if (watcherId && pay.watcher_id && pay.watcher_id !== watcherId) {
      return res.status(403).json({ error: 'Unauthorized — this is not your payment' });
    }

    // Check for duplicate pending refund
    const { data: existingRefund } = await supabase
      .from('refund_requests')
      .select('id, status')
      .eq('payment_id', paymentId)
      .in('status', ['pending', 'pending_host', 'approved'])
      .single();

    if (existingRefund) {
      return res.status(400).json({ error: 'A refund request already exists for this payment' });
    }

    const isNoContactClaim = reason && reason.toLowerCase().includes('did not reach out');
    const isDispute = reason && (
      reason.toLowerCase().includes('dispute') ||
      reason.toLowerCase().includes('call did not')
    );

    // ── Case 1: Payment not yet confirmed → 70% early cancel ──
    if (pay.status === 'pending' && !pay.confirmed_at) {
      return await handleEarlyCancel(pay, reason, watcherId, res);
    }

    // ── Case 2 & 3: Contact revealed + "host didn't contact me" claim ──
    if (pay.status === 'confirmed' && isNoContactClaim) {
      const revealedAt = pay.contact_revealed_at 
  ? new Date(pay.contact_revealed_at) 
  : pay.confirmed_at 
    ? new Date(pay.confirmed_at) 
    : null;
const now = new Date();

if (!revealedAt) {
  return res.status(400).json({ error: 'Cannot determine contact reveal time. Please contact support.' });
}

      const msSinceReveal = now - revealedAt;
      if (msSinceReveal > NO_CONTACT_WINDOW_MS) {
        return res.status(400).json({
          error: `The 3-minute window to claim no contact has passed (${Math.round(msSinceReveal / 1000)}s ago). Payment is queued for the host.`,
          windowExpired: true,
        });
      }

      // Check if host has already marked the call as done
      return await handleNoContactWithDisputeCheck(pay, reason, watcherId, res);
    }

    // ── Case 4: Watcher disputes after host marks call done ──
    if (isDispute) {
      const { data: conf } = await supabase
        .from('call_confirmations')
        .select('id, status')
        .eq('payment_id', paymentId)
        .single();

      if (!conf || conf.status !== 'pending') {
        return res.status(400).json({ error: 'No pending call confirmation to dispute' });
      }

      // Mark confirmation as denied
      await supabase.from('call_confirmations').update({
        status: 'denied',
        responded_at: new Date().toISOString(),
      }).eq('id', conf.id);

      // Create dispute refund request for admin review
      const { data: refundReq } = await supabase.from('refund_requests').insert([{
        payment_id: paymentId,
        reason: reason || 'Watcher disputed call completion',
        status: 'pending',
        watcher_id: watcherId || pay.watcher_id,
        watcher_name: pay.watcher_name,
        refund_type: 'dispute',
      }]).select().single();

      // Move payment to a "disputed" holding state
      await supabase.from('payments').update({ status: 'disputed' }).eq('id', paymentId);

      return res.json({
        success: true,
        autoRefunded: false,
        message: 'Dispute filed — admin will review and issue a decision.',
        refundId: refundReq?.id,
      });
    }

    // ── Fallback: generic pending refund ──
    if (pay.status === 'confirmed' || pay.status === 'completed') {
      const { data: refundReq } = await supabase.from('refund_requests').insert([{
        payment_id: paymentId,
        reason: reason || 'Call did not take place',
        status: 'pending',
        watcher_id: watcherId || pay.watcher_id,
        watcher_name: pay.watcher_name,
        refund_type: 'manual',
      }]).select().single();

      return res.json({
        success: true,
        autoRefunded: false,
        message: 'Refund request submitted — admin will review.',
        refundId: refundReq?.id,
      });
    }

    return res.status(400).json({ error: `Cannot refund — payment status is "${pay.status}"` });

  } catch (err) {
    console.error('[Refund] Exception:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Helper: 70% early cancel (before contact revealed) ──
async function handleEarlyCancel(pay, reason, watcherId, res) {
  const totalPaid = parseFloat(pay.total_charged || pay.amount);
  const refundAmount = parseFloat((totalPaid * EARLY_REFUND_PCT / 100).toFixed(2));

  let paystackRefundSuccess = false;
  if (pay.paystack_ref) {
    try {
      const refundRes = await issuePaystackRefund(pay, Math.round(refundAmount * 100));
      paystackRefundSuccess = refundRes.status;
      if (!paystackRefundSuccess) {
        console.error('[EarlyCancel] Paystack refund failed:', refundRes.message);
      }
    } catch (e) {
      console.error('[EarlyCancel] Paystack error:', e.message);
    }
  }

  await supabase.from('payments').update({ status: 'refunded_partial' }).eq('id', pay.id);
  await supabase.from('refund_requests').insert([{
    payment_id: pay.id,
    reason: reason || 'Early cancellation before contact revealed',
    status: 'approved',
    watcher_id: watcherId || pay.watcher_id,
    watcher_name: pay.watcher_name,
    refund_amount: refundAmount,
    refund_type: 'auto_70_percent',
    resolved_at: new Date().toISOString(),
    auto_refunded: true,
    refund_percentage: EARLY_REFUND_PCT,
  }]);

  // Notify host that booking was cancelled
  try {
    const { notifyHostBookingCancelled } = await import('../services/notification.service.js');
    const { data: host } = await supabase.from('users').select('contact_number').eq('id', pay.target_user_id).single();
    if (host?.contact_number) {
      await notifyHostBookingCancelled(host.contact_number, pay.watcher_name);
    }
  } catch (e) {
    console.error('[EarlyCancel] Notify failed (non-fatal):', e.message);
  }

  console.log(`[EarlyCancel] 70% refund: GHS ${refundAmount}`);
  return res.json({
    success: true,
    autoRefunded: true,
    refundAmount,
    message: `Booking cancelled. GHS ${refundAmount} (70%) has been refunded to you.`,
  });
}

// ── NEW: Check if host marked done BEFORE processing no-contact claim ──
async function handleNoContactWithDisputeCheck(pay, reason, watcherId, res) {
  // NEW: If host clicked the call link, block refund — watcher must use dispute
  if (pay.call_initiated_at) {
    return res.status(400).json({
      error: 'Host has already initiated the call. Please use the Dispute option instead if the call did not happen.',
      hostInitiated: true,
      useDispute: true,
    });
  }

  // Check if host has already marked the call as done
  const { data: callConfirmation } = await supabase
    .from('call_confirmations')
    .select('id, status, created_at')
    .eq('payment_id', pay.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const hostMarkedDone = callConfirmation && callConfirmation.status === 'confirmed';

  if (hostMarkedDone) {
    return await openDisputeWithEvidence(pay, reason, watcherId, callConfirmation, res);
  } else {
    return await handleNoContactClaim(pay, reason, watcherId, res);
  }
}

// ── NEW: Open a dispute thread when host marked done but watcher says no call ──
async function openDisputeWithEvidence(pay, reason, watcherId, callConfirmation, res) {
  const now = new Date();
  const hostEvidenceDeadline = new Date(now.getTime() + EVIDENCE_WINDOW_MS);

  // Create refund request (pending, not auto-approved)
  const { data: refundReq } = await supabase.from('refund_requests').insert([{
    payment_id: pay.id,
    reason: reason || 'Host marked call done but watcher claims no contact',
    status: 'pending',
    watcher_id: watcherId || pay.watcher_id,
    watcher_name: pay.watcher_name,
    refund_type: 'dispute_evidence',
    auto_refunded: false,
  }]).select().single();

  // Create dispute record
  const { data: dispute } = await supabase.from('disputes').insert([{
  payment_id: pay.id,
  refund_request_id: refundReq?.id,
  status: 'open',
  opened_by: 'watcher',
  opened_reason: reason || 'Watcher claims host did not call despite marking done',
  host_evidence_deadline: hostEvidenceDeadline.toISOString(), // ← add this line
}]).select().single();

  // Link dispute to refund request
  if (refundReq?.id && dispute?.id) {
    await supabase.from('refund_requests')
      .update({ dispute_id: dispute.id })
      .eq('id', refundReq.id);
  }

  // Add system message to dispute chat
  await supabase.from('dispute_messages').insert([{
    dispute_id: dispute.id,
    sender_role: 'system',
    message: `Dispute opened. Host has 20 minutes to submit evidence (screenshot of call log showing call to ${pay.watcher_contact}). If host fails to submit evidence, refund will be processed automatically.`,
  }]);

  // Freeze payment — don't release to host
  await supabase.from('payments').update({ status: 'disputed' }).eq('id', pay.id);

  // Notify host about the dispute
  try {
    const { data: host } = await supabase
      .from('users')
      .select('contact_number, name')
      .eq('id', pay.target_user_id)
      .single();

    if (host?.contact_number) {
      const { notifyHostDisputeOpened } = await import('../services/notification.service.js');
      await notifyHostDisputeOpened(host.contact_number, pay.watcher_name, hostEvidenceDeadline);
    }
  } catch (e) {
    console.error('[Dispute] Notify host failed (non-fatal):', e.message);
  }

  console.log(`[Dispute] Opened — payment ${pay.id}, host marked done, watcher disputes`);

  return res.json({
    success: true,
    autoRefunded: false,
    disputeOpened: true,
    disputeId: dispute.id,
    message: 'Host marked the call as done. A dispute has been opened. The host has 20 minutes to submit evidence of the call.',
    hostEvidenceDeadline: hostEvidenceDeadline.toISOString(),
  });
}

// ── Existing: "Host didn't contact me" within 3-min window (host never marked done) ──
async function handleNoContactClaim(pay, reason, watcherId, res) {
  const totalPaid = parseFloat(pay.total_charged || pay.amount);
  const refundAmount = parseFloat((totalPaid * REFUND_HOST_GHOSTED / 100).toFixed(2));

  let paystackRefundSuccess = false;
  if (pay.paystack_ref) {
    try {
      const refundRes = await issuePaystackRefund(pay, Math.round(refundAmount * 100));
      paystackRefundSuccess = refundRes.status;
    } catch (e) {
      console.error('[NoContact] Paystack error:', e.message);
    }
  }

  await supabase.from('payments').update({ status: 'refunded_partial' }).eq('id', pay.id);
  await supabase.from('refund_requests').insert([{
    payment_id: pay.id,
    reason: reason || 'Host did not reach out within 3-minute window',
    status: 'approved',
    watcher_id: watcherId || pay.watcher_id,
    watcher_name: pay.watcher_name,
    refund_amount: refundAmount,
    refund_type: 'no_contact_window',
    resolved_at: new Date().toISOString(),
    auto_refunded: true,
    refund_percentage: EARLY_REFUND_PCT,
  }]);

  // Notify host their booking was cancelled
  try {
    const { notifyHostBookingCancelled } = await import('../services/notification.service.js');
    const { data: host } = await supabase.from('users').select('contact_number, name').eq('id', pay.target_user_id).single();
    if (host?.contact_number) {
      await notifyHostBookingCancelled(host.contact_number, pay.watcher_name);
    }
  } catch (e) {
    console.error('[NoContact] Notify failed (non-fatal):', e.message);
  }

  console.log(`[NoContact] Booking cancelled within window, 70% refund: GHS ${refundAmount}`);
  return res.json({
    success: true,
    autoRefunded: true,
    refundAmount,
    cancelled: true,
    message: `Booking cancelled — host did not contact you in time. GHS ${refundAmount} (70%) refunded.`,
  });
}

// ─────────────────────────────────────────────────────
// NEW ROUTES: Dispute evidence & follow-up
// ─────────────────────────────────────────────────────

// POST /api/pay/dispute/submit-evidence
// Host or watcher uploads screenshot evidence
router.post('/dispute/submit-evidence', async (req, res) => {
  try {
    const { disputeId, userId, role, evidenceUrl } = req.body;

    if (!disputeId || !userId || !role || !evidenceUrl) {
      return res.status(400).json({ error: 'disputeId, userId, role, and evidenceUrl are required' });
    }

    if (!['host', 'watcher'].includes(role)) {
      return res.status(400).json({ error: 'role must be "host" or "watcher"' });
    }

    const { data: dispute } = await supabase
      .from('disputes')
      .select('*')
      .eq('id', disputeId)
      .single();

    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });
    if (dispute.status === 'resolved_host' || dispute.status === 'resolved_watcher') {
      return res.status(400).json({ error: 'Dispute already resolved' });
    }

    const { data: payment } = await supabase
  .from('payments')
  .select('target_user_id, watcher_id')
  .eq('id', dispute.payment_id)
  .single();

if (role === 'host' && payment.target_user_id !== userId) {
  return res.status(403).json({ error: 'Unauthorized' });
}
if (role === 'watcher' && payment.watcher_id !== userId) {
  return res.status(403).json({ error: 'Unauthorized' });
}

    const now = new Date().toISOString();

    if (role === 'host') {
      // Prevent duplicate host evidence
      if (dispute.host_evidence_url) {
        return res.status(400).json({ error: 'Host evidence already submitted' });
      }

      // 3-attempt limit
      const hostAttempts = dispute.host_evidence_attempts || 0;
      if (hostAttempts >= 3) {
        return res.status(400).json({ error: 'Maximum evidence upload attempts reached (3). Contact admin.' });
      }

      // Duplicate screenshot detection — check if this URL was used in another dispute
      const { data: duplicateCheck } = await supabase
        .from('disputes')
        .select('id')
        .eq('host_evidence_url', evidenceUrl)
        .neq('id', disputeId)
        .limit(1)
        .single();
      if (duplicateCheck) {
        await supabase.from('disputes').update({
          host_evidence_attempts: hostAttempts + 1,
        }).eq('id', disputeId);
        return res.status(400).json({ error: 'This screenshot has already been used in another dispute. Upload a fresh screenshot.' });
      }

     await supabase.from('disputes').update({
        host_evidence_url: evidenceUrl,
        host_evidence_submitted_at: now,
        host_evidence_attempts: (dispute.host_evidence_attempts || 0) + 1,
        status: 'watcher_evidence',
      }).eq('id', disputeId);

      // System message
      await supabase.from('dispute_messages').insert([{
        dispute_id: disputeId,
        sender_role: 'system',
        message: `Host submitted evidence. Watcher now has 20 minutes to submit counter-evidence (screenshot showing NO call from host's number during the booked window).`,
      }]);

      // Notify watcher
      try {
        const { data: payment } = await supabase.from('payments').select('watcher_contact, watcher_id').eq('id', dispute.payment_id).single();
        if (payment?.watcher_contact) {
          const { notifyWatcherCounterEvidence } = await import('../services/notification.service.js');
          await notifyWatcherCounterEvidence(payment.watcher_contact);
        }
      } catch (e) {
        console.error('[Evidence] Notify watcher failed:', e.message);
      }

      return res.json({
        success: true,
        message: 'Evidence submitted. Watcher has 20 minutes to respond.',
        nextStep: 'watcher_evidence',
      });
    }

    if (role === 'watcher') {
      // Prevent duplicate watcher evidence
      if (dispute.watcher_evidence_url) {
        return res.status(400).json({ error: 'Watcher evidence already submitted' });
      }

      // 3-attempt limit
      const watcherAttempts = dispute.watcher_evidence_attempts || 0;
      if (watcherAttempts >= 3) {
        return res.status(400).json({ error: 'Maximum evidence upload attempts reached (3). Contact admin.' });
      }

      // Duplicate screenshot detection
      const { data: duplicateCheck } = await supabase
        .from('disputes')
        .select('id')
        .eq('watcher_evidence_url', evidenceUrl)
        .neq('id', disputeId)
        .limit(1)
        .single();
      if (duplicateCheck) {
        await supabase.from('disputes').update({
          watcher_evidence_attempts: watcherAttempts + 1,
        }).eq('id', disputeId);
        return res.status(400).json({ error: 'This screenshot has already been used in another dispute. Upload a fresh screenshot.' });
      }

      await supabase.from('disputes').update({
        watcher_evidence_url: evidenceUrl,
        watcher_evidence_submitted_at: now,
        watcher_evidence_attempts: (dispute.watcher_evidence_attempts || 0) + 1,
        status: 'ai_verdict_pending',
      }).eq('id', disputeId);

      // System message
      await supabase.from('dispute_messages').insert([{
        dispute_id: disputeId,
        sender_role: 'system',
        message: 'Watcher submitted counter-evidence. AI analysis will now review both screenshots.',
      }]);

// Notify both that AI is reviewing
      try {
        const { data: payment } = await supabase.from('payments').select('target_user_id, watcher_contact').eq('id', dispute.payment_id).single();
        const { data: host } = await supabase.from('users').select('contact_number').eq('id', payment.target_user_id).single();
        if (host?.contact_number && payment?.watcher_contact) {
          const { notifyBothAIReviewing } = await import('../services/notification.service.js');
          await notifyBothAIReviewing(host.contact_number, payment.watcher_contact);
        }
      } catch (e) {
        console.error('[AI] Notify reviewing failed:', e.message);
      }

      // Trigger AI verdict (async — we respond immediately)
      triggerAIVerdict(disputeId).catch(e => {
        console.error('[AI Verdict] Async trigger failed:', e.message);
      });

      return res.json({
        success: true,
        message: 'Counter-evidence submitted. AI review in progress.',
        nextStep: 'ai_verdict',
      });
    }

  } catch (err) {
    console.error('[SubmitEvidence] Exception:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/pay/dispute/ai-verdict (can also be called by admin manually)
router.post('/dispute/ai-verdict', async (req, res) => {
  try {
    const { disputeId } = req.body;
    if (!disputeId) return res.status(400).json({ error: 'disputeId is required' });

    const result = await triggerAIVerdict(disputeId);
    return res.json(result);
  } catch (err) {
    console.error('[AIVerdict] Exception:', err);
    res.status(500).json({ error: 'AI verdict failed', details: err.message });
  }
});

// GET /api/pay/dispute/:id — fetch dispute details for UI
router.get('/dispute/:id', async (req, res) => {
  try {
    const { data: dispute } = await supabase
      .from('disputes')
      .select('*, dispute_messages(*)')
      .eq('id', req.params.id)
      .single();

    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });

    return res.json({ dispute });
  } catch (err) {
    console.error('[GetDispute] Exception:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── AI Verdict Engine ──
async function triggerAIVerdict(disputeId) {
  const { data: dispute } = await supabase
    .from('disputes')
    .select('*')
    .eq('id', disputeId)
    .single();

  if (!dispute) throw new Error('Dispute not found');
  if (!dispute.host_evidence_url || !dispute.watcher_evidence_url) {
    throw new Error('Both parties must submit evidence before AI review');
  }

  // TODO: Integrate Claude Vision API or GPT-4V here
  // For now, use a placeholder that flags for admin review
  const aiResult = await analyzeEvidenceWithAI(
    dispute.host_evidence_url,
    dispute.watcher_evidence_url
  );

  const now = new Date().toISOString();

  await supabase.from('disputes').update({
    ai_verdict: aiResult.verdict,
    ai_confidence: aiResult.confidence,
    ai_analysis: aiResult.analysis,
    status: aiResult.confidence >= 85 ? 
      (aiResult.verdict === 'host' ? 'resolved_host' : 'resolved_watcher') : 
      'escalated_admin',
    resolved_at: aiResult.confidence >= 85 ? now : null,
    resolved_by: aiResult.confidence >= 85 ? 'ai' : null,
  }).eq('id', disputeId);

  // System message
  const verdictMessage = aiResult.confidence >= 85
    ? `AI verdict: Ruled in favor of ${aiResult.verdict === 'host' ? 'HOST' : 'WATCHER'} (${aiResult.confidence}% confidence). ${aiResult.analysis}`
    : `AI could not reach a confident verdict (${aiResult.confidence}% confidence). Escalated to admin for manual review.`;

  await supabase.from('dispute_messages').insert([{
    dispute_id: disputeId,
    sender_role: 'system',
    message: verdictMessage,
  }]);

  // Notify both parties
  try {
    const { data: payment } = await supabase.from('payments').select('target_user_id, watcher_contact').eq('id', dispute.payment_id).single();
    const { data: host } = await supabase.from('users').select('contact_number').eq('id', payment.target_user_id).single();
    if (host?.contact_number && payment?.watcher_contact) {
      if (aiResult.confidence >= 85) {
        const { notifyBothAIVerdict } = await import('../services/notification.service.js');
        await notifyBothAIVerdict(host.contact_number, payment.watcher_contact, aiResult.verdict, aiResult.confidence);
      } else {
        const { notifyBothEscalated } = await import('../services/notification.service.js');
        await notifyBothEscalated(host.contact_number, payment.watcher_contact);
      }
    }
  } catch (e) {
    console.error('[AI] Notify verdict failed:', e.message);
  }

  // If auto-resolved, process the outcome
  if (aiResult.confidence >= 85) {
    await resolveDisputeOutcome(disputeId, aiResult.verdict);
  }

  return { verdict: aiResult.verdict, confidence: aiResult.confidence, autoResolved: aiResult.confidence >= 85 };
}

async function fetchImageAsBase64(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer).toString('base64');
}

function getImageMediaType(url) {
  const ext = url.split('?')[0].split('.').pop().toLowerCase();
  const types = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  };
  return types[ext] || 'image/jpeg';
}

// ── Placeholder AI analysis — replace with actual Claude/GPT Vision call ──
// ── Real Claude Vision AI analysis ──
async function analyzeEvidenceWithAI(hostEvidenceUrl, watcherEvidenceUrl) {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

  if (!OPENROUTER_API_KEY) {
    console.warn('[AI] No OPENROUTER_API_KEY set — falling back to placeholder');
    return {
      verdict: 'inconclusive',
      confidence: 50,
      analysis: 'AI not configured. Both screenshots received — manual admin review required.',
    };
  }

  try {
    const hostImageBase64 = await fetchImageAsBase64(hostEvidenceUrl);
    const watcherImageBase64 = await fetchImageAsBase64(watcherEvidenceUrl);
    const hostMediaType = getImageMediaType(hostEvidenceUrl);
    const watcherMediaType = getImageMediaType(watcherEvidenceUrl);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://connectcall.vercel.app',
        'X-Title': 'ConnectCall Dispute AI',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `You are an impartial dispute arbitrator for ConnectCall, a platform where watchers pay hosts for phone/video consultations in Ghana.

A dispute has been filed. The WATCHER claims the call did not happen or was too short.

You are shown TWO screenshots of call logs from either WhatsApp or Telegram.

WHAT TO LOOK FOR — WhatsApp Call Log:
- Phone icon at the top
- Contact name or number in BOLD
- "Outgoing voice call" or "Incoming voice call" label
- Call duration (e.g., "5:23")
- Date and time
- WhatsApp green header bar

TELEGRAM:
- Contact name at top
- Outgoing/Incoming voice call label
- Call duration
- Date and time
- Telegram dark or blue theme

SIGNS OF FAKE OR INVALID SCREENSHOT:
- Inconsistent fonts or misaligned UI elements
- Blurry areas around duration or timestamp
- Odd timestamps or wrong app colors
- CROPPED screenshot — must show full screen including status bar (time, battery, signal) at top
- Screenshot shows only part of the call log — full context required
- Duration or contact name appears cut off or partially hidden
- Background looks edited or artificially extended
- Screenshot dimensions look unusual (too narrow, too square)
- No visible status bar at top of screen

JUDGMENT RULES:
1. HOST screenshot should show OUTGOING call to watcher's number
2. WATCHER screenshot should show NO incoming call from host
3. Call duration must be AT LEAST 2 MINUTES for host to win
4. Duration < 2 minutes → verdict = "watcher"
5. Edited or cropped screenshot → verdict = "watcher"
6. No status bar visible at top of screenshot → verdict = "watcher" (likely cropped)
7. Screenshot appears to show only a portion of the screen → verdict = "watcher"
8. If you cannot clearly read the full call duration → verdict = "watcher"
9. Screenshot appears digitally altered (inconsistent pixel density, smeared text, clone-stamped areas) → verdict = "watcher"
10. Call duration shows as exactly 0:00 or is missing entirely → verdict = "watcher"
11. If the call log shows "Missed call" or "Cancelled call" → verdict = "watcher"
12. If screenshot shows a call list but none of the numbers match the watcher's number pattern → verdict = "watcher"

Return ONLY a JSON object (no other text):
{
  "verdict": "host" | "watcher" | "inconclusive",
  "confidence": 0-100,
  "analysis": "Brief 2-3 sentence explanation."
}`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${hostMediaType};base64,${hostImageBase64}`,
                },
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${watcherMediaType};base64,${watcherImageBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 512,
        temperature: 0.1,
      }),
    });

    const data = await response.json();

    if (!data.choices?.[0]?.message?.content) {
      console.error('[AI] Unexpected OpenRouter response:', JSON.stringify(data).substring(0, 500));
      return { verdict: 'inconclusive', confidence: 50, analysis: 'AI failed to analyze screenshots.' };
    }

    const text = data.choices[0].message.content.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[AI] Could not parse JSON from OpenRouter response:', text.substring(0, 300));
      return { verdict: 'inconclusive', confidence: 50, analysis: 'AI response could not be parsed.' };
    }

    const result = JSON.parse(jsonMatch[0]);
    if (!['host', 'watcher', 'inconclusive'].includes(result.verdict)) {
      result.verdict = 'inconclusive';
    }
    result.confidence = Math.max(0, Math.min(100, Math.round(result.confidence || 50)));
    result.analysis = result.analysis || 'No analysis provided.';

    console.log(`[AI] OpenRouter verdict: ${result.verdict}, Confidence: ${result.confidence}%`);
    return result;

  } catch (err) {
    console.error('[AI] OpenRouter API error:', err.message);
    return {
      verdict: 'inconclusive',
      confidence: 50,
      analysis: `AI analysis failed: ${err.message}. Manual admin review required.`,
    };
  }
}

// ── Resolve dispute outcome ──
async function resolveDisputeOutcome(disputeId, verdict) {
  const { data: dispute } = await supabase
    .from('disputes')
    .select('*, payment:payment_id(*)')
    .eq('id', disputeId)
    .single();

  if (!dispute) return;

  // Don't re-process already resolved disputes
  if (dispute.status === 'resolved_host' || dispute.status === 'resolved_watcher') {
    console.log(`[ResolveDispute] Dispute ${disputeId} already resolved — skipping`);
    return;
  }

  const payment = dispute.payment;
  const totalPaid = parseFloat(payment.total_charged || payment.amount);
  const refundAmount = parseFloat((totalPaid * REFUND_DISPUTE_WATCHER / 100).toFixed(2));
  const now = new Date().toISOString();

  if (verdict === 'watcher') {
    if (payment.paystack_ref) {
      try {
        await issuePaystackRefund(payment, Math.round(refundAmount * 100));
      } catch (e) {
        console.error('[ResolveDispute] Refund failed:', e.message);
      }
    }

    await supabase.from('payments').update({ status: 'refunded_partial' }).eq('id', payment.id);
    await supabase.from('refund_requests').update({
      status: 'approved',
      refund_amount: refundAmount,
      resolved_at: now,
      auto_refunded: true,
      refund_percentage: REFUND_DISPUTE_WATCHER,
    }).eq('dispute_id', disputeId);

    // UPDATE THE DISPUTE STATUS
    await supabase.from('disputes').update({
      status: 'resolved_watcher',
      resolved_at: now,
      resolved_by: 'auto_timeout',
    }).eq('id', disputeId);

  } else if (verdict === 'host') {
    await supabase.from('payments').update({ status: 'completed' }).eq('id', payment.id);
    await supabase.from('refund_requests').update({
      status: 'rejected',
      resolved_at: now,
    }).eq('dispute_id', disputeId);

    // UPDATE THE DISPUTE STATUS
    await supabase.from('disputes').update({
      status: 'resolved_host',
      resolved_at: now,
      resolved_by: 'auto_timeout',
    }).eq('id', disputeId);

    try {
      const { processHostPayout } = await import('../services/payment.service.js');
      await processHostPayout(payment);
    } catch (e) {
      console.error('[ResolveDispute] Payout failed:', e.message);
    }
  }
}

// ─────────────────────────────────────────────────────
// FOLLOW-UP REQUESTS (when host misses the window)
// ─────────────────────────────────────────────────────

// POST /api/pay/call/request-followup — Host requests retry after cancellation
router.post('/call/request-followup', async (req, res) => {
  try {
    const { paymentId, hostId } = req.body;
    if (!paymentId || !hostId) return res.status(400).json({ error: 'paymentId and hostId are required' });

    const { data: payment } = await supabase.from('payments').select('*').eq('id', paymentId).single();
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    // Only allow follow-up if payment was refunded/cancelled due to no-contact
    if (payment.status !== 'refunded_partial') {
      return res.status(400).json({ error: 'Follow-up only available for cancelled bookings' });
    }

    // Check for existing follow-up
    const { data: allFollowups } = await supabase
  .from('followup_requests')
  .select('id, status')
  .eq('payment_id', paymentId)
  .order('requested_at', { ascending: false });

const MAX_FOLLOWUPS = 2;
if ((allFollowups?.length || 0) >= MAX_FOLLOWUPS) {
  return res.status(400).json({ error: `Follow-up limit reached — maximum ${MAX_FOLLOWUPS} attempts allowed per booking` });
}

const latestFollowup = allFollowups?.[0];
if (latestFollowup && ['pending', 'accepted'].includes(latestFollowup.status)) {
  return res.status(400).json({ error: 'A follow-up request is already active' });
}

    const now = new Date();
    const expiresAt = new Date(now.getTime() + FOLLOWUP_WINDOW_MS); // 10 min

    const { data: followup } = await supabase.from('followup_requests').insert([{
      payment_id: paymentId,
      host_id: hostId,
      watcher_id: payment.watcher_id,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
    }]).select().single();

    // Notify watcher
    try {
      const { data: watcher } = await supabase.from('users').select('contact_number').eq('id', payment.watcher_id).single();
      if (watcher?.contact_number) {
        const { notifyFollowupRequest } = await import('../services/notification.service.js');
        await notifyFollowupRequest(watcher.contact_number, payment.watcher_name || 'User');
      }
    } catch (e) {
      console.error('[Followup] Notify failed:', e.message);
    }

    return res.json({
      success: true,
      followupId: followup.id,
      expiresAt: expiresAt.toISOString(),
      message: 'Follow-up request sent to watcher. They have 3 minutes to accept.',
    });
  } catch (err) {
    console.error('[Followup] Exception:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/pay/call/accept-followup — Watcher accepts follow-up
router.post('/call/accept-followup', async (req, res) => {
  try {
    const { followupId, watcherId, accepted } = req.body;
    if (!followupId || !watcherId) return res.status(400).json({ error: 'followupId and watcherId are required' });

    const { data: followup } = await supabase
      .from('followup_requests')
      .select('*, payment:payment_id(*)')
      .eq('id', followupId)
      .single();

    if (!followup) return res.status(404).json({ error: 'Follow-up not found' });
if (followup.watcher_id !== watcherId) {
  return res.status(403).json({ error: 'Unauthorized' });
}
if (followup.status !== 'pending') return res.status(400).json({ error: 'Follow-up already responded to' });
if (new Date() > new Date(followup.expires_at)) {
      await supabase.from('followup_requests').update({ status: 'expired' }).eq('id', followupId);
      return res.status(400).json({ error: 'Follow-up request expired' });
    }

    if (accepted) {
      // Reset payment to confirmed state, reveal contact again
      const contactRevealedAt = new Date().toISOString();
      await supabase.from('payments').update({
        status: 'confirmed',
        contact_revealed_at: contactRevealedAt,
        confirmed_at: contactRevealedAt,
      }).eq('id', followup.payment_id);

      await supabase.from('followup_requests').update({
        status: 'accepted',
        responded_at: new Date().toISOString(),
      }).eq('id', followupId);

      return res.json({
        success: true,
        accepted: true,
        message: 'Follow-up accepted. Contact re-revealed. New 3-minute window started.',
        contactRevealedAt,
      });
    } else {
      // Watcher declined — finalize refund
      await supabase.from('followup_requests').update({
        status: 'declined',
        responded_at: new Date().toISOString(),
      }).eq('id', followupId);

      return res.json({
        success: true,
        accepted: false,
        message: 'Follow-up declined. Refund is final.',
      });
    }
  } catch (err) {
    console.error('[AcceptFollowup] Exception:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/pay/call/check-expired — Check and expire stale windows (cron or polling)
router.get('/call/check-expired', async (req, res) => {
  try {
    const now = new Date().toISOString();

    // Expire call confirmations past deadline
    const { data: expiredConfs } = await supabase
      .from('call_confirmations')
      .select('id, payment_id')
      .eq('status', 'pending')
      .lt('expires_at', now);

    if (expiredConfs?.length) {
      await supabase.from('call_confirmations')
        .update({ status: 'expired', responded_at: now })
        .in('id', expiredConfs.map(c => c.id));

      // Mark payments as cancelled
      await supabase.from('payments')
        .update({ status: 'cancelled' })
        .in('id', expiredConfs.map(c => c.payment_id));

      console.log(`[CheckExpired] Expired ${expiredConfs.length} confirmations`);
    }

    // Expire follow-up requests
    const { data: expiredFollowups } = await supabase
      .from('followup_requests')
      .select('id')
      .eq('status', 'pending')
      .lt('expires_at', now);

    if (expiredFollowups?.length) {
      await supabase.from('followup_requests')
        .update({ status: 'expired', responded_at: now })
        .in('id', expiredFollowups.map(f => f.id));

      console.log(`[CheckExpired] Expired ${expiredFollowups.length} follow-ups`);
    }

        // Auto-resolve disputes where host never submitted evidence (timeout)
    const now2 = new Date().toISOString();
    const { data: staleDisputes } = await supabase
      .from('disputes')
      .select('id')
      .eq('status', 'open')
      .is('host_evidence_url', null)
      .not('host_evidence_deadline', 'is', null)
      .lt('host_evidence_deadline', now2);

    if (staleDisputes?.length) {
      for (const d of staleDisputes) {
        await resolveDisputeOutcome(d.id, 'watcher');
      }
      console.log(`[CheckExpired] Auto-resolved ${staleDisputes.length} disputes in watcher's favor`);
    }

        // Notify host at 3-min mark if they haven't initiated call
    const threeMinsAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
const fourMinsAgo = new Date(Date.now() - 7 * 60 * 1000).toISOString();
    const { data: warnPayments } = await supabase
      .from('payments')
      .select('id, target_user_id, watcher_name')
      .eq('status', 'confirmed')
      .is('call_initiated_at', null)
      .is('host_warned_at', null)
      .lt('contact_revealed_at', threeMinsAgo)
      .gt('contact_revealed_at', fourMinsAgo);

    if (warnPayments?.length) {
      for (const p of warnPayments) {
        const { data: host } = await supabase.from('users').select('contact_number').eq('id', p.target_user_id).single();
        if (host?.contact_number) {
          try {
            const { notifyHostFinalWarning } = await import('../services/notification.service.js');
            await notifyHostFinalWarning(host.contact_number, p.watcher_name);
            await supabase.from('payments').update({ host_warned_at: new Date().toISOString() }).eq('id', p.id);
          } catch (e) {
            console.error('[WarnHost] SMS failed:', e.message);
          }
        }
      }
      console.log(`[CheckExpired] Warned ${warnPayments.length} hosts at 3-min mark`);
    }

    // NEW: Auto-refund payments where 3 hours passed, host never clicked link, never marked done
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

// Abandoned — host never clicked link after 15 mins
const { data: abandonedPayments } = await supabase
  .from('payments')
  .select('id')
  .eq('status', 'confirmed')
  .is('call_initiated_at', null)
  .lt('contact_revealed_at', fifteenMinsAgo);

// Initiated but never marked done after 30 mins
const { data: initiatedNotDone } = await supabase
  .from('payments')
  .select('id')
  .eq('status', 'confirmed')
  .not('call_initiated_at', 'is', null)
  .lt('call_initiated_at', thirtyMinsAgo);

    let autoRefunded = 0;
    console.log(`[CheckExpired] Abandoned payments found: ${abandonedPayments?.length || 0}`);
    if (abandonedPayments?.length) {
      for (const p of abandonedPayments) {
        const { data: pay } = await supabase.from('payments').select('*').eq('id', p.id).single();
        if (pay) {
          const totalPaid = parseFloat(pay.total_charged || pay.amount);
          const refundAmount = parseFloat((totalPaid * REFUND_HOST_GHOSTED / 100).toFixed(2));
          if (pay.paystack_ref) {
            try {
              await paystackRequest('POST', '/refund', {
                transaction: pay.paystack_ref,
                amount: Math.round(refundAmount * 100),
              });
            } catch (e) {
              console.error('[AutoRefund] Paystack error:', e.message);
            }
          }
          await supabase.from('payments').update({ status: 'refunded_partial' }).eq('id', pay.id);
          await supabase.from('refund_requests').insert([{
            payment_id: pay.id,
                        reason: 'Auto-refunded — host never initiated call within 15 minutes',
            status: 'approved',
            watcher_id: pay.watcher_id,
            watcher_name: pay.watcher_name,
            refund_amount: refundAmount,
                        refund_type: 'auto_15_min',
            resolved_at: new Date().toISOString(),
            auto_refunded: true,
            refund_percentage: REFUND_HOST_GHOSTED,
          }]);
          autoRefunded++;
        }
      }
      console.log(`[CheckExpired] Auto-refunded ${autoRefunded} abandoned payments`);
    }

    // Auto-refund initiated-but-no-markdone payments
let initiatedRefunded = 0;
if (initiatedNotDone?.length) {
  for (const p of initiatedNotDone) {
    const { data: pay } = await supabase.from('payments').select('*').eq('id', p.id).single();
    // Skip if already has a call confirmation or refund
    const { data: existingConf } = await supabase.from('call_confirmations').select('id').eq('payment_id', p.id).single();
    const { data: existingRefund } = await supabase.from('refund_requests').select('id').eq('payment_id', p.id).single();
    if (existingConf || existingRefund) continue;
    if (pay) {
      const totalPaid = parseFloat(pay.total_charged || pay.amount);
      const refundAmount = parseFloat((totalPaid * REFUND_HOST_NO_MARKDONE / 100).toFixed(2));
      if (pay.paystack_ref) {
        try {
          await paystackRequest('POST', '/refund', {
            transaction: pay.paystack_ref,
            amount: Math.round(refundAmount * 100),
          });
        } catch (e) {
          console.error('[InitiatedRefund] Paystack error:', e.message);
        }
      }
      await supabase.from('payments').update({ status: 'refunded_partial' }).eq('id', pay.id);
      await supabase.from('refund_requests').insert([{
        payment_id: pay.id,
        reason: 'Auto-refunded — host initiated contact but never marked call done within 30 minutes',
        status: 'approved',
        watcher_id: pay.watcher_id,
        watcher_name: pay.watcher_name,
        refund_amount: refundAmount,
        refund_type: 'auto_30_min_no_markdone',
        resolved_at: new Date().toISOString(),
        auto_refunded: true,
        refund_percentage: REFUND_HOST_NO_MARKDONE,
      }]);

      // Notify both parties
      try {
        const { data: host } = await supabase.from('users').select('contact_number').eq('id', pay.target_user_id).single();
        if (host?.contact_number && pay.watcher_contact) {
          const { notifyHostBookingCancelled } = await import('../services/notification.service.js');
          await notifyHostBookingCancelled(host.contact_number, pay.watcher_name);
        }
      } catch (e) {
        console.error('[InitiatedRefund] Notify failed:', e.message);
      }
      initiatedRefunded++;
    }
  }
  console.log(`[CheckExpired] Auto-refunded ${initiatedRefunded} initiated-but-no-markdone payments`);
}

    return res.json({
      expiredConfirmations: expiredConfs?.length || 0,
      expiredFollowups: expiredFollowups?.length || 0,
      resolvedDisputes: staleDisputes?.length || 0,
      autoRefunded,
      initiatedRefunded,
    });
  } catch (err) {
    console.error('[CheckExpired] Exception:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;