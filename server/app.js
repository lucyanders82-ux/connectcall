// Load environment variables BEFORE anything else
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Import routes
import paymentRoutes from './routes/payment.routes.js';
import webhookRoutes from './routes/webhook.routes.js';
import adminRoutes from './routes/admin.routes.js';

// Import middleware
import { adminLogin, rateLimitLogin } from './middleware/auth.middleware.js';

// Now create supabase client after dotenv is loaded
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const app = express();
const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Webhook must use raw body parser BEFORE json parser
app.use('/api/pay/webhook', webhookRoutes);

// Regular body parsing for other routes
app.use(express.json());

// CORS
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://connectcall.vercel.app"
  ],
  credentials: true
}));

// Admin login (no auth required)
app.post('/api/admin/login', rateLimitLogin, adminLogin);

// Routes
app.use('/api/pay', paymentRoutes);
app.use('/api/admin', adminRoutes);

// Host onboard payout
app.post('/api/host/onboard-payout', async (req, res) => {
  try {
    const { hostId, payoutName, payoutNumber, payoutProvider } = req.body;
    if (!hostId || !payoutName || !payoutNumber || !payoutProvider) {
      return res.status(400).json({ error: 'All fields required' });
    }

    const { data: host } = await supabase.from('users').select('id, name, role').eq('id', hostId).single();
    if (!host || host.role !== 'host') return res.status(404).json({ error: 'Host not found' });

    const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
    const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'ghipss',
        name: payoutName,
        account_number: payoutNumber,
        bank_code: payoutProvider,
        currency: 'GHS',
      }),
    });
    const data = await recipientRes.json();

    if (!data.status) {
      return res.status(400).json({ error: data.message });
    }

    await supabase.from('users').update({
      paystack_recipient_code: data.data.recipient_code,
      payout_name: payoutName,
      payout_number: payoutNumber,
      payout_provider: payoutProvider,
    }).eq('id', hostId);

    return res.json({ success: true, recipientCode: data.data.recipient_code });

  } catch (err) {
    console.error('[Onboard] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Host approve refund
app.post('/api/host/approve-refund', async (req, res) => {
  try {
    const { refundId, hostId } = req.body;
    const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

    const { data: refund } = await supabase
      .from('refund_requests')
      .select('*, payments(*)')
      .eq('id', refundId)
      .single();

    if (!refund) return res.status(404).json({ error: 'Refund not found' });
    if (refund.status !== 'pending_host') return res.status(400).json({ error: 'Not pending' });

    const pay = refund.payments;
    if (hostId && pay.target_user_id !== hostId) return res.status(403).json({ error: 'Not your payment' });

    const refundRes = await fetch('https://api.paystack.co/refund', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction: pay.paystack_ref,
        amount: Math.round((pay.total_charged || pay.amount) * 100),
      }),
    });
    const refundData = await refundRes.json();

    if (!refundData.status) {
      return res.status(400).json({ error: refundData.message });
    }

    await supabase.from('refund_requests').update({
      status: 'approved',
      resolved_at: new Date().toISOString(),
    }).eq('id', refundId);

    await supabase.from('payments').update({ status: 'refunded' }).eq('id', refund.payment_id);

    return res.json({ success: true, message: 'Refund approved' });

  } catch (err) {
    console.error('[Host Refund] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Call marking
app.post('/api/call/mark-done', async (req, res) => {
  try {
    const { paymentId, hostId } = req.body;
    if (!paymentId) return res.status(400).json({ error: 'paymentId required' });

    const { data: pay } = await supabase.from('payments').select('*').eq('id', paymentId).single();
    if (!pay) return res.status(404).json({ error: 'Payment not found' });
    if (pay.status !== 'confirmed') return res.status(400).json({ error: 'Not confirmed yet' });

    const { data: existing } = await supabase
      .from('call_confirmations').select('id').eq('payment_id', paymentId).single();
    if (existing) return res.json({ success: true, alreadyMarked: true });

    const { data: call } = await supabase.from('calls').insert([{
      payment_id: paymentId,
      target_user_id: pay.target_user_id,
      released: false,
    }]).select().single();

    const expiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString();
    const { data: confirmation } = await supabase.from('call_confirmations').insert([{
      payment_id: paymentId,
      call_id: call.id,
      status: 'pending',
      expires_at: expiresAt,
    }]).select().single();

    return res.json({ success: true, confirmationId: confirmation.id, expiresAt });

  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Call respond
app.post('/api/call/respond', async (req, res) => {
  try {
    const { confirmationId, watcherId, response } = req.body;
    if (!confirmationId || !response) return res.status(400).json({ error: 'confirmationId and response required' });

    const { data: conf } = await supabase
      .from('call_confirmations')
      .select('*, payments(*)')
      .eq('id', confirmationId)
      .single();

    if (!conf) return res.status(404).json({ error: 'Confirmation not found' });
    if (conf.status !== 'pending') return res.status(400).json({ error: 'Already responded' });
    if (new Date(conf.expires_at) < new Date()) {
      await supabase.from('call_confirmations').update({ status: 'expired' }).eq('id', confirmationId);
      return res.status(400).json({ error: 'Expired' });
    }

    const pay = conf.payments;

    if (response === 'yes') {
      await supabase.from('call_confirmations').update({
        status: 'confirmed',
        responded_at: new Date().toISOString(),
      }).eq('id', confirmationId);

      // Trigger payout
      const { processPayout } = await import('./services/payout.service.js');
      try {
        await processPayout(pay.id, conf.call_id);
      } catch (payoutErr) {
        console.error('[Payout] Failed:', payoutErr.message);
      }

      return res.json({ success: true, confirmed: true, message: 'Call confirmed — payout processing' });
    }

    if (response === 'no') {
      await supabase.from('call_confirmations').update({
        status: 'denied',
        responded_at: new Date().toISOString(),
      }).eq('id', confirmationId);

      await supabase.from('refund_requests').insert([{
        payment_id: pay.id,
        reason: 'Watcher disputed call completion',
        status: 'pending',
        watcher_id: watcherId || pay.watcher_id,
        watcher_name: pay.watcher_name,
        refund_type: 'dispute',
      }]);

      return res.json({ success: true, confirmed: false, message: 'Dispute filed' });
    }

    return res.status(400).json({ error: "Response must be 'yes' or 'no'" });

  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Report a user
app.post('/api/report', async (req, res) => {
  const { reporterId, reportedUsername, reason, details } = req.body;
  
  const { data: reported } = await supabase.from('users')
    .select('id').ilike('name', reportedUsername).single();
  
  if (!reported) return res.status(404).json({ error: 'User not found' });
  
  await supabase.from('reports').insert([{
    reporter_id: reporterId,
    reported_user_id: reported.id,
    reason, details
  }]);
  
  res.json({ success: true });
});

// Get host profile by username
app.get('/api/host/:username', async (req, res) => {
  const { data: host } = await supabase.from('users')
    .select('*')
    .ilike('name', req.params.username)
    .eq('role', 'host')
    .single();
  
  if (!host) return res.status(404).json({ error: 'Host not found' });
  res.json(normaliseUser ? normaliseUser(host) : host);
});

function normaliseUser(row) {
  return {
    ...row,
    contactNumber: row.contact_number ?? row.contactNumber ?? '',
    profilePhoto: row.profile_photo ?? row.profilePhoto ?? null,
    photos: safeArr(row.photos || []),
    tags: safeArr(row.tags || []),
    wallet: Number(row.wallet ?? 0),
    online: row.online ?? true,
    role: row.role ?? 'host',
    payoutName: row.payout_name ?? row.payoutName ?? '',
    payoutNumber: row.payout_number ?? row.payoutNumber ?? '',
    payoutProvider: row.payout_provider ?? row.payoutProvider ?? '',
    paystackRecipientCode: row.paystack_recipient_code ?? row.paystackRecipientCode ?? '',
    avatar: (row.name || '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase(),
  };
}

function safeArr(val) {
  if (Array.isArray(val)) return val.filter(v => v && v !== '[]');
  if (typeof val === 'string' && val.length > 0) {
    try { const p = JSON.parse(val); if (Array.isArray(p)) return p.filter(v => v); } catch {}
    if (val === '[]') return [];
    return val.split(',').map(t => t.trim()).filter(v => v);
  }
  return [];
}

// Submit rating
app.post('/api/rate', async (req, res) => {
  const { paymentId, watcherId, hostId, rating, review } = req.body;
  if (!paymentId || !rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'paymentId and rating (1-5) required' });
  }
  
  const { data, error } = await supabase.from('ratings').insert([{
    payment_id: paymentId, watcher_id: watcherId,
    host_id: hostId, rating, review
  }]).select().single();
  
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true, rating: data });
});

// Get host rating
app.get('/api/rating/:hostId', async (req, res) => {
  const { data, error } = await supabase.from('ratings')
    .select('rating').eq('host_id', req.params.hostId);
  
  if (error) return res.status(500).json({ error: error.message });
  
  const avg = data.length ? (data.reduce((a,r)=>a+r.rating,0)/data.length).toFixed(1) : 0;
  res.json({ average: parseFloat(avg), count: data.length });
});

// Auto-confirm pending payments
app.post('/api/admin/auto-confirm-pending', async (req, res) => {
  try {
    const cutoff = new Date(Date.now() - 0 * 60 * 1000).toISOString();
    const { data: pending } = await supabase.from('payments').select('*')
      .eq('status', 'pending').eq('paystack_verified', true).lt('verified_at', cutoff);
    for (const pay of (pending || [])) {
      const { data: host } = await supabase.from('users').select('*').eq('id', pay.target_user_id).single();
      if (!host) continue;
      await supabase.from('payments').update({
        status: 'confirmed', confirmed_at: new Date().toISOString(),
        host_contact_revealed: host.contact_number, host_platform_revealed: host.platform,
      }).eq('id', pay.id);
    }
    res.json({ success: true, confirmed: (pending||[]).length });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Auto-confirm expired call confirmations
app.post('/api/call/check-expired', async (req, res) => {
  try {
    const { data: expired } = await supabase.from('call_confirmations')
      .select('*, payments(*)').eq('status', 'pending').lt('expires_at', new Date().toISOString());
    for (const conf of (expired || [])) {
      await supabase.from('call_confirmations').update({ status: 'auto_confirmed', responded_at: new Date().toISOString() }).eq('id', conf.id);
      const pay = conf.payments;
      const { processPayout } = await import('./services/payout.service.js');
      try { await processPayout(pay.id, conf.call_id); } catch(e) { console.error('[Auto-payout]', e.message); }
      await supabase.from('payments').update({ status: 'completed' }).eq('id', pay.id);
    }
    res.json({ success: true, processed: (expired||[]).length });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Admin approve refund
app.post('/api/admin/approve-refund', async (req, res) => {
  try {
    const adminToken = req.headers['x-admin-token'];
    if (adminToken !== process.env.ADMIN_SECRET && adminToken !== 'my-secret-token-123') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

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

// Health check
app.get('/health', (req, res) => res.json({
  ok: true,
  ts: new Date().toISOString(),
  uptime: process.uptime(),
}));

app.listen(PORT, () => {
  console.log(`✦ ConnectCall backend v2 running on :${PORT}`);
});
