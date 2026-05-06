// Load environment variables BEFORE anything else
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

// Import routes
import paymentRoutes from './routes/payment.routes.js';
import webhookRoutes from './routes/webhook.routes.js';
import adminRoutes from './routes/admin.routes.js';

// Import middleware
import { adminLogin, rateLimitLogin } from './middleware/auth.middleware.js';

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const app = express();
const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ─── IMPORTANT: read ADMIN_SECRET once so every route uses the same value ───
const ADMIN_SECRET = process.env.ADMIN_SECRET;

function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!ADMIN_SECRET) {
    console.error('[Auth] ADMIN_SECRET env var is not set!');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }
  if (!token || token !== ADMIN_SECRET) {
    console.warn(`[Auth] Invalid admin token received: "${token}"`);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Webhook must use raw body parser BEFORE json parser
app.use('/api/pay/webhook', webhookRoutes);

// Regular body parsing
app.use(express.json());

// CORS — add your actual Vercel URL here
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      'http://localhost:5173',
      'https://connectcall.vercel.app',
      process.env.FRONTEND_URL,
    ].filter(Boolean);
    if (!origin || allowed.some(o => origin.startsWith(o))) {
      callback(null, true);
    } else {
      console.warn('[CORS] Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// ─────────────────────────────────────────────────────────────────────────────
//  AUTH
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/auth/login', async (req, res) => {
  try {
    const { name, password } = req.body;
    if (!name || !password) return res.status(400).json({ error: 'Name and password required' });

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .ilike('name', name.trim())
      .single();

    if (error || !user) return res.status(401).json({ error: 'Name or password incorrect' });

    // Support both bcrypt hashes AND legacy plaintext (for users created before migration)
    let match = false;
    const storedPassword = user.password || '';

    if (storedPassword.startsWith('$2')) {
      // bcrypt hash
      match = await bcrypt.compare(password, storedPassword);
    } else {
      // Legacy plaintext comparison — auto-upgrade on success
      match = password === storedPassword;
      if (match) {
        const hashed = await bcrypt.hash(password, 12);
        await supabase.from('users').update({ password: hashed }).eq('id', user.id);
        console.log(`[Login] Upgraded plaintext password for user ${user.id}`);
      }
    }

    if (!match) return res.status(401).json({ error: 'Name or password incorrect' });

    // Never send sensitive fields to frontend
    const { password: _, payout_number, payout_name, paystack_recipient_code, ...safeUser } = user;
    return res.json({ success: true, user: safeUser });

  } catch (err) {
    console.error('[Login] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, password, role, ...rest } = req.body;
    if (!name || !password) return res.status(400).json({ error: 'Name and password required' });

    const hashedPassword = await bcrypt.hash(password, 12);

    const { data, error } = await supabase.from('users').insert([{
      name,
      password: hashedPassword,
      role: role || 'watcher',
      online: true,
      wallet: 0,
      payout_name: '',
      payout_number: '',
      payout_provider: '',
      paystack_recipient_code: '',
      accepted_terms: true,
      accepted_terms_at: new Date().toISOString(),
      ...rest,
    }]).select().single();

    if (error) return res.status(400).json({ error: error.message });

    const { password: _, ...safeUser } = data;
    return res.json({ success: true, user: safeUser });

  } catch (err) {
    console.error('[Signup] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  PAYMENT ROUTES
// ─────────────────────────────────────────────────────────────────────────────

app.use('/api/pay', paymentRoutes);

// ─────────────────────────────────────────────────────────────────────────────
//  ADMIN ROUTES (all require requireAdmin middleware)
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/admin/login', rateLimitLogin, adminLogin);

app.post('/api/admin/approve-refund', requireAdmin, async (req, res) => {
  try {
    const { refundId } = req.body;

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
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction: pay.paystack_ref,
        amount: Math.round((refund.refund_amount || pay.total_charged || pay.amount) * 100),
      }),
    });
    const refundData = await refundRes.json();

    if (!refundData.status) {
      console.error('[AdminApproveRefund] Paystack error:', refundData.message);
      return res.status(400).json({ error: refundData.message || 'Paystack refund failed' });
    }

    await supabase.from('refund_requests').update({
      status: 'approved',
      resolved_at: new Date().toISOString(),
    }).eq('id', refundId);

    await supabase.from('payments').update({ status: 'refunded' }).eq('id', refund.payment_id);

    return res.json({ success: true, message: 'Refund approved and processed via Paystack' });

  } catch (err) {
    console.error('[AdminApproveRefund] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/deny-refund', requireAdmin, async (req, res) => {
  try {
    const { refundId } = req.body;

    const { data: refund } = await supabase
      .from('refund_requests')
      .select('*, payments(*)')
      .eq('id', refundId)
      .single();

    if (!refund) return res.status(404).json({ error: 'Refund not found' });
    if (refund.status === 'denied') return res.status(400).json({ error: 'Already denied' });

    const pay = refund.payments;

    await supabase.from('refund_requests')
      .update({ status: 'denied', resolved_at: new Date().toISOString() })
      .eq('id', refundId);

    // Trigger payout to host
    try {
      const { processPayout } = await import('./services/payout.service.js');
      await processPayout(pay.id, pay.call_id);
    } catch (payoutErr) {
      console.error('[DenyRefund] Payout failed:', payoutErr.message);
    }

    await supabase.from('payments').update({ status: 'completed' }).eq('id', pay.id);

    return res.json({ success: true, message: 'Refund denied and host payout triggered' });

  } catch (err) {
    console.error('[DenyRefund] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/confirm-payment', requireAdmin, async (req, res) => {
  try {
    const { paymentId } = req.body;

    const { data: pay } = await supabase.from('payments').select('*, users!payments_target_user_id_fkey(*)').eq('id', paymentId).single();
    if (!pay) return res.status(404).json({ error: 'Payment not found' });

    const host = pay.users;
    const contactRevealedAt = new Date().toISOString();

    await supabase.from('payments').update({
      status: 'confirmed',
      confirmed_at: contactRevealedAt,
      contact_revealed_at: contactRevealedAt,
      host_contact_revealed: host?.contact_number || null,
      host_platform_revealed: host?.platform || null,
    }).eq('id', paymentId);

    return res.json({ success: true });

  } catch (err) {
    console.error('[ConfirmPayment] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/release-funds', requireAdmin, async (req, res) => {
  try {
    const { callId, paymentId } = req.body;
    const { processPayout } = await import('./services/payout.service.js');
    await processPayout(paymentId, callId);
    await supabase.from('calls').update({ released: true }).eq('id', callId);
    await supabase.from('payments').update({ status: 'completed' }).eq('id', paymentId);
    return res.json({ success: true });
  } catch (err) {
    console.error('[ReleaseFunds] Error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

app.post('/api/admin/auto-confirm-pending', requireAdmin, async (req, res) => {
  try {
    const cutoff = new Date(Date.now() - 0 * 60 * 1000).toISOString();
    const { data: pending } = await supabase.from('payments').select('*')
      .eq('status', 'pending').eq('paystack_verified', true).lt('verified_at', cutoff);
    let confirmed = 0;
    for (const pay of (pending || [])) {
      const { data: host } = await supabase.from('users').select('*').eq('id', pay.target_user_id).single();
      if (!host) continue;
      const contactRevealedAt = new Date().toISOString();
      await supabase.from('payments').update({
        status: 'confirmed',
        confirmed_at: contactRevealedAt,
        contact_revealed_at: contactRevealedAt,
        host_contact_revealed: host.contact_number,
        host_platform_revealed: host.platform,
      }).eq('id', pay.id);
      confirmed++;
    }
    res.json({ success: true, confirmed });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.use('/api/admin', requireAdmin, adminRoutes);

// ─────────────────────────────────────────────────────────────────────────────
//  HOST ROUTES
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/host/onboard-payout', async (req, res) => {
  try {
    const { hostId, payoutName, payoutNumber, payoutProvider } = req.body;
    if (!hostId || !payoutName || !payoutNumber || !payoutProvider) {
      return res.status(400).json({ error: 'All fields required' });
    }

    const { data: host } = await supabase.from('users').select('id, name, role').eq('id', hostId).single();
    if (!host || host.role !== 'host') return res.status(404).json({ error: 'Host not found' });

    const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
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

app.post('/api/host/approve-refund', async (req, res) => {
  try {
    const { refundId, hostId } = req.body;

    const { data: refund } = await supabase
      .from('refund_requests')
      .select('*, payments(*)')
      .eq('id', refundId)
      .single();

    if (!refund) return res.status(404).json({ error: 'Refund not found' });
    if (refund.status !== 'pending_host') return res.status(400).json({ error: 'Not pending host approval' });

    const pay = refund.payments;
    if (hostId && pay.target_user_id !== hostId) return res.status(403).json({ error: 'Not your payment' });

    const refundRes = await fetch('https://api.paystack.co/refund', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
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
    console.error('[HostApproveRefund] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  CALL ROUTES
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/call/mark-done', async (req, res) => {
  try {
    const { paymentId, hostId } = req.body;
    if (!paymentId) return res.status(400).json({ error: 'paymentId required' });

    const { data: pay } = await supabase.from('payments').select('*').eq('id', paymentId).single();
    if (!pay) return res.status(404).json({ error: 'Payment not found' });
    if (pay.status !== 'confirmed') return res.status(400).json({ error: 'Payment not in confirmed state' });

    // Check for active no-contact refund (watcher already cancelled)
    const { data: activeRefund } = await supabase
      .from('refund_requests')
      .select('id, status, refund_type')
      .eq('payment_id', paymentId)
      .in('status', ['pending', 'pending_host', 'approved'])
      .single();

    if (activeRefund) {
      return res.status(400).json({ error: 'Watcher has an active refund request for this payment' });
    }

    const { data: existing } = await supabase
      .from('call_confirmations').select('id').eq('payment_id', paymentId).single();
    if (existing) return res.json({ success: true, alreadyMarked: true });

    const { data: call } = await supabase.from('calls').insert([{
      payment_id: paymentId,
      target_user_id: pay.target_user_id,
      released: false,
    }]).select().single();

    // Watcher has 24 hours to confirm before auto-payout
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { data: confirmation } = await supabase.from('call_confirmations').insert([{
      payment_id: paymentId,
      call_id: call.id,
      status: 'pending',
      expires_at: expiresAt,
    }]).select().single();

    // SMS poll to watcher
    try {
      const { notifyWatcherCallMarkedDone } = await import('./services/notification.service.js');
      const { data: host } = await supabase.from('users').select('name').eq('id', pay.target_user_id).single();
      if (pay.watcher_contact) {
        await notifyWatcherCallMarkedDone(pay.watcher_contact, host?.name || 'Your host');
      }
    } catch (notifyErr) {
      console.error('[MarkDone] Notify failed (non-fatal):', notifyErr.message);
    }

    return res.json({ success: true, confirmationId: confirmation.id, expiresAt });

  } catch (err) {
    console.error('[MarkDone] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

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
      return res.status(400).json({ error: 'Confirmation window expired' });
    }

    const pay = conf.payments;

    if (response === 'yes') {
      await supabase.from('call_confirmations').update({
        status: 'confirmed',
        responded_at: new Date().toISOString(),
      }).eq('id', confirmationId);

      try {
        const { processPayout } = await import('./services/payout.service.js');
        await processPayout(pay.id, conf.call_id);
      } catch (payoutErr) {
        console.error('[CallRespond] Payout failed:', payoutErr.message);
      }

      return res.json({ success: true, confirmed: true, message: 'Call confirmed — payout processing' });
    }

    if (response === 'no') {
      // Watcher disputes — mark confirmation denied, create admin review refund
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

      // Move to disputed so it leaves host's live dashboard
      await supabase.from('payments').update({ status: 'disputed' }).eq('id', pay.id);

      return res.json({ success: true, confirmed: false, message: 'Dispute filed — admin will review' });
    }

    return res.status(400).json({ error: "Response must be 'yes' or 'no'" });

  } catch (err) {
    console.error('[CallRespond] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/call/check-expired', async (req, res) => {
  try {
    const { data: expired } = await supabase.from('call_confirmations')
      .select('*, payments(*)')
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString());

    let processed = 0;
    for (const conf of (expired || [])) {
      await supabase.from('call_confirmations').update({
        status: 'auto_confirmed',
        responded_at: new Date().toISOString(),
      }).eq('id', conf.id);

      const pay = conf.payments;
      try {
        const { processPayout } = await import('./services/payout.service.js');
        await processPayout(pay.id, conf.call_id);
      } catch (e) {
        console.error('[AutoPayout]', e.message);
      }

      await supabase.from('payments').update({ status: 'completed' }).eq('id', pay.id);
      processed++;
    }

    res.json({ success: true, processed });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  MISC
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/report', async (req, res) => {
  const { reporterId, reportedUsername, reason, details } = req.body;
  const { data: reported } = await supabase.from('users')
    .select('id').ilike('name', reportedUsername).single();
  if (!reported) return res.status(404).json({ error: 'User not found' });
  await supabase.from('reports').insert([{
    reporter_id: reporterId,
    reported_user_id: reported.id,
    reason, details,
  }]);
  res.json({ success: true });
});

app.get('/api/host/:username', async (req, res) => {
  const { data: host } = await supabase.from('users')
    .select('*')
    .ilike('name', req.params.username)
    .eq('role', 'host')
    .single();
  if (!host) return res.status(404).json({ error: 'Host not found' });
  const { password, payout_number, payout_name, paystack_recipient_code, ...safe } = host;
  res.json(safe);
});

app.post('/api/rate', async (req, res) => {
  const { paymentId, watcherId, hostId, rating, review } = req.body;
  if (!paymentId || !rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'paymentId and rating (1-5) required' });
  }
  const { data, error } = await supabase.from('ratings').insert([{
    payment_id: paymentId, watcher_id: watcherId,
    host_id: hostId, rating, review,
  }]).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true, rating: data });
});

app.get('/api/rating/:hostId', async (req, res) => {
  const { data, error } = await supabase.from('ratings')
    .select('rating').eq('host_id', req.params.hostId);
  if (error) return res.status(500).json({ error: error.message });
  const avg = data.length ? (data.reduce((a, r) => a + r.rating, 0) / data.length).toFixed(1) : 0;
  res.json({ average: parseFloat(avg), count: data.length });
});

app.get('/health', (req, res) => res.json({
  ok: true,
  ts: new Date().toISOString(),
  uptime: process.uptime(),
}));

app.listen(PORT, () => {
  console.log(`✦ ConnectCall backend running on :${PORT}`);
  console.log(`   ADMIN_SECRET set: ${!!ADMIN_SECRET}`);
  console.log(`   FRONTEND_URL: ${FRONTEND_URL}`);
});