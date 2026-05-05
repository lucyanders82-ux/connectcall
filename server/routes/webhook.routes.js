import express from 'express';
import crypto from 'crypto';
import { supabase } from '../app.js';

const router = express.Router();
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

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

// Webhook must use raw body
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    const hash = crypto.createHmac('sha512', PAYSTACK_SECRET).update(req.body).digest('hex');
    
    if (hash !== signature) {
      console.warn('[Webhook] Invalid signature');
      return res.status(401).send('Invalid signature');
    }

    const event = JSON.parse(req.body);
    console.log(`[Webhook] Event: ${event.event}`);

    if (event.event === 'charge.success') {
      const ref = event.data.reference;
      const psRes = await paystackRequest('GET', `/transaction/verify/${ref}`);
      
      if (psRes.data?.status === 'success') {
        const { data: payment } = await supabase.from('payments').select('*').eq('paystack_ref', ref).single();
        
        if (payment && payment.status === 'confirmed') {
          const expectedAmount = Math.round(payment.total_charged * 100);
          
          if (psRes.data.amount >= expectedAmount) {
                        const { data: host } = await supabase
              .from('users')
              .select('contact_number, platform')
              .eq('id', payment.target_user_id)
              .single();

            await supabase.from('payments').update({
              status: 'confirmed',
              paystack_verified: true,
              verified_at: new Date().toISOString(),
              confirmed_at: new Date().toISOString(),
              host_contact_revealed: host?.contact_number || null,
              host_platform_revealed: host?.platform || null,
            }).eq('paystack_ref', ref);
            console.log(`[Webhook] Auto-verified: ${ref}`);
          } else {
            await supabase.from('payments').update({
              status: 'amount_mismatch',
              paystack_verified: true,
              verified_at: new Date().toISOString(),
            }).eq('paystack_ref', ref);
          }
        }
      }
    }

    if (event.event === 'transfer.success') {
      const { data: payout } = await supabase
        .from('payouts')
        .select('*')
        .eq('transfer_code', event.data.transfer_code)
        .single();

      if (payout) {
        await supabase.from('payouts').update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        }).eq('id', payout.id);

        await supabase.from('payments').update({
          payout_status: 'completed',
        }).eq('id', payout.payment_id);

        console.log(`[Webhook] Payout completed: ${event.data.transfer_code}`);
      }
    }

    if (event.event === 'transfer.failed') {
      const { data: payout } = await supabase
        .from('payouts')
        .select('*')
        .eq('transfer_code', event.data.transfer_code)
        .single();

      if (payout) {
        await supabase.from('payouts').update({
          status: 'failed',
          failure_reason: event.data.reason || 'Unknown',
        }).eq('id', payout.id);

        await supabase.from('payments').update({
          payout_status: 'failed',
          last_payout_error: event.data.reason,
        }).eq('id', payout.payment_id);

        console.error(`[Webhook] Transfer FAILED: ${event.data.transfer_code}`);
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('[Webhook] Error:', err);
    res.sendStatus(200);
  }
});

export default router;