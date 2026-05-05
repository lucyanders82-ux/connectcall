import { supabase } from '../app.js';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

async function paystackRequest(method, path, body) {
  const res = await fetch('https://api.paystack.co' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + PAYSTACK_SECRET,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export async function processPayout(paymentId, callId) {
  const { data: payment } = await supabase
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .single();
  
  if (!payment) throw new Error('Payment not found');
  if (payment.payout_status === 'completed') {
    return { alreadyProcessed: true, message: 'Already paid' };
  }
  
  await supabase.from('payments')
    .update({ payout_status: 'processing' })
    .eq('id', paymentId)
    .eq('payout_status', 'pending');
  
  const { data: host } = await supabase
    .from('users')
    .select('*')
    .eq('id', payment.target_user_id)
    .single();
  
  if (!host?.paystack_recipient_code) {
    await supabase.from('payments').update({
      payout_status: 'failed',
      last_payout_error: 'No payout method'
    }).eq('id', paymentId);
    throw new Error('Host has no payout method');
  }
  
  let transferCode = null;
  let lastError = null;
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await paystackRequest('POST', '/transfer', {
        source: 'balance',
        amount: Math.round(payment.amount * 100),
        recipient: host.paystack_recipient_code,
        reason: 'ConnectCall payout #' + paymentId,
        reference: 'PAYOUT_' + paymentId + '_' + attempt,
        currency: 'GHS',
      });
      
      if (res.status) {
        transferCode = res.data.transfer_code;
        break;
      }
      lastError = res.message;
    } catch (err) {
      lastError = err.message;
    }
    if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * attempt));
  }
  
  if (!transferCode) {
    await supabase.from('payments').update({
      payout_status: 'failed',
      last_payout_error: lastError,
      payout_attempts: (payment.payout_attempts || 0) + 1
    }).eq('id', paymentId);
    throw new Error('Transfer failed: ' + lastError);
  }
  
  await supabase.from('payouts').insert([{
    host_id: host.id,
    payment_id: paymentId,
    call_id: callId,
    amount: payment.amount,
    transfer_code: transferCode,
    status: 'pending',
    created_at: new Date().toISOString()
  }]);
  
  await supabase.from('payments').update({
    payout_status: 'pending_transfer',
    payout_reference: transferCode,
    status: 'completed'
  }).eq('id', paymentId);
  
  const newWallet = parseFloat(host.wallet || 0) + parseFloat(payment.amount);
  await supabase.from('users').update({ wallet: newWallet }).eq('id', host.id);
  
  if (callId) {
    await supabase.from('calls').update({
      released: true,
      released_at: new Date().toISOString(),
      transfer_code: transferCode
    }).eq('id', callId);
  }
  
  return { success: true, transferCode, amount: payment.amount };
}