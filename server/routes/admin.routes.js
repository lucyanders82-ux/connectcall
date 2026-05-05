import express from 'express';
import { supabase } from '../app.js';
import { requireAdmin } from '../middleware/auth.middleware.js';
import { processPayout } from '../services/payout.service.js';

const router = express.Router();

router.use(requireAdmin);

router.post('/confirm-payment', async (req, res) => {
  try {
    const { paymentId } = req.body;
    if (!paymentId) return res.status(400).json({ error: 'paymentId is required' });

    const { data: pay } = await supabase.from('payments').select('*').eq('id', paymentId).single();
    if (!pay) return res.status(404).json({ error: 'Payment not found' });
    if (pay.status !== 'pending') return res.status(400).json({ error: 'Cannot confirm - status is ' + pay.status });
    if (!pay.paystack_verified) return res.status(400).json({ error: 'Payment not yet verified' });

    const { data: host } = await supabase.from('users').select('*').eq('id', pay.target_user_id).single();
    if (!host) return res.status(404).json({ error: 'Host not found' });

    await supabase.from('payments').update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      host_contact_revealed: host.contact_number,
      host_platform_revealed: host.platform,
    }).eq('id', paymentId);

    console.log('[Admin] Payment ' + paymentId + ' confirmed');
    return res.json({ success: true, message: 'Contacts revealed' });

  } catch (err) {
    console.error('[Admin Confirm] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/release-funds', async (req, res) => {
  try {
    const { callId, paymentId } = req.body;
    if (!paymentId) return res.status(400).json({ error: 'paymentId required' });
    const result = await processPayout(paymentId, callId);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Admin Release] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/create-recipient', async (req, res) => {
  try {
    const { hostId, name, accountNumber, bankCode } = req.body;
    if (!hostId || !name || !accountNumber || !bankCode) {
      return res.status(400).json({ error: 'All fields required' });
    }

    const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
    const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + PAYSTACK_SECRET,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'ghipss', name, account_number: accountNumber,
        bank_code: bankCode, currency: 'GHS',
      }),
    });
    const data = await recipientRes.json();

    if (!data.status) return res.status(400).json({ error: data.message });

    await supabase.from('users').update({
      paystack_recipient_code: data.data.recipient_code,
      payout_name: name,
      payout_number: accountNumber,
      payout_provider: bankCode,
    }).eq('id', hostId);

    return res.json({ success: true, recipientCode: data.data.recipient_code });
  } catch (err) {
    console.error('[Create Recipient] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/approve-refund', async (req, res) => {
  try {
    const { refundId } = req.body;
    const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

    const { data: refund } = await supabase
      .from('refund_requests')
      .select('*, payments(*)')
      .eq('id', refundId)
      .single();

    if (!refund) return res.status(404).json({ error: 'Refund not found' });
    if (refund.status === 'approved') return res.status(400).json({ error: 'Already approved' });

    const pay = refund.payments;

    const refundRes = await fetch('https://api.paystack.co/refund', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction: pay.paystack_ref,
        amount: Math.round((refund.refund_amount || pay.total_charged || pay.amount) * 100),
      }),
    });
    const refundData = await refundRes.json();

    if (!refundData.status) {
      return res.status(400).json({ error: refundData.message || 'Paystack refund failed' });
    }

    await supabase.from('refund_requests').update({
      status: 'approved',
      resolved_at: new Date().toISOString(),
    }).eq('id', refundId);

    await supabase.from('payments').update({
      status: 'refunded',
    }).eq('id', refund.payment_id);

    return res.json({ success: true, message: 'Refund approved and processed via Paystack' });

  } catch (err) {
    console.error('[Admin Refund] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;