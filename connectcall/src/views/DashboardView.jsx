import { useState, useRef, useEffect, useCallback } from "react";
import { c, S, PAYOUT_PROVIDERS, CURRENCY } from "../constants";
import { safeArr, normaliseUser } from "../utils";
import { Btn, Modal, Field, Avatar, Chip, OnlineDot, SectionHeader, PhotoPick, MultiPick, FolderCard, StatusBadge } from "../components/UI";
import { HostRating, HostResponseRate } from "../components/HostRating";
import { MarkDoneBtn } from "../components/MarkDoneBtn";
import { HostRefundRow } from "../components/HostRefundRow";
import { supabase } from "../supabase";

// ── Utility: build a WhatsApp/Telegram link from any number format ──────────
function buildContactLink(rawNumber, platform) {
  const digits = rawNumber.replace(/\D/g, "");
  let intl = digits;
  if (digits.startsWith("0") && digits.length === 10) intl = "233" + digits.slice(1);
  else if (digits.startsWith("0") && digits.length === 11) intl = "234" + digits.slice(1);
  return platform === "Telegram" ? `https://t.me/+${intl}` : `https://wa.me/${intl}`;
}

export function DashboardView({
  user, users, payments, calls, verifyPrompts, onMarkDone, onUpdate,
  onAnswerVerify, toast, setView, refundReqs, onHostApproveRefund,
  callConfirmations,
  disputes = [],
  followupReqs = [],
  onSubmitEvidence,
  onRequestFollowup,
}) {
  if (user?.role === "watcher") { setView("browse"); return null; }

  const [tab, setTab]             = useState("overview");
  const [editing, setEditing]     = useState(false);
  const [hostHistoryOpen, setHostHistoryOpen] = useState(false);
  const [editStep, setEditStep]   = useState(1);
  const [ef, setEf]               = useState({});
  const [busy, setBusy]           = useState(false);
  const [requestingFollowup, setRequestingFollowup] = useState({});
  const [markDoneCountdown, setMarkDoneCountdown]   = useState({});
  const [now, setNow]             = useState(Date.now());
  const [tipOpen, setTipOpen]     = useState(false);
  const [initiatedPayments, setInitiatedPayments]   = useState({});
  const MISSED_PREVIEW = 3;
  const [missedExpanded, setMissedExpanded] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const eu = k => v => setEf(x => ({ ...x, [k]: v }));

  const live    = normaliseUser(users.find(u => u.id === user.id) || user);
  const myPay   = payments.filter(x => x.target_user_id === user.id || x.targetUserId === user.id);
  const myCalls = calls.filter(cl => cl.target_user_id === user.id || cl.targetUserId === user.id);
  const myVP    = verifyPrompts.filter(v => !v.answered && myPay.some(p => p.id === v.payment_id || p.id === v.paymentId));
  const hostRefundReqs = refundReqs.filter(r => r.status === "pending_host" && myPay.some(p => p.id === r.payment_id));

  const missedReqs = myPay.filter(p => {
    if (p.status !== "refunded_partial" && p.status !== "cancelled") return false;
    const refund = refundReqs.find(r => r.payment_id === p.id);
    if (refund?.refund_type === "dispute_evidence" || refund?.refund_type === "auto_dispute") return false;
    if (refund?.refund_type === "host_rejected") return false;
    if (refund?.status === "approved") return false;
    const followup = followupReqs.find(f => f.payment_id === p.id);
    if (followup?.status === "accepted") return false;
    return true;
  });

  const liveReqs = myPay.filter(p => {
    if (p.status === "cancelled" || p.status === "refunded_partial") return false;
    if (p.status === "refunded") return false;
    if (p.status === "disputed") {
      const dispute = disputes.find(d => d.payment_id === p.id);
      if (dispute?.status === "resolved_host" || dispute?.status === "resolved_watcher") return false;
      return true;
    }
    if (p.status === "pending" || p.status === "confirmed") {
      const conf = (callConfirmations || []).find(cc => cc.payment_id === p.id);
      if (conf && (conf.status === "confirmed" || conf.status === "auto_confirmed")) return false;
      if (p.status === "completed") return false;
      return true;
    }
    return false;
  });

  const closedReqs = myPay.filter(p => {
    if (p.status === "completed" || p.status === "refunded" || p.status === "refunded_partial" || p.status === "cancelled") return true;
    const conf = (callConfirmations || []).find(cc => cc.payment_id === p.id);
    if (conf && (conf.status === "confirmed" || conf.status === "auto_confirmed")) return true;
    return false;
  });

  const startEdit = () => {
    setEf({ ...live, tags: safeArr(live.tags).join(", "), photos: safeArr(live.photos), payoutName: live.payoutName || live.name, payoutNumber: live.payoutNumber || "", payoutProvider: live.payoutProvider || "MTN" });
    setEditStep(1); setEditing(true);
  };

  const save = async () => { setBusy(true); await onUpdate({ ...ef, id: live.id, tags: safeArr(ef.tags), photos: safeArr(ef.photos) }); setBusy(false); setEditing(false); };

  // ── Dispute Banner ─────────────────────────────────────────────────────────
  const DisputeBanner = ({ dispute, payment }) => {
    const statusLabels = {
      open:               { icon: "⚠️", text: "Watcher disputes your call — upload evidence now", color: c.orange },
      watcher_evidence:   { icon: "📤", text: "Evidence submitted — waiting for watcher response", color: c.gold },
      ai_verdict_pending: { icon: "🧠", text: "AI is analysing both screenshots…", color: c.blue },
      resolved_host:      { icon: "🏆", text: "Resolved in your favor — payment released", color: c.green },
      resolved_watcher:   { icon: "💸", text: "Resolved in watcher's favor — refund processed", color: c.red },
      escalated_admin:    { icon: "🔍", text: "Escalated to admin — decision within 24hrs", color: c.orange },
    };
    const s = statusLabels[dispute?.status] || statusLabels.open;
    return (
      <div style={{ padding: "14px 16px", borderRadius: 16, marginBottom: 12, marginTop: 8, background: `${s.color}15`, border: `2px solid ${s.color}40` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 20 }}>{s.icon}</span>
          <span style={{ fontWeight: 600, fontSize: 14, color: s.color }}>{s.text}</span>
        </div>
        {dispute?.ai_analysis && (
          <div style={{ fontSize: 12, color: c.sub, marginBottom: 8, lineHeight: 1.5 }}>{dispute.ai_analysis}</div>
        )}
        {dispute?.status === "open" && !dispute?.host_evidence_url &&
         !["resolved_host","resolved_watcher","escalated_admin"].includes(dispute?.status) && (
          <div>
            <div style={{ fontSize: 12, color: c.sub, marginBottom: 8 }}>
              Upload a screenshot of your call log showing the outgoing call to {payment?.watcher_contact || "the watcher"}. You have 20 minutes.
            </div>
            <HostEvidenceUpload disputeId={dispute.id} />
          </div>
        )}
        {(dispute?.status === "resolved_host" || dispute?.status === "resolved_watcher") && (
          <div style={{ fontSize: 12, color: c.sub }}>
            Resolved {dispute.resolved_by === "ai" ? "automatically by AI" : "by admin"} —{" "}
            {dispute.resolved_by === "ai" ? `AI confidence: ${dispute.ai_confidence}%` : "Manual review completed"}
          </div>
        )}
      </div>
    );
  };

  // ── Host Evidence Upload ───────────────────────────────────────────────────
  const HostEvidenceUpload = ({ disputeId }) => {
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = useRef(null);
    const handleFilePick = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) { toast('Please upload an image file', 'error'); return; }
      if (file.size > 10 * 1024 * 1024) { toast('File too large — max 10MB', 'error'); return; }
      setUploading(true); setUploadProgress(0);
      const progressInterval = setInterval(() => { setUploadProgress(prev => prev < 85 ? prev + 12 : prev); }, 200);
      try {
        const { apiUploadEvidence } = await import('../api.js');
        const url = await apiUploadEvidence(file, user?.id);
        clearInterval(progressInterval); setUploadProgress(100);
        await onSubmitEvidence(disputeId, user?.id, 'host', url);
        toast('Evidence submitted — watcher will be notified', 'success');
      } catch (e) {
        clearInterval(progressInterval); setUploadProgress(0);
        toast('Failed to upload: ' + (e.message || 'Unknown error'), 'error');
      }
      setUploading(false);
    };
    return (
      <>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFilePick} />
        <Btn small variant="blue" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
          {uploading ? 'Uploading…' : '📎 Upload Call Log Screenshot'}
        </Btn>
        {uploading && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: c.sub, marginBottom: 4 }}>
              <span>Uploading screenshot…</span><span>{uploadProgress}%</span>
            </div>
            <div style={{ height: 4, borderRadius: 999, background: c.surface, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${uploadProgress}%`, background: `linear-gradient(90deg, ${c.blue}, #60a5fa)`, borderRadius: 999, transition: 'width 0.2s ease' }} />
            </div>
          </div>
        )}
      </>
    );
  };

  // ── Follow-up Banner ──────────────────────────────────────────────────────
  const FollowupBanner = ({ followup }) => {
    if (followup?.status === "expired") return (
      <div style={{ padding: "10px 14px", borderRadius: 12, background: `${c.sub}15`, fontSize: 12, color: c.sub, marginTop: 8 }}>
        ⏰ Follow-up request expired — watcher didn't respond
      </div>
    );
    if (followup?.status === "declined") return (
      <div style={{ padding: "10px 14px", borderRadius: 12, background: `${c.red}10`, fontSize: 12, color: c.red, marginTop: 8 }}>
        ✕ Watcher declined follow-up — refund is final
      </div>
    );
    if (followup?.status === "accepted") return (
      <div style={{ padding: "10px 14px", borderRadius: 12, background: `${c.green}10`, fontSize: 12, color: c.green, marginTop: 8 }}>
        ✅ Follow-up accepted — contact re-revealed. Call now!
      </div>
    );
    return (
      <div style={{ padding: "10px 14px", borderRadius: 12, background: `${c.blue}10`, fontSize: 12, color: c.blue, marginTop: 8 }}>
        ⏳ Follow-up request sent — waiting for watcher to respond…
      </div>
    );
  };

  // ── Missed count for badge ─────────────────────────────────────────────────
  const missedBadgeCount = myPay.filter(p => {
    if (p.status !== "refunded_partial" && p.status !== "cancelled") return false;
    const refund = refundReqs.find(r => r.payment_id === p.id);
    if (refund?.status === "approved") return false;
    if (refund?.refund_type === "dispute_evidence" || refund?.refund_type === "auto_dispute") return false;
    if (refund?.refund_type === "host_rejected") return false;
    return !followupReqs.find(f => f.payment_id === p.id && f.status === "accepted");
  }).length;

  return (
    <div style={{ minHeight: "calc(100vh - 60px)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>

        {/* Verification requests */}
        {myVP.length > 0 && (
          <div style={{ background: `${c.gold}18`, border: `1px solid ${c.gold}`, borderRadius: 20, padding: 18, marginBottom: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 10, color: c.goldL }}>⚠ Admin Verification Request</div>
            {myVP.map(vp => (
              <div key={vp.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{ color: c.sub, fontSize: 13, flex: 1 }}>Did the call take place?</span>
                <Btn variant="green" small onClick={() => onAnswerVerify(vp.id, true)}>Yes</Btn>
                <Btn variant="red"   small onClick={() => onAnswerVerify(vp.id, false)}>Dispute</Btn>
              </div>
            ))}
          </div>
        )}

        {/* Host refund requests */}
        {hostRefundReqs.length > 0 && (
          <div style={{ background: `${c.orange}15`, border: `1px solid ${c.orange}`, borderRadius: 20, padding: 18, marginBottom: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 10, color: c.orange }}>↩ Refund Requests Awaiting Your Approval</div>
            {hostRefundReqs.map(r => <HostRefundRow key={r.id} r={r} onHostApproveRefund={onHostApproveRefund} />)}
          </div>
        )}

        {/* Tabs — pill switcher */}
        <div style={{ display: "flex", gap: 4, marginBottom: 28, background: c.surface, padding: 5, borderRadius: 999, width: "fit-content", flexWrap: "wrap" }}>
          {["overview", "requests", "missed", "manage profile"].map(t => {
            const badge = t === "requests" ? liveReqs.length : t === "missed" ? missedBadgeCount : 0;
            return (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: "8px 20px", borderRadius: 999, border: "none", cursor: "pointer",
                background: tab === t ? c.card : "transparent",
                color: tab === t ? c.goldL : c.sub,
                fontSize: 12, fontWeight: 600,
                fontFamily: "'Montserrat',sans-serif",
                textTransform: "capitalize", position: "relative",
                transition: "all .2s",
                boxShadow: tab === t ? `0 2px 12px #00000040` : "none",
              }}>
                {t}
                {badge > 0 && (
                  <span style={{
                    position: "absolute", top: 3, right: 3,
                    background: c.red, color: "#fff",
                    fontSize: 9, fontWeight: 700,
                    padding: "1px 5px", borderRadius: 999,
                    minWidth: 16, textAlign: "center",
                  }}>{badge}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Overview ── */}
        {tab === "overview" && (
          <div className="fu">
            {/* Profile card */}
            <div style={{ background: `linear-gradient(135deg,${c.card},#1a1a24)`, border: `1px solid ${c.border}`, borderRadius: 24, padding: 28, marginBottom: 18, display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
              <Avatar user={live} size={76} ring />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 4 }}>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 600 }}>{live.name}</div>
                  <OnlineDot on={live.online} />
                </div>
                <div style={{ color: c.sub, fontSize: 14, marginBottom: 10 }}>{live.bio}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{safeArr(live.tags).map(t => <Chip key={t} label={t} />)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 30, color: c.goldL, fontWeight: 600 }}>{S}{live.rate}</div>
                <div style={{ color: c.sub, fontSize: 11 }}>per call via {live.platform}</div>
              </div>
            </div>

            {/* Status pills — float, no box */}
            <div style={{ marginBottom: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 16px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                background: live.paystackRecipientCode ? `${c.green}18` : `${c.orange}18`,
                color: live.paystackRecipientCode ? c.green : c.orange,
                border: `1px solid ${live.paystackRecipientCode ? c.green : c.orange}40`,
              }}>
                {live.paystackRecipientCode ? "✅ Payout Active" : "⚠️ Payout Incomplete"}
              </span>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 16px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                background: `${c.green}18`, color: c.green,
                border: `1px solid ${c.green}40`,
              }}>
                💰 Wallet: {S}{Number(live.wallet || 0).toFixed(2)}
              </span>
            </div>

            {/* How to get paid tip */}
            <div style={{ background: `${c.blue}10`, border: `1px solid ${c.blue}30`, borderRadius: 20, marginBottom: 16, overflow: "hidden" }}>
              <div onClick={() => setTipOpen(o => !o)} style={{ padding: "12px 18px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <span style={{ fontSize: 18 }}>💡</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: c.blue, flex: 1 }}>How to get paid</span>
                <span style={{ fontSize: 12, color: c.blue }}>{tipOpen ? "▲" : "▼"}</span>
              </div>
              {tipOpen && (
                <div style={{ padding: "0 18px 16px", fontSize: 13, color: c.sub, lineHeight: 1.7 }}>
                  Go to <strong style={{ color: c.text }}>Requests</strong> and <strong style={{ color: c.text }}>tap the contact link</strong> to call the watcher. You <strong style={{ color: c.text }}>must click the link</strong> — this records that you initiated the call. Then mark done to trigger your payout. Skipping causes an auto-refund.
                </div>
              )}
            </div>

            {/* Share profile */}
            <div style={{ background: `linear-gradient(135deg,${c.gold}08,${c.goldD})`, border: `1px solid ${c.gold}40`, borderRadius: 20, marginBottom: 20, overflow: "hidden" }}>
              <div style={{ padding: "12px 18px", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>🔗</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: c.goldL, flex: 1 }}>Share Your Profile</span>
                <Btn small onClick={() => { const link = `${window.location.origin}/?host=${encodeURIComponent(live.name)}`; navigator.clipboard.writeText(link); toast("Profile link copied! 📋"); }}>📋 Copy Link</Btn>
              </div>
            </div>

            {/* Stat cards — number floats, label underneath, no inner box */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                ["Payments Received", myPay.filter(p => p.paystack_verified).length, c.green],
                ["Calls Completed",   myCalls.length,                                 c.blue],
              ].map(([l, v, col]) => (
                <div key={l} style={{
                  background: c.card,
                  border: `1px solid ${c.border}`,
                  borderRadius: 20,
                  padding: "24px 24px 20px",
                }}>
                  {/* Floating number — no box around it */}
                  <div style={{
                    fontFamily: "'Cormorant Garamond',serif",
                    fontSize: 44, fontWeight: 600, color: col,
                    lineHeight: 1, marginBottom: 8,
                  }}>{v}</div>
                  <div style={{ color: c.sub, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Requests ── */}
        {tab === "requests" && (
          <div className="fu">
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, marginBottom: 18 }}>Incoming Requests</div>

            {myPay.filter(p => p.status !== "poke" && p.status !== "pending_init" && p.status !== "failed").length === 0
              ? <div style={{ color: c.sub, textAlign: "center", padding: "50px 0" }}>No requests yet.</div>
              : <>
                  {liveReqs.length > 0 ? (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.green, display: "inline-block", animation: "pulse 2s infinite" }} />
                        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, color: c.goldL }}>Live Requests ({liveReqs.length})</div>
                      </div>
                      {liveReqs.map(pay => {
                        const callDone = calls.find(cl => cl.payment_id === pay.id || cl.paymentId === pay.id);
                        const refund   = pay._refund   || refundReqs.find(r => r.payment_id === pay.id);
                        const conf     = pay._conf     || (callConfirmations || []).find(cc => cc.payment_id === pay.id);
                        const dispute  = pay._dispute  || disputes.find(d => d.payment_id === pay.id);
                        const followup = pay._followup || followupReqs.find(f => f.payment_id === pay.id);
                        const isDisputed  = pay.status === "disputed" || !!dispute;
                        const isCancelled = pay.status === "cancelled" || pay.status === "refunded_partial";
                        const hasInitiated = !!pay.call_initiated_at || !!initiatedPayments[pay.id];
                        const borderCol = isDisputed ? c.orange : isCancelled ? c.red : pay.status === "confirmed" ? c.gold : c.border;

                        return (
                          <div key={pay.id} style={{ borderRadius: 16, marginBottom: 12, overflow: "hidden", background: `linear-gradient(135deg,${c.card},#1a1a24)`, border: `1px solid ${borderCol}` }}>
                            <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${c.border}20` }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 16 }}>{isDisputed ? "⚡" : pay.status === "pending" ? "🔒" : pay.status === "confirmed" ? "🟢" : "📋"}</span>
                                <span style={{ fontWeight: 700, fontSize: 14 }}>{pay.status === "pending" ? "New Request" : pay.watcher_name || pay.watcherName}</span>
                                {pay.paystack_verified && (
                                  <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 999, background: `${c.green}20`, color: c.green, fontWeight: 700 }}>VERIFIED</span>
                                )}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, color: c.goldL, fontWeight: 600 }}>{S}{pay.total_charged || pay.amount}</span>
                                <span style={{ fontSize: 10, color: c.sub }}>{new Date(pay.created_at || pay.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                              </div>
                            </div>
                            <div style={{ padding: "12px 16px" }}>
                              {dispute  && <DisputeBanner dispute={dispute} payment={pay} />}
                              {followup && <FollowupBanner followup={followup} />}

                              {pay.status === "pending" && !isDisputed && (
                                <div style={{ padding: "8px 14px", borderRadius: 999, background: c.surface, fontSize: 12, color: c.sub, display: "inline-flex", alignItems: "center", gap: 6 }}>
                                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.orange, display: "inline-block", animation: "pulse 2s infinite" }} />
                                  Awaiting admin confirmation — contacts hidden
                                </div>
                              )}

                              {pay.status === "confirmed" && !isDisputed && !refund && (() => {
                                const number   = pay.watcher_contact || "";
                                const platform = pay.watcher_platform || "WhatsApp";
                                const link = buildContactLink(number, platform);
                                return (
                                  <div style={{ padding: 12, borderRadius: 14, background: `${c.green}10`, border: `1px solid ${c.green}30` }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: c.green, marginBottom: 6 }}>✓ Confirmed — Contacts Revealed</div>
                                    <a href={link} target="_blank" rel="noopener noreferrer"
                                      onClick={async () => {
                                        if (!hasInitiated) {
                                          setInitiatedPayments(prev => ({ ...prev, [pay.id]: true }));
                                          const { apiInitiateCall } = await import('../api.js');
                                          await apiInitiateCall(pay.id, live.id);
                                          const { data: pRows } = await supabase.from("payments").select("*").order("created_at", { ascending: false });
                                        }
                                      }}
                                      style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 12, background: platform === "Telegram" ? "#0088cc22" : "#25D36622", border: `1px solid ${platform === "Telegram" ? "#0088cc" : "#25D366"}`, textDecoration: "none", marginTop: 4 }}>
                                      <span style={{ fontSize: 20 }}>{platform === "Telegram" ? "✈️" : "💬"}</span>
                                      <div>
                                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 15, color: platform === "Telegram" ? "#0088cc" : "#25D366", fontWeight: 700 }}>{number}</div>
                                        <div style={{ fontSize: 11, color: c.sub }}>
                                          {hasInitiated ? "✓ Call initiated — tap to call again" : "Tap to initiate call on " + platform}
                                        </div>
                                      </div>
                                    </a>
                                    {hasInitiated && (() => {
                                      const initiatedAt = new Date(pay.call_initiated_at || initiatedPayments[pay.id]).getTime();
                                      const deadlineMs  = initiatedAt + 30 * 60 * 1000;
                                      const minsLeft    = Math.max(0, Math.round((deadlineMs - now) / 60000));
                                      const isUrgent    = minsLeft <= 10;
                                      return (
                                        <div style={{ marginTop: 8, padding: "8px 14px", borderRadius: 12, background: isUrgent ? `${c.red}15` : `${c.green}10`, border: `1px solid ${isUrgent ? c.red : c.green}30` }}>
                                          <div style={{ fontSize: 12, color: isUrgent ? c.red : c.green, fontWeight: 600 }}>
                                            {isUrgent ? "⚠️" : "✓"} Call initiated
                                          </div>
                                          <div style={{ fontSize: 11, color: c.sub, marginTop: 3 }}>
                                            {minsLeft > 0
                                              ? `Mark Done within ${minsLeft} min${minsLeft !== 1 ? "s" : ""} or booking will be auto-cancelled`
                                              : "⚠️ Deadline passed — booking may be cancelled soon"}
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                );
                              })()}

                              {conf && conf.status === "pending" && !isDisputed && (
                                <div style={{ marginTop: 8, padding: "8px 14px", borderRadius: 999, background: `${c.gold}10`, border: `1px solid ${c.gold}30`, fontSize: 12, color: c.goldL, display: "inline-flex", alignItems: "center", gap: 6 }}>
                                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.gold, display: "inline-block", animation: "pulse 2s infinite" }} />
                                  Awaiting watcher confirmation — payout pending
                                </div>
                              )}

                              {pay.status === "confirmed" && !callDone && !conf && !isDisputed && !refund && (
                                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                  <div style={{ flex: 1 }}>
                                    <MarkDoneBtn
                                      payId={pay.id}
                                      live={live}
                                      onMarkDone={async (...args) => {
                                        const result = await onMarkDone(...args);
                                        if (result?.secondsLeft) {
                                          let secs = result.secondsLeft;
                                          setMarkDoneCountdown(prev => ({ ...prev, [pay.id]: secs }));
                                          const t = setInterval(() => {
                                            secs -= 1;
                                            if (secs <= 0) { clearInterval(t); setMarkDoneCountdown(prev => { const n = { ...prev }; delete n[pay.id]; return n; }); }
                                            else setMarkDoneCountdown(prev => ({ ...prev, [pay.id]: secs }));
                                          }, 1000);
                                        }
                                        return result;
                                      }}
                                    />
                                    {markDoneCountdown[pay.id] > 0 && (
                                      <div style={{ marginTop: 8, padding: "8px 14px", borderRadius: 12, background: `${c.orange}15`, border: `1px solid ${c.orange}30` }}>
                                        <div style={{ fontSize: 12, color: c.orange, fontWeight: 600 }}>⏱ Wait {markDoneCountdown[pay.id]}s — call must be at least 2 minutes</div>
                                        <div style={{ height: 3, borderRadius: 999, background: c.surface, marginTop: 6, overflow: 'hidden' }}>
                                          <div style={{ height: '100%', width: `${(markDoneCountdown[pay.id] / 120) * 100}%`, background: c.orange, borderRadius: 999, transition: 'width 1s linear' }} />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  {!hasInitiated && (
                                    <Btn small variant="red"
                                      onClick={async () => {
                                        if (!window.confirm("Reject this request? The watcher will receive a 90% refund immediately.")) return;
                                        const { apiRejectRequest } = await import('../api.js');
                                        const result = await apiRejectRequest(pay.id, live.id);
                                        if (result.error) toast(result.error, "error");
                                        else toast(result.message, "success");
                                      }}>
                                      ✕ Reject
                                    </Btn>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ padding: "12px 18px", borderRadius: 999, background: `${c.green}10`, border: `1px solid ${c.green}30`, marginBottom: 20, fontSize: 13, color: c.green, display: "inline-flex", alignItems: "center", gap: 8 }}>
                      ✅ No active requests right now.
                    </div>
                  )}

                  {closedReqs.length > 0 && (
                    <FolderCard icon="📁" title="Previous Requests" subtitle={`${closedReqs.length} completed call${closedReqs.length !== 1 ? "s" : ""}`} count={closedReqs.length} accentColor={c.gold}>
                      {closedReqs.map(pay => {
                        const conf    = (callConfirmations || []).find(cc => cc.payment_id === pay.id);
                        const dispute = disputes.find(d => d.payment_id === pay.id);
                        const histStatus =
                          pay.status === "completed" || conf?.status === "confirmed" || conf?.status === "auto_confirmed" || dispute?.status === "resolved_host"
                            ? { label: "✅ Done",          color: c.green }
                          : pay.status === "refunded"
                            ? { label: "↩ Refunded",       color: c.red }
                          : pay.status === "refunded_partial" || pay.status === "cancelled"
                            ? { label: "↩ Partial refund", color: c.red }
                          : dispute?.status === "resolved_watcher"
                            ? { label: "❌ Dispute lost",  color: c.red }
                          : { label: "Done",               color: c.sub };
                        return (
                          <div key={pay.id} style={{ padding: "12px 14px", borderRadius: 14, marginBottom: 8, background: c.surface, border: `1px solid ${c.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{pay.watcher_name}</div>
                              <div style={{ fontSize: 10, color: c.sub, marginTop: 2 }}>
                                {new Date(pay.created_at || pay.ts).toLocaleDateString()}
                                {conf?.status === "auto_confirmed"   ? " · 🤖 Auto-confirmed" : ""}
                                {dispute?.resolved_by === "ai"       ? " · 🧠 AI verdict"     : dispute?.resolved_by === "admin" ? " · Admin decision" : ""}
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 17, color: c.goldL }}>{S}{pay.total_charged || pay.amount}</span>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 999, background: `${histStatus.color}18`, color: histStatus.color }}>{histStatus.label}</span>
                            </div>
                          </div>
                        );
                      })}
                    </FolderCard>
                  )}
                </>
            }
          </div>
        )}

        {/* ── Missed Requests ── */}
        {tab === "missed" && (
          <div className="fu">
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, marginBottom: 6 }}>Missed Requests</div>
            <div style={{ color: c.sub, fontSize: 13, marginBottom: 20 }}>Bookings you missed — request a follow-up to retry the call.</div>

            {missedReqs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 24px", background: c.card, border: `1px solid ${c.border}`, borderRadius: 24 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
                <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, color: c.goldL }}>No missed requests</div>
                <div style={{ color: c.sub, fontSize: 13, marginTop: 8 }}>You haven't missed any bookings.</div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {(missedExpanded ? missedReqs : missedReqs.slice(0, MISSED_PREVIEW)).map(pay => {
                    const followup = followupReqs.find(f => f.payment_id === pay.id);
                    const refund   = refundReqs.find(r => r.payment_id === pay.id);
                    return (
                      <div key={pay.id} style={{ padding: 20, borderRadius: 20, background: `linear-gradient(135deg,${c.card},#1a1a24)`, border: `1px solid ${c.red}40` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 15 }}>{pay.watcher_name}</div>
                            <div style={{ fontSize: 11, color: c.sub, marginTop: 2 }}>{new Date(pay.created_at || pay.ts).toLocaleString()}</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: c.goldL }}>{S}{pay.total_charged || pay.amount}</div>
                            <div style={{ fontSize: 11, color: c.red, marginTop: 2 }}>↩ Refunded {refund?.refund_percentage || 95}%</div>
                          </div>
                        </div>

                        {/* Progress steps */}
                        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                          {[
                            { label: "Booked",           done: true },
                            { label: "Contact Revealed", done: true },
                            { label: "Call Made",        done: false },
                            { label: "Resolved",         done: false },
                          ].map((step, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <div style={{ width: 20, height: 20, borderRadius: "50%", background: step.done ? c.green : c.surface, border: `2px solid ${step.done ? c.green : c.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: step.done ? "#fff" : c.dim }}>
                                {step.done ? "✓" : "○"}
                              </div>
                              <span style={{ fontSize: 10, color: step.done ? c.green : c.dim }}>{step.label}</span>
                              {i < 3 && <span style={{ color: c.border, fontSize: 10 }}>→</span>}
                            </div>
                          ))}
                        </div>

                        {!followup && (
                          <div style={{ background: `${c.blue}10`, border: `1px solid ${c.blue}30`, borderRadius: 16, padding: "14px 16px" }}>
                            <div style={{ fontSize: 13, color: c.blue, fontWeight: 600, marginBottom: 4 }}>🔄 Want to retry this call?</div>
                            <div style={{ fontSize: 12, color: c.sub, marginBottom: 10 }}>Send a follow-up request — the watcher has 10 minutes to accept and their contact will be revealed again.</div>
                            <Btn small variant="blue" disabled={requestingFollowup[pay.id]}
                              onClick={async () => {
                                setRequestingFollowup(prev => ({ ...prev, [pay.id]: true }));
                                await onRequestFollowup(pay.id);
                                setRequestingFollowup(prev => ({ ...prev, [pay.id]: false }));
                              }}>
                              {requestingFollowup[pay.id] ? "Sending…" : "🔄 Request Follow-up Call"}
                            </Btn>
                          </div>
                        )}

                        {followup?.status === "pending"  && <div style={{ padding: "10px 14px", borderRadius: 12, background: `${c.blue}10`,  fontSize: 12, color: c.blue,  marginTop: 8 }}>⏳ Follow-up sent — waiting for watcher to respond (10 min window)…</div>}
                        {followup?.status === "accepted" && <div style={{ padding: "10px 14px", borderRadius: 12, background: `${c.green}10`, fontSize: 12, color: c.green, marginTop: 8 }}>✅ Follow-up accepted — go to Requests tab to make the call</div>}
                        {followup?.status === "declined" && <div style={{ padding: "10px 14px", borderRadius: 12, background: `${c.red}10`,   fontSize: 12, color: c.red,   marginTop: 8 }}>✕ Watcher declined — refund is final</div>}
                        {followup?.status === "expired"  && <div style={{ padding: "10px 14px", borderRadius: 12, background: `${c.sub}15`,   fontSize: 12, color: c.sub,   marginTop: 8 }}>⏰ Follow-up expired — watcher didn't respond</div>}
                      </div>
                    );
                  })}
                </div>

                {/* See more / collapse — pill button */}
                {missedReqs.length > MISSED_PREVIEW && (
                  <button
                    onClick={() => setMissedExpanded(o => !o)}
                    style={{
                      marginTop: 12, width: "100%", padding: "13px 20px",
                      borderRadius: 999,
                      border: `1px solid ${c.border}`, background: "transparent",
                      color: c.sub, cursor: "pointer", fontSize: 13,
                      fontFamily: "'Montserrat',sans-serif",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      transition: "all .2s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = c.gold; e.currentTarget.style.color = c.goldL; e.currentTarget.style.background = `${c.gold}08`; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.color = c.sub; e.currentTarget.style.background = "transparent"; }}
                  >
                    {missedExpanded
                      ? <><span>▲</span> Show less</>
                      : <><span>▼</span> See {missedReqs.length - MISSED_PREVIEW} more missed request{missedReqs.length - MISSED_PREVIEW !== 1 ? "s" : ""}</>
                    }
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Manage Profile ── */}
        {tab === "manage profile" && (
          <div className="fu">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22 }}>Manage Profile</div>
              {!editing
                ? <Btn small onClick={startEdit}>Edit Profile</Btn>
                : <div style={{ display: "flex", gap: 8 }}>
                    <Btn small variant="green" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Btn>
                    <Btn small variant="surface" onClick={() => setEditing(false)}>Cancel</Btn>
                  </div>
              }
            </div>
            <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 24, padding: 28 }}>
              {!editing ? (
                <>
                  <div style={{ display: "flex", gap: 18, alignItems: "center", marginBottom: 22 }}>
                    <Avatar user={live} size={78} ring />
                    <div>
                      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 600 }}>{live.name}</div>
                      <div style={{ color: c.sub, fontSize: 14 }}>{live.bio}</div>
                    </div>
                  </div>
                  {safeArr(live.photos).length > 0 && (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ color: c.sub, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Gallery</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {safeArr(live.photos).map((src, i) => <img key={i} src={src} alt="" style={{ width: 96, height: 96, borderRadius: 14, objectFit: "cover" }} />)}
                      </div>
                    </div>
                  )}
                  <div style={{ borderTop: `1px solid ${c.border}`, paddingTop: 20 }}>
                    <SectionHeader icon="🔒" title="Payout Information" />
                    <div style={{ color: c.sub, fontSize: 13, lineHeight: 2.1 }}>
                      <div>Provider: <strong style={{ color: c.text }}>{live.payoutProvider || "Not set"}</strong></div>
                      <div>Number:   <strong style={{ color: c.goldL }}>{live.payoutNumber  || "Not set"}</strong></div>
                      <div>Status:   <strong style={{ color: live.paystackRecipientCode ? c.green : c.orange }}>{live.paystackRecipientCode ? "Active ✓" : "Not configured"}</strong></div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Edit step tabs — pill style */}
                  <div style={{ display: "flex", gap: 4, marginBottom: 20, background: c.surface, padding: 4, borderRadius: 999, width: "fit-content" }}>
                    {["Public Info", "Payout Info"].map((s, i) => (
                      <button key={s} onClick={() => setEditStep(i + 1)} style={{
                        padding: "7px 18px", borderRadius: 999, border: "none", cursor: "pointer",
                        background: editStep === i + 1 ? c.card : "transparent",
                        color: editStep === i + 1 ? c.goldL : c.sub,
                        fontSize: 11, fontWeight: 600, fontFamily: "'Montserrat',sans-serif",
                        transition: "all .2s",
                      }}>{s}</button>
                    ))}
                  </div>
                  {editStep === 1 ? (
                    <>
                      <PhotoPick label="Profile Photo" value={ef.profilePhoto} onChange={eu("profilePhoto")} circle />
                      <Field label="Username"           value={ef.name    || ""} onChange={eu("name")} />
                      <Field label="Bio"                value={ef.bio     || ""} onChange={eu("bio")} rows={3} />
                      <Field label="Platform"           value={ef.platform || "WhatsApp"} onChange={eu("platform")} options={["WhatsApp", "Telegram"]} />
                      <Field label="Contact"            value={ef.contactNumber || ""} onChange={eu("contactNumber")} maxLength={10} type="tel" />
                      <Field label={`Rate (${CURRENCY})`} value={ef.rate  || ""} onChange={eu("rate")} type="number" />
                      <Field label="Tags"               value={typeof ef.tags === "string" ? ef.tags : safeArr(ef.tags).join(", ")} onChange={eu("tags")} />
                      <MultiPick label="Gallery" value={safeArr(ef.photos)} onChange={eu("photos")} max={4} />
                    </>
                  ) : (
                    <>
                      <SectionHeader icon="🔒" title="Payout Info" subtitle="Private — never shown to watchers" />
                      <Field label="Payout Name"   value={ef.payoutName     || ""} onChange={eu("payoutName")} />
                      <Field label="Payout Number" value={ef.payoutNumber   || ""} onChange={eu("payoutNumber")} type="tel" maxLength={11} />
                      <Field label="Provider"      value={ef.payoutProvider || "MTN"} onChange={eu("payoutProvider")} options={PAYOUT_PROVIDERS} />
                      {ef.payoutProvider === "OPay" && (
                        <div style={{ fontSize: 12, color: c.blue, padding: "8px 14px", borderRadius: 12, background: `${c.blue}10`, marginTop: -8, marginBottom: 16 }}>
                          📱 Nigerian OPay number — enter your 11-digit Nigerian number (e.g. 08012345678)
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}