import { API_BASE, ADMIN_TOKEN } from "./constants";
import { supabase } from "./supabase";  // <-- ADD THIS LINE

// ── Payment ──
export async function apiInitializePayment(payload) {
  const res = await fetch(`${API_BASE}/api/pay/initialize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
  });
  return res.json();
}

export async function apiVerifyPayment(reference) {
  const res = await fetch(`${API_BASE}/api/pay/verify/${reference}`);
  return res.json();
}

// ── Admin ──
export async function apiConfirmPayment(paymentId) {
  const res = await fetch(`${API_BASE}/api/admin/confirm-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
    body: JSON.stringify({ paymentId }),
  });
  return res.json();
}

export async function apiReleaseFunds(callId, paymentId) {
  const res = await fetch(`${API_BASE}/api/admin/release-funds`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
    body: JSON.stringify({ callId, paymentId }),
  });
  return res.json();
}

export async function apiDenyRefund(refundId) {
  const res = await fetch(`${API_BASE}/api/admin/deny-refund`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
    body: JSON.stringify({ refundId }),
  });
  return res.json();
}

export async function apiAdminApproveRefund(refundId) {
  const res = await fetch(`${API_BASE}/api/admin/approve-refund`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
    body: JSON.stringify({ refundId }),
  });
  return res.json();
}

// ── Host ──
export async function apiOnboardPayout(hostId, payoutName, payoutNumber, payoutProvider) {
  const res = await fetch(`${API_BASE}/api/host/onboard-payout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hostId, payoutName, payoutNumber, payoutProvider }),
  });
  return res.json();
}

export async function apiHostApproveRefund(refundId, hostId) {
  const res = await fetch(`${API_BASE}/api/host/approve-refund`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refundId, hostId }),
  });
  return res.json();
}

// ── Call ──
export async function apiConfirmCall(confirmationId, watcherId, response) {
  const res = await fetch(`${API_BASE}/api/call/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmationId, watcherId, response }),
  });
  return res.json();
}

// ── Watcher Refund ──
export async function apiWatcherRefund(paymentId, reason, watcherId) {
  const res = await fetch(`${API_BASE}/api/pay/watcher/refund`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentId, reason, watcherId }),
  });
  return res.json();
}

// ─────────────────────────────────────────────────────
// NEW: Dispute, Evidence, Follow-up, & Expiry
// ─────────────────────────────────────────────────────

// Fetch dispute details + messages
export async function apiGetDispute(disputeId) {
  const res = await fetch(`${API_BASE}/api/pay/dispute/${disputeId}`);
  return res.json();
}

// Submit evidence (screenshot URL) — role: "host" or "watcher"
export async function apiSubmitEvidence(disputeId, userId, role, evidenceUrl) {
  const res = await fetch(`${API_BASE}/api/pay/dispute/submit-evidence`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ disputeId, userId, role, evidenceUrl }),
  });
  return res.json();
}

// Trigger AI verdict manually (admin only, or auto-called after both submit)
export async function apiTriggerAIVerdict(disputeId) {
  const res = await fetch(`${API_BASE}/api/pay/dispute/ai-verdict`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
    body: JSON.stringify({ disputeId }),
  });
  return res.json();
}

// Host requests follow-up after cancellation
export async function apiRequestFollowup(paymentId, hostId) {
  const res = await fetch(`${API_BASE}/api/pay/call/request-followup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentId, hostId }),
  });
  return res.json();
}

// Watcher accepts/declines follow-up
export async function apiAcceptFollowup(followupId, watcherId, accepted) {
  const res = await fetch(`${API_BASE}/api/pay/call/accept-followup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ followupId, watcherId, accepted }),
  });
  return res.json();
}

// Upload evidence file to Supabase Storage
export async function apiUploadEvidence(file, userId) {
  const path = `${userId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  const { data, error } = await supabase.storage
    .from('evidence')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;

  const { data: urlData, error: urlError } = await supabase.storage
    .from('evidence')
    .createSignedUrl(data.path, 60 * 60 * 24 * 7); // 7 days

  if (urlError) throw urlError;

  return urlData.signedUrl;
}

export async function apiInitiateCall(paymentId, hostId) {
  const res = await fetch(`${API_BASE}/api/call/initiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentId, hostId }),
  });
  return res.json();
}