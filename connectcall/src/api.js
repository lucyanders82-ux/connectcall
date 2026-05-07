import { API_BASE, ADMIN_TOKEN } from "./constants";

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

export async function apiOnboardPayout(hostId, payoutName, payoutNumber, payoutProvider) {
  const res = await fetch(`${API_BASE}/api/host/onboard-payout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hostId, payoutName, payoutNumber, payoutProvider }),
  });
  return res.json();
}

export async function apiConfirmCall(confirmationId, watcherId, response) {
  const res = await fetch(`${API_BASE}/api/call/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmationId, watcherId, response }),
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

export async function apiWatcherRefund(paymentId, reason, watcherId) {
  const res = await fetch(`${API_BASE}/api/pay/watcher/refund`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentId, reason, watcherId }),
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

export async function apiAdminApproveRefund(refundId) {
  const res = await fetch(`${API_BASE}/api/admin/approve-refund`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
    body: JSON.stringify({ refundId }),
  });
  return res.json();
}