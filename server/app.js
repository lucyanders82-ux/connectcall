// Load environment variables BEFORE anything else
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import cron from 'node-cron';

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

// ─────────────────────────────────────────────────────────────────────────────
//  NIGERIA / OPAY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// Detect if a phone number is Nigerian
function isNigerianNumber(number) {
  const digits = (number || '').replace(/\D/g, '');
  // +234... or 234... or 07x/08x/09x (10 digits)
  if (digits.startsWith('234')) return true;
  if (digits.length === 11 && ['070','071','080','081','090','091'].some(p => digits.startsWith(p))) return true;
  return false;
}

// Normalise to international format
function toNigeriaIntl(number) {
  const digits = number.replace(/\D/g, '');
  if (digits.startsWith('234')) return '+' + digits;
  if (digits.startsWith('0') && digits.length === 11) return '+234' + digits.slice(1);
  return '+' + digits;
}

// OPay payout — send money to a Nigerian mobile number via OPay API
async function processOPayPayout(recipientNumber, amount, note) {
  const OPAY_BASE = process.env.OPAY_BASE_URL || 'https://cashierapi.opayweb.com';
  const merchantId = process.env.OPAY_MERCHANT_ID;
  const publicKey  = process.env.OPAY_PUBLIC_KEY;
  const privateKey = process.env.OPAY_PRIVATE_KEY;

  if (!merchantId || !publicKey || !privateKey) {
    throw new Error('OPay credentials not configured (OPAY_MERCHANT_ID, OPAY_PUBLIC_KEY, OPAY_PRIVATE_KEY)');
  }

  const reference = `CC-NG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const payload = {
    amount: { total: Math.round(amount * 100), currency: 'NGN' },
    country: 'NG',
    receiver: { type: 'USER_PHONE', phoneNumber: toNigeriaIntl(recipientNumber) },
    reference,
    reason: note || 'ConnectCall payout',
  };

  // OPay uses HMAC-SHA512 signature on the JSON body with the private key
  const bodyStr = JSON.stringify(payload);
  const signature = crypto.createHmac('sha512', privateKey).update(bodyStr).digest('hex');

  const res = await fetch(`${OPAY_BASE}/api/v3/transfer/toWallet`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${publicKey}`,
      'MerchantId': merchantId,
      'Signature': signature,
    },
    body: bodyStr,
  });

  const data = await res.json();
  if (data.code !== '00000') {
    throw new Error(`OPay transfer failed: ${data.message || JSON.stringify(data)}`);
  }
  console.log(`[OPay] Payout NGN ${amount} to ${recipientNumber} — ref ${reference}`);
  return { reference, data };
}

// Webhook must use raw body parser BEFORE json parser
app.use('/api/pay/webhook', webhookRoutes);

// Regular body parsing
app.use(express.json());

// CORS
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

    let match = false;
    const storedPassword = user.password || '';

    if (storedPassword.startsWith('$2')) {
      match = await bcrypt.compare(password, storedPassword);
    } else {
      match = password === storedPassword;
      if (match) {
        const hashed = await bcrypt.hash(password, 12);
        await supabase.from('users').update({ password: hashed }).eq('id', user.id);
        console.log(`[Login] Upgraded plaintext password for user ${user.id}`);
      }
    }

    if (!match) return res.status(401).json({ error: 'Name or password incorrect' });

    const { password: _, payout_number, payout_name, paystack_recipient_code, ...safeUser } = user;
    return res.json({ success: true, user: safeUser });

  } catch (err) {
    console.error('[Login] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/request-reset', async (req, res) => {
  try {
    const { name, contactNumber } = req.body;
    if (!name || !contactNumber) return res.status(400).json({ error: 'Name and contact number required' });

    const { data: user } = await supabase
      .from('users')
      .select('id, name, contact_number, role')
      .ilike('name', name.trim())
      .single();

    if (!user) return res.status(404).json({ error: 'No account found with that name' });

    const digits = contactNumber.replace(/\D/g, '');
    const storedDigits = (user.contact_number || '').replace(/\D/g, '');
    if (digits !== storedDigits) {
      return res.status(400).json({ error: 'Contact number does not match our records' });
    }

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recentReset } = await supabase
      .from('password_resets')
      .select('id, created_at')
      .eq('user_id', user.id)
      .gt('created_at', fiveMinutesAgo)
      .limit(1)
      .single();

    if (recentReset) {
      return res.status(429).json({ error: 'A reset code was already sent. Please wait 5 minutes before requesting another.' });
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await supabase.from('password_resets').insert([{
      user_id: user.id,
      otp: hashedOtp,
      expires_at: expiresAt,
      used: false,
    }]);

    try {
      const { notifyPasswordReset } = await import('./services/notification.service.js');
      await notifyPasswordReset(contactNumber, otp, user.name);
    } catch (smsErr) {
      console.error('[RequestReset] SMS failed (non-fatal):', smsErr.message);
    }

    console.log(`[RequestReset] OTP sent to ${contactNumber} for user ${user.id}`);
    return res.json({ success: true, message: 'OTP sent via SMS' });

  } catch (err) {
    console.error('[RequestReset] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/confirm-reset', async (req, res) => {
  try {
    const { name, otp, newPassword } = req.body;
    if (!name || !otp || !newPassword) return res.status(400).json({ error: 'Name, OTP, and new password required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const { data: user } = await supabase
      .from('users')
      .select('id')
      .ilike('name', name.trim())
      .single();

    if (!user) return res.status(404).json({ error: 'User not found' });

    const { data: resets } = await supabase
      .from('password_resets')
      .select('*')
      .eq('user_id', user.id)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(5);

    if (!resets || resets.length === 0) {
      return res.status(400).json({ error: 'No valid OTP found — request a new one' });
    }

    let matchedReset = null;
    for (const reset of resets) {
      const match = await bcrypt.compare(otp, reset.otp);
      if (match) { matchedReset = reset; break; }
    }

    if (!matchedReset) return res.status(400).json({ error: 'Incorrect OTP' });

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await supabase.from('users').update({ password: hashedPassword }).eq('id', user.id);
    await supabase.from('password_resets').update({ used: true }).eq('id', matchedReset.id);

    console.log(`[ConfirmReset] Password reset for user ${user.id}`);
    return res.json({ success: true, message: 'Password reset successfully' });

  } catch (err) {
    console.error('[ConfirmReset] Error:', err);
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
      country: rest.country || 'Ghana',
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
//  FEEDBACK
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/feedback', async (req, res) => {
  try {
    const { rating, text, ts } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating 1–5 required' });
    }
    await supabase.from('feedback').insert([{
      rating,
      text: text || null,
      submitted_at: ts || new Date().toISOString(),
    }]);
    console.log(`[Feedback] Rating ${rating} received`);
    return res.json({ success: true });
  } catch (err) {
    // Non-fatal — table may not exist yet, just log it
    console.error('[Feedback] Error (non-fatal):', err.message);
    return res.json({ success: true });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  PAYMENT ROUTES
// ─────────────────────────────────────────────────────────────────────────────

app.use('/api/pay', paymentRoutes);

// ─────────────────────────────────────────────────────────────────────────────
//  ADMIN ROUTES
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
    const refundableAmount = refund.refund_amount
      || parseFloat((parseFloat(pay.total_charged || pay.amount) * 0.85).toFixed(2));

    const refundRes = await fetch('https://api.paystack.co/refund', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction: pay.paystack_ref,
        amount: Math.round(refundableAmount * 100),
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

app.post('/api/admin/resolve-dispute', requireAdmin, async (req, res) => {
  try {
    const { disputeId, verdict } = req.body;
    if (!disputeId || !['host', 'watcher'].includes(verdict)) {
      return res.status(400).json({ error: 'disputeId and verdict (host or watcher) required' });
    }

    const now = new Date().toISOString();
    await supabase.from('disputes').update({
      status: verdict === 'host' ? 'resolved_host' : 'resolved_watcher',
      resolved_at: now,
      resolved_by: 'admin',
    }).eq('id', disputeId);

    const { data: dispute } = await supabase.from('disputes').select('*, payment:payment_id(*)').eq('id', disputeId).single();
    const payment = dispute?.payment;
    const totalPaid = parseFloat(payment?.total_charged || payment?.amount || 0);
    const refundAmount = parseFloat((totalPaid * 85 / 100).toFixed(2));

    if (verdict === 'watcher') {
      if (payment?.paystack_ref) {
        await fetch('https://api.paystack.co/refund', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ transaction: payment.paystack_ref, amount: Math.round(refundAmount * 100) }),
        });
      }
      await supabase.from('payments').update({ status: 'refunded_partial' }).eq('id', payment.id);
      await supabase.from('refund_requests').update({ status: 'approved', refund_amount: refundAmount, resolved_at: now }).eq('dispute_id', disputeId);
    } else {
      await supabase.from('payments').update({ status: 'completed' }).eq('id', payment.id);
      await supabase.from('refund_requests').update({ status: 'rejected', resolved_at: now }).eq('dispute_id', disputeId);
      const { processPayout } = await import('./services/payout.service.js');
      await processPayout(payment.id, null).catch(e => console.error('[AdminResolve] Payout failed:', e.message));
    }

    await supabase.from('dispute_messages').insert([{
      dispute_id: disputeId,
      sender_role: 'system',
      message: `Admin manually resolved dispute in favor of ${verdict === 'host' ? 'HOST' : 'WATCHER'}.`,
    }]);

    return res.json({ success: true });
  } catch (err) {
    console.error('[AdminResolveDispute] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.use('/api/admin', requireAdmin, adminRoutes);

// ─────────────────────────────────────────────────────────────────────────────
//  HOST ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// ── Payout onboarding — supports Ghana (Paystack) and Nigeria (OPay) ─────────
app.post('/api/host/onboard-payout', async (req, res) => {
  try {
    const { hostId, payoutName, payoutNumber, payoutProvider } = req.body;
    if (!hostId || !payoutName || !payoutNumber || !payoutProvider) {
      return res.status(400).json({ error: 'All fields required' });
    }

    const { data: host } = await supabase.from('users').select('id, name, role').eq('id', hostId).single();
    if (!host || host.role !== 'host') return res.status(404).json({ error: 'Host not found' });

    // ── Nigeria / OPay path ──
    if (payoutProvider === 'OPay' || isNigerianNumber(payoutNumber)) {
      // For OPay we don't create a Paystack recipient — just store details
      await supabase.from('users').update({
        payout_name: payoutName,
        payout_number: payoutNumber,
        payout_provider: 'OPay',
        // Use a placeholder so frontend shows payout as configured
        paystack_recipient_code: `OPAY_${hostId}`,
      }).eq('id', hostId);

      console.log(`[Onboard] Nigerian host ${hostId} registered with OPay`);
      return res.json({ success: true, recipientCode: `OPAY_${hostId}`, provider: 'OPay' });
    }

    // ── Ghana / Paystack path ──
    const { data: hostData } = await supabase.from('users').select('country').eq('id', hostId).single();
    const isNigerian = hostData?.country === 'Nigeria' || payoutProvider === 'OPay';
    const paystackKey = isNigerian
      ? (process.env.PAYSTACK_NG_SECRET_KEY || process.env.PAYSTACK_SECRET_KEY)
      : process.env.PAYSTACK_SECRET_KEY;

    const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: isNigerian ? 'nuban' : 'ghipss',
        name: payoutName,
        account_number: payoutNumber,
        bank_code: isNigerian ? (process.env.OPAY_BANK_CODE || '100004') : payoutProvider,
        currency: isNigerian ? 'NGN' : 'GHS',
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

    return res.json({ success: true, recipientCode: data.data.recipient_code, provider: 'Paystack' });

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

app.post('/api/call/initiate', async (req, res) => {
  try {
    const { paymentId, hostId } = req.body;
    if (!paymentId || !hostId) return res.status(400).json({ error: 'paymentId and hostId required' });

    const { data: pay } = await supabase.from('payments').select('*').eq('id', paymentId).single();
    if (!pay) return res.status(404).json({ error: 'Payment not found' });
    if (pay.target_user_id !== hostId) return res.status(403).json({ error: 'Unauthorized' });
    if (pay.status !== 'confirmed') return res.status(400).json({ error: 'Payment not confirmed' });

   if (pay.contact_revealed_at && !pay.call_initiated_at) {
      const msSinceReveal = Date.now() - new Date(pay.contact_revealed_at).getTime();
      if (msSinceReveal > 10 * 60 * 1000) {
        return res.status(400).json({ error: 'Contact window expired — booking will be cancelled' });
      }
    }

    const { data: activeRefund } = await supabase
      .from('refund_requests')
      .select('id')
      .eq('payment_id', paymentId)
      .in('status', ['pending', 'pending_host'])
      .single();
    if (activeRefund) return res.status(400).json({ error: 'Cannot initiate — an active refund request exists' });

    if (pay.call_initiated_at) {
      const msSinceInitiated = Date.now() - new Date(pay.call_initiated_at).getTime();
      console.log(`[Initiate] Repeat click by host ${hostId} — ${Math.round(msSinceInitiated / 1000)}s since first click`);
      return res.json({ success: true, call_initiated_at: pay.call_initiated_at, repeated: true });
    }

    await supabase.from('payments').update({
      call_initiated_at: new Date().toISOString(),
    }).eq('id', paymentId);

    try {
      const { notifyWatcherCallInitiated } = await import('./services/notification.service.js');
      if (pay.watcher_contact) {
        await notifyWatcherCallInitiated(pay.watcher_contact, pay.watcher_name);
      }
    } catch (e) {
      console.error('[Initiate] Notify failed:', e.message);
    }

    try {
      const { notifyHostCallInitiated } = await import('./services/notification.service.js');
      const { data: host } = await supabase.from('users').select('contact_number').eq('id', hostId).single();
      if (host?.contact_number) {
        await notifyHostCallInitiated(host.contact_number, pay.watcher_name);
      }
    } catch (e) {
      console.error('[Initiate] Deadline notify failed:', e.message);
    }

    console.log(`[Initiate] Host ${hostId} clicked contact link for payment ${paymentId}`);
    return res.json({ success: true, call_initiated_at: pay.call_initiated_at || new Date().toISOString() });

  } catch (err) {
    console.error('[Initiate] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/call/reject', async (req, res) => {
  try {
    const { paymentId, hostId } = req.body;
    if (!paymentId || !hostId) return res.status(400).json({ error: 'paymentId and hostId required' });

    const { data: pay } = await supabase.from('payments').select('*').eq('id', paymentId).single();
    if (!pay) return res.status(404).json({ error: 'Payment not found' });
    if (pay.target_user_id !== hostId) return res.status(403).json({ error: 'Unauthorized' });
    if (pay.status !== 'confirmed') return res.status(400).json({ error: 'Payment not in confirmed state' });

    const { data: existingRefund } = await supabase
      .from('refund_requests')
      .select('id')
      .eq('payment_id', paymentId)
      .in('status', ['pending', 'pending_host', 'approved'])
      .single();
    if (existingRefund) return res.status(400).json({ error: 'A refund already exists for this payment' });

    const totalPaid = parseFloat(pay.total_charged || pay.amount);
    const REFUND_HOST_REJECTED = 90;
    const refundAmount = parseFloat((totalPaid * REFUND_HOST_REJECTED / 100).toFixed(2));

    if (pay.paystack_ref) {
      try {
        await fetch('https://api.paystack.co/refund', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ transaction: pay.paystack_ref, amount: Math.round(refundAmount * 100) }),
        });
      } catch (e) {
        console.error('[Reject] Paystack refund failed:', e.message);
      }
    }

    await supabase.from('payments').update({ status: 'refunded_partial' }).eq('id', paymentId);
    await supabase.from('refund_requests').insert([{
      payment_id: paymentId,
      reason: 'Host rejected the request — unable to make the call',
      status: 'approved',
      watcher_id: pay.watcher_id,
      watcher_name: pay.watcher_name,
      refund_amount: refundAmount,
      refund_type: 'host_rejected',
      resolved_at: new Date().toISOString(),
      auto_refunded: true,
      refund_percentage: REFUND_HOST_REJECTED,
    }]);

    try {
      const { notifyWatcherHostRejected } = await import('./services/notification.service.js');
      if (pay.watcher_contact) {
        await notifyWatcherHostRejected(pay.watcher_contact);
      }
    } catch (e) {
      console.error('[Reject] Notify failed:', e.message);
    }

    console.log(`[Reject] Host ${hostId} rejected payment ${paymentId} — ${refundAmount} refunded`);
    return res.json({ success: true, refundAmount, message: `Request rejected — GHS ${refundAmount} refunded to watcher` });

  } catch (err) {
    console.error('[Reject] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/call/mark-done', async (req, res) => {
  try {
    const { paymentId, hostId } = req.body;
    if (!paymentId) return res.status(400).json({ error: 'paymentId required' });

    const { data: pay } = await supabase.from('payments').select('*').eq('id', paymentId).single();
    if (!pay) return res.status(404).json({ error: 'Payment not found' });
    if (pay.status !== 'confirmed') return res.status(400).json({ error: 'Payment not in confirmed state' });

    // If host hasn't clicked link yet, check contact reveal window (10 min)
    if (!pay.call_initiated_at && pay.contact_revealed_at) {
      const msSinceReveal = Date.now() - new Date(pay.contact_revealed_at).getTime();
      if (msSinceReveal > 10 * 60 * 1000) {
        return res.status(400).json({ error: 'Contact window expired — booking has been cancelled' });
      }
    }

    // If host has clicked link, check 30-min deadline from initiation
    if (pay.call_initiated_at) {
      const msSinceInitiated = Date.now() - new Date(pay.call_initiated_at).getTime();
      if (msSinceInitiated > 30 * 60 * 1000) {
        return res.status(400).json({ error: 'Call window expired — 30 minutes passed since you initiated contact' });
      }
    }

    const { data: activeRefund } = await supabase
      .from('refund_requests')
      .select('id')
      .eq('payment_id', paymentId)
      .in('status', ['pending', 'pending_host'])
      .single();
    if (activeRefund) return res.status(400).json({ error: 'Cannot mark done — an active refund request exists' });

    if (!pay.call_initiated_at) {
      return res.status(400).json({ error: 'You must initiate the call first by clicking the contact link' });
    }

    const msSinceInitiation = Date.now() - new Date(pay.call_initiated_at).getTime();
    const MIN_CALL_MS = 2 * 60 * 1000;
    if (msSinceInitiation < MIN_CALL_MS) {
      const secondsLeft = Math.ceil((MIN_CALL_MS - msSinceInitiation) / 1000);
      return res.status(400).json({
        error: `Please wait ${secondsLeft} more seconds before marking the call as done`,
        secondsLeft,
      });
    }

    const { data: existing } = await supabase
      .from('call_confirmations').select('id').eq('payment_id', paymentId).single();
    if (existing) return res.json({ success: true, alreadyMarked: true });

    const { data: call } = await supabase.from('calls').insert([{
      payment_id: paymentId,
      target_user_id: pay.target_user_id,
      released: false,
    }]).select().single();

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { data: confirmation } = await supabase.from('call_confirmations').insert([{
      payment_id: paymentId,
      call_id: call.id,
      status: 'pending',
      expires_at: expiresAt,
    }]).select().single();

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
      await supabase.from('call_confirmations').update({
        status: 'denied',
        responded_at: new Date().toISOString(),
      }).eq('id', confirmationId);

      const { data: refundReq } = await supabase.from('refund_requests').insert([{
        payment_id: pay.id,
        reason: 'Watcher disputed call completion',
        status: 'pending',
        watcher_id: watcherId || pay.watcher_id,
        watcher_name: pay.watcher_name,
        refund_type: 'dispute_evidence',
        auto_refunded: false,
      }]).select().single();

      const { data: dispute } = await supabase.from('disputes').insert([{
        payment_id: pay.id,
        refund_request_id: refundReq?.id,
        status: 'open',
        opened_by: 'watcher',
        opened_reason: 'Watcher disputed call completion',
        host_evidence_deadline: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
      }]).select().single();

      if (refundReq?.id && dispute?.id) {
        await supabase.from('refund_requests')
          .update({ dispute_id: dispute.id })
          .eq('id', refundReq.id);
      }

      await supabase.from('dispute_messages').insert([{
        dispute_id: dispute.id,
        sender_role: 'system',
        message: `Dispute opened. Host has 20 minutes to submit evidence of the call to ${pay.watcher_contact}.`,
      }]);

      await supabase.from('payments').update({ status: 'disputed' }).eq('id', pay.id);

      try {
        const { data: host } = await supabase.from('users').select('contact_number').eq('id', pay.target_user_id).single();
        if (host?.contact_number) {
          const { notifyHostDisputeOpened } = await import('./services/notification.service.js');
          await notifyHostDisputeOpened(host.contact_number, pay.watcher_name, new Date(Date.now() + 20 * 60 * 1000));
        }
      } catch (e) {
        console.error('[CallRespond] Notify host failed:', e.message);
      }

      return res.json({ success: true, confirmed: false, disputeOpened: true, disputeId: dispute.id, message: 'Dispute filed — host has 20 minutes to upload call evidence. If they fail, you get a refund automatically.' });
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

app.get('/api/response-rate/:hostId', async (req, res) => {
  try {
    const { hostId } = req.params;
    const { data: allPayments } = await supabase
      .from('payments').select('id').eq('target_user_id', hostId).eq('paystack_verified', true);
    if (!allPayments || allPayments.length === 0) {
      return res.json({ rate: null, responded: 0, total: 0 });
    }
    const paymentIds = allPayments.map(p => p.id);
    const { data: responded } = await supabase
      .from('call_confirmations').select('id')
      .in('payment_id', paymentIds).in('status', ['confirmed', 'auto_confirmed']);
    const total = allPayments.length;
    const respondedCount = responded?.length || 0;
    const rate = Math.round((respondedCount / total) * 100);
    return res.json({ rate, responded: respondedCount, total });
  } catch (err) {
    console.error('[ResponseRate] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/rating/:hostId', async (req, res) => {
  const { data, error } = await supabase.from('ratings')
    .select('rating').eq('host_id', req.params.hostId);
  if (error) return res.status(500).json({ error: error.message });
  const avg = data.length ? (data.reduce((a, r) => a + r.rating, 0) / data.length).toFixed(1) : 0;
  res.json({ average: parseFloat(avg), count: data.length });
});

app.get('/api/admin/withdrawable-balance', requireAdmin, async (req, res) => {
  try {
    const { data: payments } = await supabase
      .from('payments').select('platform_fee').eq('paystack_verified', true)
      .not('status', 'in', '("refunded","refunded_partial","failed","pending_init")');
    const { data: withdrawals } = await supabase
      .from('admin_withdrawals').select('amount').in('status', ['success', 'pending', 'otp']);
    const totalFees = (payments || []).reduce((a, p) => a + Number(p.platform_fee || 0), 0);
    const totalWithdrawn = (withdrawals || []).reduce((a, w) => a + Number(w.amount || 0), 0);
    const withdrawable = Math.max(0, totalFees - totalWithdrawn);
    return res.json({
      success: true,
      withdrawable: parseFloat(withdrawable.toFixed(2)),
      totalFees: parseFloat(totalFees.toFixed(2)),
      totalWithdrawn: parseFloat(totalWithdrawn.toFixed(2)),
    });
  } catch (err) {
    console.error('[WithdrawableBalance] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/withdraw', requireAdmin, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount < 1) return res.status(400).json({ error: 'Invalid amount' });

    const adminName = process.env.ADMIN_PAYOUT_NAME;
    const adminNumber = process.env.ADMIN_PAYOUT_NUMBER;
    const adminProvider = process.env.ADMIN_PAYOUT_PROVIDER;

    if (!adminName || !adminNumber || !adminProvider) {
      return res.status(500).json({ error: 'Admin payout details not configured' });
    }

    const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'ghipss',
        name: adminName,
        account_number: adminNumber,
        bank_code: adminProvider,
        currency: 'GHS',
      }),
    });
    const recipientData = await recipientRes.json();
    if (!recipientData.status) return res.status(400).json({ error: recipientData.message });

    const transferRes = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance',
        amount: Math.round(amount * 100),
        recipient: recipientData.data.recipient_code,
        reason: `ConnectCall admin withdrawal — ${new Date().toISOString()}`,
        currency: 'GHS',
      }),
    });
    const transferData = await transferRes.json();
    if (!transferData.status) return res.status(400).json({ error: transferData.message });

    await supabase.from('admin_withdrawals').insert([{
      amount,
      transfer_code: transferData.data.transfer_code,
      recipient_code: recipientData.data.recipient_code,
      status: transferData.data.status,
    }]);

    console.log(`[AdminWithdraw] GHS ${amount} initiated — ${transferData.data.transfer_code}`);
    return res.json({ success: true, transferCode: transferData.data.transfer_code, status: transferData.data.status });

  } catch (err) {
    console.error('[AdminWithdraw] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
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

// ─────────────────────────────────────────────────────────────────────────────
//  CRON JOBS
// ─────────────────────────────────────────────────────────────────────────────

cron.schedule('*/2 * * * *', async () => {
  try {
    const res = await fetch(`http://localhost:${PORT}/api/pay/call/check-expired`);
    const data = await res.json();
    if (data.expiredConfirmations || data.expiredFollowups || data.resolvedDisputes) {
      console.log(`[Cron] check-expired — confirmations: ${data.expiredConfirmations}, followups: ${data.expiredFollowups}, disputes: ${data.resolvedDisputes}`);
    }
  } catch (e) {
    console.error('[Cron] check-expired failed:', e.message);
  }
});

cron.schedule('*/30 * * * *', async () => {
  try {
    const res = await fetch(`http://localhost:${PORT}/api/call/check-expired`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (data.processed) {
      console.log(`[Cron] auto-confirmed ${data.processed} expired call confirmations`);
    }
  } catch (e) {
    console.error('[Cron] call check-expired failed:', e.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  EXPORTS (used internally by other service files)
// ─────────────────────────────────────────────────────────────────────────────

export { isNigerianNumber, toNigeriaIntl, processOPayPayout };