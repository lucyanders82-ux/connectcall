import { useState, useEffect } from "react";
import { c, S, API_BASE } from "../constants";
import { normaliseUser } from "../utils";
import { Btn, Avatar, OnlineDot } from "../components/UI";
import { supabase } from "../supabase";

export function WatcherDashboardView({ user, users, payments, refundReqs, onRefundRequest, toast, setView, callConfirmations, onConfirmCall, favorites, toggleFavorite }) {
  const myPayments = payments.filter(p =>
    (p.watcher_id === user?.id || p.watcher_name?.toLowerCase() === user?.name?.toLowerCase())
    && p.status !== "poke" && p.status !== "pending_init" && p.status !== "failed"
  );

  const myPaymentIds = new Set(myPayments.map(p => p.id));

  const livePayments = myPayments.filter(p => {
    if (p.status !== "pending" && p.status !== "confirmed") return false;
    const conf = (callConfirmations || []).find(cc => cc.payment_id === p.id);
    if (conf && (conf.status === "confirmed" || conf.status === "auto_confirmed")) return false;
    const myRefund = refundReqs.find(r => r.payment_id === p.id);
    if (myRefund && (myRefund.status === "denied" || myRefund.status === "approved")) return false;
    return true;
  });

  const previousPayments = myPayments.filter(p => {
    if (p.status === "completed" || p.status === "refunded" || p.status === "refunded_partial") return true;
    const conf = (callConfirmations || []).find(cc => cc.payment_id === p.id);
    if (conf && (conf.status === "confirmed" || conf.status === "auto_confirmed")) return true;
    const myRefund = refundReqs.find(r => r.payment_id === p.id);
    if (myRefund && (myRefund.status === "approved" || myRefund.status === "denied")) return true;
    return false;
  });

  const pendingConfirmation = (callConfirmations || []).find(cc =>
    cc.status === "pending" && myPaymentIds.has(cc.payment_id)
  );

  const [ratedPayments,  setRatedPayments]  = useState([]);
  const [historyOpen,    setHistoryOpen]    = useState(false);
  const [savedFavorites, setSavedFavorites] = useState([]);
  const [confirmBusy,    setConfirmBusy]    = useState(false);

  useEffect(() => {
    if (user?.id) {
      supabase.from("favorites").select("*, users!favorites_host_id_fkey(*)").eq("watcher_id", user.id)
        .then(({ data }) => { if (data) setSavedFavorites(data); });
    }
  }, [user?.id]);

  // Notify watcher of resolved refunds (once)
  const resolvedRefunds = refundReqs.filter(r =>
    myPaymentIds.has(r.payment_id) &&
    (r.status === "approved" || r.status === "denied") &&
    !localStorage.getItem(`notified_refund_${r.id}`)
  );
  useEffect(() => {
    resolvedRefunds.forEach(r => {
      if (r.status === "approved") toast(`✅ Your refund for ${S}${r.refund_amount || ""} was approved — funds returned to you`, "success");
      else if (r.status === "denied") toast("❌ Your refund request was denied by admin", "error");
      localStorage.setItem(`notified_refund_${r.id}`, "1");
    });
  }, [refundReqs]);

  // ── PaymentCard ─────────────────────────────────────────────────────────────
  const PaymentCard = ({ p, isLive }) => {
    const host      = users.find(u => u.id === (p.target_user_id || p.targetUserId));
    const myRefund  = refundReqs.find(r => r.payment_id === p.id);
    const myConf    = (callConfirmations || []).find(cc => cc.payment_id === p.id);
    const isDone    = p.status === "completed" || myConf?.status === "confirmed" || myConf?.status === "auto_confirmed";
    const [confirming, setConfirming] = useState(false);
    const [refunding,  setRefunding]  = useState(false);
    const [secondsLeft, setSecondsLeft] = useState(null);

    useEffect(() => {
      if (p.status !== "confirmed" || !p.contact_revealed_at || myRefund || myConf || isDone) { setSecondsLeft(null); return; }
      const revealedAt = new Date(p.contact_revealed_at).getTime();
      const WINDOW_MS  = 3 * 60 * 1000;
      const tick = () => setSecondsLeft(Math.max(0, Math.round((revealedAt + WINDOW_MS - Date.now()) / 1000)));
      tick();
      const interval = setInterval(tick, 1000);
      return () => clearInterval(interval);
    }, [p.contact_revealed_at, p.status, myRefund, myConf, isDone]);

    const formatCountdown = s => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

    const canCancel      = p.status === "pending" && !myConf && !myRefund;
    const canEarlyRefund = p.status === "confirmed" && !myRefund && !myConf && !isDone && secondsLeft !== null && secondsLeft > 0;
    const canDispute     = myConf?.status === "pending" && !isDone && !myRefund;

    return (
      <div style={{
        borderRadius: 14, background: `linear-gradient(135deg,${c.card},#1a1a24)`,
        border: `1px solid ${isDone ? c.green : p.status === "refunded" || p.status === "refunded_partial" ? c.red : myRefund?.status === "denied" ? c.red : p.status === "confirmed" ? c.gold : c.border}`,
        overflow: "hidden", marginBottom: isLive ? 0 : 10,
      }}>
        <div style={{ padding: "16px 18px" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar user={host} size={40} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{host?.name || "Host"}</div>
                <div style={{ fontSize: 11, color: c.sub }}>{new Date(p.created_at || p.ts).toLocaleString()}</div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: c.goldL, fontWeight: 600 }}>{S}{p.total_charged || p.amount}</div>
              <div style={{ fontSize: 11, fontWeight: 600, marginTop: 2, color: isDone ? c.green : p.status === "pending" ? "#facc15" : p.status === "confirmed" ? c.gold : p.status === "refunded" || p.status === "refunded_partial" ? c.red : myRefund?.status === "denied" ? c.red : c.sub }}>
                {isDone ? "✅ Call complete" : p.status === "pending" ? "🟡 Awaiting confirmation" : p.status === "confirmed" ? "🟢 Confirmed — contact revealed" : p.status === "refunded" ? "↩ Refunded" : p.status === "refunded_partial" ? "↩ Partially refunded" : p.status}
              </div>
            </div>
          </div>

          {/* Pending info */}
          {p.status === "pending" && !isDone && (
            <div style={{ padding: "10px 14px", borderRadius: 8, background: c.surface, border: `1px solid ${c.border}`, fontSize: 12, color: c.sub }}>
              🔒 Waiting for payment to be confirmed. Contact will be revealed automatically.
            </div>
          )}

          {/* Host contact revealed */}
          {(p.status === "confirmed" || isDone) && p.host_contact_revealed && (() => {
            const number   = p.host_contact_revealed || "";
            const platform = p.host_platform_revealed || "WhatsApp";
            const digits   = number.replace(/\D/g, "");
            const intl     = digits.startsWith("0") ? "233" + digits.slice(1) : digits;
            const link     = platform === "Telegram" ? `https://t.me/+${intl}` : `https://wa.me/${intl}`;
            return (
              <div style={{ padding: "10px 14px", borderRadius: 8, background: `${c.green}10`, border: `1px solid ${c.green}30`, marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: c.green, marginBottom: 3 }}>✓ Host Contact</div>
                <a href={link} target="_blank" rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 10, background: platform === "Telegram" ? "#0088cc22" : "#25D36622", border: `1px solid ${platform === "Telegram" ? "#0088cc" : "#25D366"}`, textDecoration: "none", marginTop: 6 }}>
                  <span style={{ fontSize: 20 }}>{platform === "Telegram" ? "✈️" : "💬"}</span>
                  <div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 15, color: platform === "Telegram" ? "#0088cc" : "#25D366", fontWeight: 700 }}>{number}</div>
                    <div style={{ fontSize: 11, color: c.sub }}>Tap to call on {platform}</div>
                  </div>
                </a>
              </div>
            );
          })()}

          {/* Done state */}
          {isDone && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ padding: "10px 14px", borderRadius: 8, background: `${c.green}10`, marginBottom: 8 }}>
                <div style={{ color: c.green, fontWeight: 600, fontSize: 13 }}>✅ Call Complete — Thank you for using ConnectCall ✦</div>
                {myConf?.status === "auto_confirmed" && <div style={{ color: c.dim, fontSize: 11, marginTop: 4 }}>🤖 Auto-confirmed after timeout</div>}
              </div>
              {!ratedPayments.includes(p.id) && (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: c.sub }}>Rate your experience:</span>
                  {[1, 2, 3, 4, 5].map(star => (
                    <button key={star} onClick={async () => {
                      const res = await fetch(`${API_BASE}/api/rate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentId: p.id, watcherId: user?.id, hostId: p.target_user_id || p.targetUserId, rating: star }) });
                      if (res.ok) { setRatedPayments(prev => [...prev, p.id]); toast("Thanks for rating! ⭐"); }
                      else toast("Already rated", "error");
                    }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, padding: "0 1px" }}>⭐</button>
                  ))}
                </div>
              )}
              {ratedPayments.includes(p.id) && <div style={{ fontSize: 12, color: c.gold }}>⭐ Rated — thank you!</div>}
            </div>
          )}

          {/* Refund status */}
          {myRefund && (
            <div style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 10, background: myRefund.status === "approved" ? `${c.green}10` : myRefund.status === "denied" ? `${c.red}10` : `${c.orange}10` }}>
              {myRefund.status === "pending" || myRefund.status === "pending_host"
                ? <span style={{ color: c.orange, fontSize: 12 }}>⏳ Refund under review by admin</span>
                : myRefund.status === "approved"
                  ? <span style={{ color: c.green, fontSize: 12 }}>✅ Refund approved — funds returned to you</span>
                  : <span style={{ color: c.red,   fontSize: 12 }}>❌ Refund request denied by admin</span>}
            </div>
          )}

          {/* Live-only actions */}
          {isLive && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {canCancel && (
                <Btn small variant="orange" disabled={refunding} onClick={async () => { setRefunding(true); await onRefundRequest(p.id, "Cancelling request before contact revealed"); setRefunding(false); }}>
                  {refunding ? "Cancelling…" : "✕ Cancel (get 70% back)"}
                </Btn>
              )}

              {canEarlyRefund && (
                <div style={{ marginBottom: 8, width: "100%" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: c.orange }}>⏱ Host hasn't contacted you?</span>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 700, color: secondsLeft <= 30 ? c.red : c.orange }}>{formatCountdown(secondsLeft)}</span>
                  </div>
                  <Btn small variant="orange" disabled={refunding} onClick={async () => { setRefunding(true); await onRefundRequest(p.id, "Host contact revealed but host did not reach out in time"); setRefunding(false); }} full>
                    {refunding ? "Requesting…" : "↩ Host didn't contact me (70% refund)"}
                  </Btn>
                </div>
              )}

              {p.status === "confirmed" && !myRefund && !myConf && !isDone && secondsLeft === 0 && (
                <div style={{ padding: "12px 14px", borderRadius: 10, background: `${c.blue}15`, border: `1px solid ${c.blue}40`, marginTop: 8, width: "100%" }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: c.blue, marginBottom: 6 }}>⏱ Contact window closed</div>
                  <div style={{ fontSize: 12, color: c.sub, lineHeight: 1.6, marginBottom: 10 }}>The 3-minute window has passed. If the host never contacted you, you can request a refund — admin will review within 24 hours.</div>
                  <Btn small variant="orange" disabled={refunding} onClick={async () => { setRefunding(true); await onRefundRequest(p.id, "Host did not contact watcher after contact window closed"); setRefunding(false); }} full>
                    {refunding ? "Requesting…" : "↩ Request Refund — host didn't contact me"}
                  </Btn>
                </div>
              )}

              {canDispute && (
                <Btn small variant="red" disabled={refunding} onClick={async () => { setRefunding(true); await onRefundRequest(p.id, "Watcher disputed call completion"); setRefunding(false); }}>
                  {refunding ? "Filing…" : "✕ Dispute — call didn't happen"}
                </Btn>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ minHeight: "calc(100vh - 60px)", maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 32, marginBottom: 4 }}>My Dashboard</div>
      <div style={{ color: c.sub, fontSize: 13, marginBottom: 24 }}>Welcome back, {user?.name?.split(" ")[0]} ✦</div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, marginBottom: 28 }}>
        {[
          ["Calls Booked", myPayments.length, c.blue],
          ["Refunds", refundReqs.filter(r => r.status === "approved" && (r.watcher_id === user?.id || myPaymentIds.has(r.payment_id))).length, c.orange],
        ].map(([l, v, col]) => (
          <div key={l} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 14, padding: 18, textAlign: "center" }}>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "clamp(20px,5vw,28px)", fontWeight: 600, color: col }}>{v}</div>
            <div style={{ color: c.sub, fontSize: "clamp(9px,2vw,11px)", marginTop: 4 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Pending confirmation prompt */}
      {pendingConfirmation && (
        <div style={{ background: `linear-gradient(135deg,${c.gold}20,${c.goldD})`, border: `2px solid ${c.gold}`, borderRadius: 16, padding: 22, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <span style={{ fontSize: 26 }}>📞</span>
            <div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: c.goldL, fontWeight: 600 }}>Did the call happen?</div>
              <div style={{ color: c.sub, fontSize: 12, marginTop: 2 }}>Your host marked the call complete. Confirm to release payment.</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn variant="green" disabled={confirmBusy} onClick={async () => { setConfirmBusy(true); await onConfirmCall(pendingConfirmation.id, "yes"); setConfirmBusy(false); }} style={{ flex: 1 }}>{confirmBusy ? "Confirming…" : "Yes — Pay Host"}</Btn>
            <Btn variant="red"   disabled={confirmBusy} onClick={async () => { setConfirmBusy(true); await onConfirmCall(pendingConfirmation.id, "no");  setConfirmBusy(false); }} style={{ flex: 1 }}>{confirmBusy ? "Filing…" : "Dispute"}</Btn>
          </div>
        </div>
      )}

      {/* Saved favourites */}
      {savedFavorites.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, marginBottom: 12, color: c.goldL }}>❤️ Saved Consultants</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {savedFavorites.map(f => {
              const host = f.users || users.find(u => u.id === f.host_id);
              if (!host) return null;
              const h = normaliseUser(host);
              return (
                <div key={f.id} onClick={() => setView("browse")} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", transition: "all .2s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = c.gold}
                  onMouseLeave={e => e.currentTarget.style.borderColor = c.border}>
                  <Avatar user={h} size={34} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{h.name}</div>
                    <div style={{ color: c.sub, fontSize: 11 }}>{S}{h.rate}</div>
                  </div>
                  <OnlineDot on={h.online} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {myPayments.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px", background: `linear-gradient(135deg,${c.card},#1a1a24)`, border: `1px solid ${c.border}`, borderRadius: 18 }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🔮</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: c.goldL, marginBottom: 10 }}>Make your first booking</div>
          <div style={{ color: c.sub, fontSize: 14, lineHeight: 1.7, maxWidth: 320, margin: "0 auto 24px" }}>Browse our consultants and connect securely via Paystack escrow. Your payment is protected until the call is complete.</div>
          <Btn onClick={() => setView("browse")}>Browse Consultants ✦</Btn>
        </div>
      ) : (
        <>
          {livePayments.length > 0 ? (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.green, display: "inline-block", animation: "pulse 2s infinite" }} />
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: c.goldL }}>Live Request{livePayments.length > 1 ? "s" : ""} ({livePayments.length})</div>
              </div>
              {livePayments.map(p => <PaymentCard key={p.id} p={p} isLive />)}
            </div>
          ) : (
            <div style={{ padding: "14px 18px", borderRadius: 12, background: `${c.green}10`, border: `1px solid ${c.green}30`, marginBottom: 24, fontSize: 13, color: c.green }}>
              ✅ No active requests — all calls are complete.
            </div>
          )}

          {previousPayments.length > 0 && (
            <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 14, overflow: "hidden" }}>
              <div onClick={() => setHistoryOpen(o => !o)} style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.background = c.surface}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>📁</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Previous Calls</div>
                    <div style={{ color: c.sub, fontSize: 12 }}>{previousPayments.length} completed call{previousPayments.length !== 1 ? "s" : ""}</div>
                  </div>
                </div>
                <span style={{ color: c.sub, fontSize: 18 }}>{historyOpen ? "▲" : "▼"}</span>
              </div>
              {historyOpen && (
                <div style={{ padding: "0 12px 12px" }}>
                  {previousPayments.map(p => <PaymentCard key={p.id} p={p} isLive={false} />)}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}