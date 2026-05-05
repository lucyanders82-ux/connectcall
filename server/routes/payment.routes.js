import express from 'express';
import crypto from 'crypto';
import { supabase } from '../app.js';
import { calculatePaymentAmounts, generatePaymentReference } from '../services/payment.service.js';

const router = express.Router();
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT || '20');
const EARLY_REFUND_PCT = parseFloat(process.env.EARLY_REFUND_PERCENT || '70');
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

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

    // SERVER calculates fees — not client
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

        // Fetch host to get contact info
    const { data: host } = await supabase
      .from('users')
      .select('contact_number, platform')
      .eq('id', existing.target_user_id)
      .single();

    const { data: updated } = await supabase
      .from('payments')
      .update({
        status: 'confirmed',
        paystack_verified: true,
        paystack_channel: psRes.data.channel,
        verified_at: new Date().toISOString(),
        confirmed_at: new Date().toISOString(),
        host_contact_revealed: host?.contact_number || null,
        host_platform_revealed: host?.platform || null,
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

// POST /api/watcher/refund
router.post('/watcher/refund', async (req, res) => {
  try {
    const { paymentId, reason, watcherId } = req.body;
    if (!paymentId) return res.status(400).json({ error: 'paymentId is required' });

    const { data: pay } = await supabase.from('payments').select('*').eq('id', paymentId).single();
    if (!pay) return res.status(404).json({ error: 'Payment not found' });

    // Check existing refund
    const { data: existingRefund } = await supabase
      .from('refund_requests')
      .select('id')
      .eq('payment_id', paymentId)
      .eq('status', 'pending')
      .single();

    if (existingRefund) {
      return res.status(400).json({ error: 'A pending refund request already exists' });
    }

    // Auto-refund 70% if not confirmed
    if (pay.status === 'pending' && !pay.confirmed_at) {
      const totalPaid = parseFloat(pay.total_charged || pay.amount);
      const refundAmount = parseFloat((totalPaid * EARLY_REFUND_PCT / 100).toFixed(2));

      let paystackRefundSuccess = false;
      if (pay.paystack_ref) {
        const refundRes = await paystackRequest('POST', '/refund', {
          transaction: pay.paystack_ref,
          amount: Math.round(refundAmount * 100),
        });
        paystackRefundSuccess = refundRes.status;
      }

      await supabase.from('payments').update({ status: 'refunded_partial' }).eq('id', paymentId);

      await supabase.from('refund_requests').insert([{
        payment_id: paymentId,
        reason: reason || 'Early cancellation',
        status: 'approved',
        watcher_id: watcherId || pay.watcher_id,
        watcher_name: pay.watcher_name,
        refund_amount: refundAmount,
        refund_type: 'auto_70_percent',
        resolved_at: new Date().toISOString(),
      }]);

      console.log(`[Refund] Auto-refund 70%: GHS ${refundAmount}`);
      return res.json({
        success: true,
        autoRefunded: true,
        refundAmount,
        message: `70% auto-refunded. GHS ${refundAmount} returned.`,
      });
    }

    // Requires host approval
    if (pay.status === 'confirmed' || pay.status === 'completed') {
      const { data: refundReq } = await supabase.from('refund_requests').insert([{
        payment_id: paymentId,
        reason: reason || 'Call did not take place',
        status: 'pending_host',
        watcher_id: watcherId || pay.watcher_id,
        watcher_name: pay.watcher_name,
        refund_type: 'host_approval_required',
      }]).select().single();

      return res.json({
        success: true,
        autoRefunded: false,
        message: 'Host must approve this refund.',
        refundId: refundReq.id,
      });
    }

    return res.status(400).json({ error: `Cannot refund — status is "${pay.status}"` });

  } catch (err) {
    console.error('[Refund] Exception:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;