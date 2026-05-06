import express from 'express';
import crypto from 'crypto';
import { supabase } from '../app.js';
import { calculatePaymentAmounts, generatePaymentReference } from '../services/payment.service.js';

const router = express.Router();
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT || '20');
const EARLY_REFUND_PCT = parseFloat(process.env.EARLY_REFUND_PERCENT || '70');
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Window (ms) during which watcher can claim "host didn't contact me"
const NO_CONTACT_WINDOW_MS = 3 * 60 * 1000; // 3 minutes

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
    const { hostId, watcherId, watcherName, watcherContact, watcherPlatform } = req.body;

    if (!hostId || !watcherName || !watcherContact) {
      return res.status(400).json({ error: 'hostId, watcherName, and watcherContact are required' });
    }

    if (!/^\d{10}$/.test(watcherContact)) {
      return res.status(400).json({ error: 'Contact number must be exactly 10 digits' });
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
    }]);

    if (insertErr) {
      return res.status(500).json({ error: 'Failed to create payment record' });
    }

    const psRes = await paystackRequest('POST', '/transaction/initialize', {
      email: watcherEmail,
      amount: amounts.amountPesewas,
      reference,
      currency: 'GHS',
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
// Handles three cases:
//   1. status=pending (not confirmed)  → 70% auto-refund
//   2. no_contact within 3-min window  → cancel booking, 70% refund, notify host
//   3. dispute after host marks done   → admin review
router.post('/watcher/refund', async (req, res) => {
  try {
    const { paymentId, reason, watcherId } = req.body;
    if (!paymentId) return res.status(400).json({ error: 'paymentId is required' });

    const { data: pay } = await supabase.from('payments').select('*').eq('id', paymentId).single();
    if (!pay) return res.status(404).json({ error: 'Payment not found' });

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

    // ── Case 2: Contact revealed but host didn't reach out within 3-min window ──
    if (pay.status === 'confirmed' && isNoContactClaim) {
      const revealedAt = pay.contact_revealed_at ? new Date(pay.contact_revealed_at) : null;
      const now = new Date();

      if (!revealedAt) {
        // No timestamp stored — allow the claim but treat as admin review
        return await handleNoContactClaim(pay, reason, watcherId, res);
      }

      const msSinceReveal = now - revealedAt;
      if (msSinceReveal > NO_CONTACT_WINDOW_MS) {
        return res.status(400).json({
          error: `The 3-minute window to claim no contact has passed (${Math.round(msSinceReveal / 1000)}s ago). Payment is queued for the host.`,
          windowExpired: true,
        });
      }

      return await handleNoContactClaim(pay, reason, watcherId, res);
    }

    // ── Case 3: Watcher disputes after host marks call done ──
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
      const refundRes = await paystackRequest('POST', '/refund', {
        transaction: pay.paystack_ref,
        amount: Math.round(refundAmount * 100),
      });
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

// ── Helper: "Host didn't contact me" within 3-min window ──
async function handleNoContactClaim(pay, reason, watcherId, res) {
  const totalPaid = parseFloat(pay.total_charged || pay.amount);
  const refundAmount = parseFloat((totalPaid * EARLY_REFUND_PCT / 100).toFixed(2));

  let paystackRefundSuccess = false;
  if (pay.paystack_ref) {
    try {
      const refundRes = await paystackRequest('POST', '/refund', {
        transaction: pay.paystack_ref,
        amount: Math.round(refundAmount * 100),
      });
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

export default router;