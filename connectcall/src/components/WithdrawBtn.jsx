import { useState } from "react";
import { API_BASE, S, c } from "../constants";
import { Btn, Modal, Field, Spinner } from "./UI";

export function WithdrawBtn({ adminToken, toast }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [balance, setBalance] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  const fetchBalance = async () => {
    setLoadingBalance(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/withdrawable-balance`, {
        headers: { "x-admin-token": adminToken },
      });
      const data = await res.json();
      if (data.success) setBalance(data);
    } catch {
      toast("Could not load balance", "error");
    } finally {
      setLoadingBalance(false);
    }
  };

  const openModal = () => { setOpen(true); fetchBalance(); };

  const submit = async () => {
    const n = parseFloat(amount);
    if (!n || n < 1) { toast("Enter a valid amount", "error"); return; }
    if (balance && n > balance.withdrawable) { toast(`Max withdrawable is ${S}${balance.withdrawable}`, "error"); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
        body: JSON.stringify({ amount: n }),
      });
      const data = await res.json();
      if (!data.success) { toast(data.error || "Withdrawal failed", "error"); return; }
      toast(`Withdrawal initiated — ${data.transferCode} ✦`);
      setOpen(false); setAmount(""); setBalance(null);
    } catch {
      toast("Network error", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Btn small variant="green" onClick={openModal}>💸 Withdraw</Btn>
      {open && (
        <Modal onClose={() => { setOpen(false); setAmount(""); }} title="Withdraw Platform Fees">
          {loadingBalance ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}><Spinner /></div>
          ) : balance ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
                {[
                  ["Total Fees Earned",   `${S}${balance.totalFees.toFixed(2)}`,      c.goldL],
                  ["Already Withdrawn",   `${S}${balance.totalWithdrawn.toFixed(2)}`, c.sub],
                  ["Available Now",       `${S}${balance.withdrawable.toFixed(2)}`,   c.green],
                ].map(([l, v, col]) => (
                  <div key={l} style={{ background: c.surface, borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
                    <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 600, color: col }}>{v}</div>
                    <div style={{ color: c.sub, fontSize: 10, marginTop: 3 }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: `${c.gold}10`, border: `1px solid ${c.gold}30`, borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: c.sub }}>
                ⚠️ This only withdraws <strong style={{ color: c.text }}>your 20% platform fees</strong> — host earnings are separate and paid out automatically per call.
              </div>
              <Field
                label={`Amount to withdraw (GHS) — max ${S}${balance.withdrawable.toFixed(2)}`}
                value={amount}
                onChange={v => { const n = parseFloat(v); if (!v || n <= balance.withdrawable) setAmount(v); }}
                type="number"
                hint="Sent to your configured MoMo number on Render"
              />
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                {[25, 50, 100].map(pct => {
                  const val = parseFloat((balance.withdrawable * pct / 100).toFixed(2));
                  return (
                    <button key={pct} onClick={() => setAmount(String(val))} style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: `1px solid ${c.border}`, background: c.surface, color: c.sub, cursor: "pointer", fontSize: 12 }}>
                      {pct}% ({S}{val})
                    </button>
                  );
                })}
                <button onClick={() => setAmount(String(balance.withdrawable))} style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: `1px solid ${c.gold}`, background: c.goldD, color: c.goldL, cursor: "pointer", fontSize: 12 }}>
                  All
                </button>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <Btn variant="surface" onClick={() => { setOpen(false); setAmount(""); }} small>Cancel</Btn>
                <Btn variant="green" onClick={submit} full disabled={busy || !amount || parseFloat(amount) <= 0}>
                  {busy ? "Processing…" : `Withdraw ${S}${amount || "0"} →`}
                </Btn>
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", color: c.sub, padding: "20px 0" }}>
              Failed to load balance. <span style={{ color: c.gold, cursor: "pointer" }} onClick={fetchBalance}>Retry →</span>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}