import { supabase } from '../app.js';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

export async function reconcilePayment(reference) {
  const { data: dbPayment } = await supabase
    .from('payments')
    .select('*')
    .eq('paystack_ref', reference)
    .single();
  
  if (!dbPayment) return { error: 'Not in database' };
  
  const psRes = await fetch('https://api.paystack.co/transaction/verify/' + reference, {
    headers: { Authorization: 'Bearer ' + PAYSTACK_SECRET }
  });
  const psData = await psRes.json();
  
  if (!psData.status) return { error: 'Paystack fetch failed' };
  
  const discrepancies = [];
  const dbAmount = Math.round(dbPayment.total_charged * 100);
  const psAmount = psData.data.amount;
  
  if (dbAmount !== psAmount) {
    discrepancies.push({ type: 'amount', db: dbAmount, ps: psAmount });
  }
  
  await supabase.from('reconciliation_logs').insert([{
    payment_id: dbPayment.id,
    reference,
    db_status: dbPayment.status,
    ps_status: psData.data.status,
    db_amount: dbPayment.total_charged,
    ps_amount: psData.data.amount / 100,
    discrepancies: discrepancies.length > 0 ? JSON.stringify(discrepancies) : null,
    reconciled_at: new Date().toISOString()
  }]);
  
  return { reconciled: true, discrepancies };
}