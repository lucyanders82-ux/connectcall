import { useState, useRef } from "react";
import { c, S, PAYOUT_PROVIDERS, CURRENCY } from "../constants";
import { safeArr, normaliseUser } from "../utils";
import { Btn, Modal, Field, Avatar, Chip, OnlineDot, SectionHeader, PhotoPick, MultiPick } from "../components/UI";
import { HostRating, HostResponseRate } from "../components/HostRating";
import { MarkDoneBtn } from "../components/MarkDoneBtn";
import { HostRefundRow } from "../components/HostRefundRow";
import { supabase } from "../supabase";

export function DashboardView({
  user, users, payments, calls, verifyPrompts, onMarkDone, onUpdate,
  onAnswerVerify, toast, setView, refundReqs, onHostApproveRefund,
  callConfirmations,
  disputes = [],              // NEW
  followupReqs = [],          // NEW
  onSubmitEvidence,           // NEW
  onRequestFollowup,          // NEW
}) {
  if (user?.role === "watcher") { setView("browse"); return null; }

  const [tab, setTab]             = useState("overview");
  const [editing, setEditing]     = useState(false);
  const [hostHistoryOpen, setHostHistoryOpen] = useState(false);
  const [editStep, setEditStep]   = useState(1);
  const [ef, setEf]               = useState({});
  const [busy, setBusy]           = useState(false);
  const [requestingFollowup, setRequestingFollowup] = useState({}); // NEW: per-payment loading state
  const eu = k => v => setEf(x => ({ ...x, [k]: v }));

  const live    = normaliseUser(users.find(u => u.id === user.id) || user);
  const myPay   = payments.filter(x => x.target_user_id === user.id || x.targetUserId === user.id);
  const myCalls = calls.filter(cl => cl.target_user_id === user.id || cl.targetUserId === user.id);
  const myVP    = verifyPrompts.filter(v => !v.answered && myPay.some(p => p.id === v.payment_id || p.id === v.paymentId));
  const hostRefundReqs = refundReqs.filter(r => r.status === "pending_host" && myPay.some(p => p.id === r.payment_id));

  const liveReqs = myPay.filter(p => {
    if (p.status === "disputed") {
      // Only show in live if dispute is still unresolved
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

  // ── Dispute Banner for Host ────────────────────────────────────────────────
  const DisputeBanner = ({ dispute, payment }) => {
    const statusLabels = {
  open:              { icon: "⚠️", text: "Watcher disputes your call — upload evidence now", color: c.orange },
  watcher_evidence:  { icon: "📤", text: "Evidence submitted — waiting for watcher response", color: c.gold },
  ai_verdict_pending:{ icon: "🧠", text: "AI is analysing both screenshots…", color: c.blue },
  resolved_host:     { icon: "🏆", text: "Resolved in your favor — payment released", color: c.green },
  resolved_watcher:  { icon: "💸", text: "Resolved in watcher's favor — refund processed", color: c.red },
  escalated_admin:   { icon: "🔍", text: "Escalated to admin — decision within 24hrs", color: c.orange },
};
    const s = statusLabels[dispute?.status] || statusLabels.open;

    return (
      <div style={{
        padding: "14px 16px", borderRadius: 12, marginBottom: 12, marginTop: 8,
        background: `${s.color}15`, border: `2px solid ${s.color}40`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 20 }}>{s.icon}</span>
          <span style={{ fontWeight: 600, fontSize: 14, color: s.color }}>{s.text}</span>
        </div>
        {dispute?.ai_analysis && (
          <div style={{ fontSize: 12, color: c.sub, marginBottom: 8, lineHeight: 1.5 }}>
            {dispute.ai_analysis}
          </div>
        )}
        {/* Show upload button if host needs to submit evidence */}
        {dispute?.status === "open" && !dispute?.host_evidence_url && 
         !["resolved_host","resolved_watcher","escalated_admin"].includes(dispute?.status) && (
          <div>
            <div style={{ fontSize: 12, color: c.sub, marginBottom: 8 }}>
              Upload a screenshot of your call log showing the outgoing call to {payment?.watcher_contact || "the watcher"}. You have 20 minutes.
            </div>
            <HostEvidenceUpload disputeId={dispute.id} />
          </div>
        )}
        {/* Show verdict info */}
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
    // ── Host Evidence Upload (real file picker + Supabase Storage) ────────────
  const HostEvidenceUpload = ({ disputeId }) => {
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    const handleFilePick = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        toast('Please upload an image file', 'error');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast('File too large — max 10MB', 'error');
        return;
      }

      setUploading(true);
      try {
        const { apiUploadEvidence } = await import('../api.js');
        const url = await apiUploadEvidence(file, user?.id);
        await onSubmitEvidence(disputeId, user?.id, 'host', url);
        toast('Evidence submitted — watcher will be notified', 'success');
      } catch (e) {
        toast('Failed to upload: ' + (e.message || 'Unknown error'), 'error');
      }
      setUploading(false);
    };

    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFilePick}
        />
        <Btn
          small
          variant="blue"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? 'Uploading…' : '📎 Upload Call Log Screenshot'}
        </Btn>
      </>
    );
  };

  // ── Follow-up Banner for Host ──────────────────────────────────────────────
  const FollowupBanner = ({ followup }) => {
    const [reqBusy, setReqBusy] = useState(false);

    if (followup?.status === "expired") {
      return (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: `${c.sub}15`, fontSize: 12, color: c.sub, marginTop: 8 }}>
          ⏰ Follow-up request expired — watcher didn't respond
        </div>
      );
    }
    if (followup?.status === "declined") {
      return (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: `${c.red}10`, fontSize: 12, color: c.red, marginTop: 8 }}>
          ✕ Watcher declined follow-up — refund is final
        </div>
      );
    }
    if (followup?.status === "accepted") {
      return (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: `${c.green}10`, fontSize: 12, color: c.green, marginTop: 8 }}>
          ✅ Follow-up accepted — contact re-revealed. Call now!
        </div>
      );
    }
    // pending
    return (
      <div style={{ padding: "10px 14px", borderRadius: 8, background: `${c.blue}10`, fontSize: 12, color: c.blue, marginTop: 8 }}>
        ⏳ Follow-up request sent — waiting for watcher to respond…
      </div>
    );
  };

  return (
    <div style={{ minHeight: "calc(100vh - 60px)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>

        {/* Verification requests */}
        {myVP.length > 0 && (
          <div style={{ background: `${c.gold}18`, border: `1px solid ${c.gold}`, borderRadius: 14, padding: 18, marginBottom: 20 }}>
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
          <div style={{ background: `${c.orange}15`, border: `1px solid ${c.orange}`, borderRadius: 14, padding: 18, marginBottom: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 10, color: c.orange }}>↩ Refund Requests Awaiting Your Approval</div>
            {hostRefundReqs.map(r => <HostRefundRow key={r.id} r={r} onHostApproveRefund={onHostApproveRefund} />)}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, marginBottom: 24, background: c.surface, padding: 4, borderRadius: 10, width: "fit-content", flexWrap: "wrap" }}>
          {["overview", "requests", "manage profile"].map(t => {
            const badge = t === "requests" ? liveReqs.length : 0;
            return (
              <button key={t} onClick={() => setTab(t)} style={{ padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", background: tab === t ? c.card : "transparent", color: tab === t ? c.goldL : c.sub, fontSize: 12, fontWeight: 600, fontFamily: "'Plus Jakarta Sans',sans-serif", textTransform: "capitalize", position: "relative" }}>
                {t}
                {badge > 0 && <span style={{ position: "absolute", top: 4, right: 4, background: c.red, color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 10, minWidth: 16, textAlign: "center" }}>{badge}</span>}
              </button>
            );
          })}
        </div>

        {/* ── Overview ── */}
        {tab === "overview" && (
          <div className="fu">
            <div style={{ background: `linear-gradient(135deg,${c.card},#1a1a24)`, border: `1px solid ${c.border}`, borderRadius: 18, padding: 28, marginBottom: 16, display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
              <Avatar user={live} size={76} ring />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 4 }}>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontWeight: 600 }}>{live.name}</div>
                  <OnlineDot on={live.online} />
                </div>
                <div style={{ color: c.sub, fontSize: 14, marginBottom: 10 }}>{live.bio}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{safeArr(live.tags).map(t => <Chip key={t} label={t} />)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 30, color: c.goldL, fontWeight: 600 }}>{S}{live.rate}</div>
                <div style={{ color: c.sub, fontSize: 11 }}>per call via {live.platform}</div>
                <div style={{ marginTop: 8, color: c.green, fontWeight: 700, fontSize: 15 }}>Wallet: {S}{Number(live.wallet || 0).toFixed(2)}</div>
              </div>
            </div>

            <div style={{ background: c.card, border: `1px solid ${live.paystackRecipientCode ? c.green : c.orange}`, borderRadius: 14, padding: 20, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>{live.paystackRecipientCode ? "✅" : "⚠️"}</span>
                <div style={{ fontWeight: 600 }}>{live.paystackRecipientCode ? "Automatic Payouts Active" : "Payout Setup Incomplete"}</div>
              </div>
            </div>

            <div style={{ background: `linear-gradient(135deg,${c.gold}10,${c.goldD})`, border: `1px solid ${c.gold}40`, borderRadius: 14, padding: 20, marginBottom: 16, textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔗</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: c.goldL, fontWeight: 600, marginBottom: 4 }}>Share Your Profile</div>
              <div style={{ color: c.sub, fontSize: 12, marginBottom: 14, lineHeight: 1.6 }}>Get more calls. Get more payments.<br />Share your profile link anywhere.</div>
              <Btn onClick={() => { const link = `${window.location.origin}/?host=${encodeURIComponent(live.name)}`; navigator.clipboard.writeText(link); toast("Profile link copied! 📋"); }} full>📋 Copy Your Profile Link</Btn>
              <div style={{ color: c.dim, fontSize: 10, marginTop: 8 }}>{window.location.origin}/?host={live.name}</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[["Payments Received", myPay.filter(p => p.paystack_verified).length, c.green], ["Calls Completed", myCalls.length, c.blue]].map(([l, v, col]) => (
                <div key={l} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 14, padding: 22 }}>
                  <div style={{ color: c.sub, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{l}</div>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 34, fontWeight: 600, color: col }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Requests ── */}
        {tab === "requests" && (
          <div className="fu">
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, marginBottom: 18 }}>Incoming Requests</div>

            {myPay.filter(p => p.status !== "poke" && p.status !== "pending_init" && p.status !== "failed").length === 0
              ? <div style={{ color: c.sub, textAlign: "center", padding: "50px 0" }}>No requests yet.</div>
              : <>
                  {liveReqs.length > 0 ? (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.green, display: "inline-block", animation: "pulse 2s infinite" }} />
                        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: c.goldL }}>Live Requests ({liveReqs.length})</div>
                      </div>
                      {liveReqs.map(pay => {
                        const callDone = calls.find(cl => cl.payment_id === pay.id || cl.paymentId === pay.id);
                        const refund   = refundReqs.find(r => r.payment_id === pay.id);
                        const conf     = (callConfirmations || []).find(cc => cc.payment_id === pay.id);
                        const dispute  = disputes.find(d => d.payment_id === pay.id);       // NEW
                        const followup = followupReqs.find(f => f.payment_id === pay.id);    // NEW
                        const isDisputed = pay.status === "disputed" || !!dispute;
                        const isCancelled = pay.status === "cancelled" || pay.status === "refunded_partial";

                        return (
                          <div key={pay.id} style={{
                            padding: 16, borderRadius: 12, marginBottom: 10,
                            background: `linear-gradient(135deg,${c.card},#1a1a24)`,
                            border: `1px solid ${isDisputed ? c.orange : isCancelled ? c.red : pay.status === "confirmed" ? c.gold : c.border}`,
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                              <div style={{ fontWeight: 600 }}>
                                {isDisputed ? "⚡ " : ""}{pay.status === "pending" ? "🔒 New Request" : pay.watcher_name || pay.watcherName}
                              </div>
                              {pay.paystack_verified && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: `${c.green}20`, color: c.green }}>✓ Verified</span>}
                              {refund && !dispute && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: `${c.orange}20`, color: c.orange }}>Refund {refund.status}</span>}
                              {isCancelled && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: `${c.red}20`, color: c.red }}>Cancelled</span>}
                            </div>

                            {/* ── DISPUTE BANNER ── */}
                            {dispute && <DisputeBanner dispute={dispute} payment={pay} />}

                            {/* ── FOLLOW-UP BANNER ── */}
                            {followup && <FollowupBanner followup={followup} />}

                            {/* ── CANCELLED: Show follow-up request button ── */}
                            {isCancelled && !followup && !dispute && (
                              <div style={{ padding: "12px 14px", borderRadius: 10, background: `${c.blue}15`, border: `1px solid ${c.blue}40`, marginTop: 8 }}>
                                <div style={{ fontWeight: 600, fontSize: 13, color: c.blue, marginBottom: 6 }}>
                                  🔄 Missed the call window?
                                </div>
                                <div style={{ fontSize: 12, color: c.sub, marginBottom: 10 }}>
                                  Request a follow-up — the watcher can choose to retry the call with you.
                                </div>
                                <Btn
                                  small variant="blue"
                                  disabled={requestingFollowup[pay.id]}
                                  onClick={async () => {
                                    setRequestingFollowup(prev => ({ ...prev, [pay.id]: true }));
                                    await onRequestFollowup(pay.id);
                                    setRequestingFollowup(prev => ({ ...prev, [pay.id]: false }));
                                  }}
                                >
                                  {requestingFollowup[pay.id] ? "Requesting…" : "🔄 Request Follow-up Call"}
                                </Btn>
                              </div>
                            )}

                            {pay.status === "pending" && !isDisputed && (
                              <div style={{ padding: "10px", borderRadius: 8, background: c.surface, border: `1px solid ${c.border}`, fontSize: 12, color: c.sub }}>
                                🔒 Contacts hidden — waiting for admin confirmation
                              </div>
                            )}
                                                        {pay.status === "confirmed" && !isDisputed && !refund && (() => {
                              const number  = pay.watcher_contact || "";
                              const platform = pay.watcher_platform || "WhatsApp";
                              const digits  = number.replace(/\D/g, "");
                              const intl    = digits.startsWith("0") ? "233" + digits.slice(1) : digits;
                              const link    = platform === "Telegram" ? `https://t.me/+${intl}` : `https://wa.me/${intl}`;
                              const hasInitiated = !!pay.call_initiated_at;
                              return (
                                <div style={{ padding: "10px", borderRadius: 8, background: `${c.green}10`, border: `1px solid ${c.green}30` }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: c.green, marginBottom: 4 }}>✓ Confirmed — Contacts Revealed</div>
                                  <a href={link} target="_blank" rel="noopener noreferrer"
                                    onClick={async () => {
                                      if (!hasInitiated) {
                                        const { apiInitiateCall } = await import('../api.js');
                                        await apiInitiateCall(pay.id, live.id);
                                        // Refresh payment so call_initiated_at is set
                                        const { data: pRows } = await supabase.from("payments").select("*").order("created_at", { ascending: false });
                                      }
                                    }}
                                    style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 10, background: platform === "Telegram" ? "#0088cc22" : "#25D36622", border: `1px solid ${platform === "Telegram" ? "#0088cc" : "#25D366"}`, textDecoration: "none", marginTop: 6 }}>
                                    <span style={{ fontSize: 20 }}>{platform === "Telegram" ? "✈️" : "💬"}</span>
                                    <div>
                                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 15, color: platform === "Telegram" ? "#0088cc" : "#25D366", fontWeight: 700 }}>{number}</div>
                                      <div style={{ fontSize: 11, color: c.sub }}>
                                        {hasInitiated ? "✓ Call initiated — tap to call again" : "Tap to initiate call on " + platform}
                                      </div>
                                    </div>
                                  </a>
                                  {hasInitiated && (
                                    <div style={{ fontSize: 11, color: c.green, marginTop: 6 }}>
                                      ✓ Call initiated at {new Date(pay.call_initiated_at).toLocaleTimeString()}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                            {conf && conf.status === "pending" && !isDisputed && (
  <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, background: `${c.gold}10`, border: `1px solid ${c.gold}30`, fontSize: 12, color: c.goldL }}>
    ⏳ Awaiting watcher confirmation — funds will be released to your MoMo after
  </div>
)}
                                                        {pay.status === "confirmed" && !callDone && !conf && !isDisputed && !refund && (
                              <MarkDoneBtn payId={pay.id} live={live} onMarkDone={onMarkDone} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ padding: "12px 16px", borderRadius: 10, background: `${c.green}10`, border: `1px solid ${c.green}30`, marginBottom: 20, fontSize: 13, color: c.green }}>
                      ✅ No active requests right now.
                    </div>
                  )}

                  {closedReqs.length > 0 && (
                    <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 14, overflow: "hidden" }}>
                      <div onClick={() => setHostHistoryOpen(o => !o)} style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                        onMouseEnter={e => e.currentTarget.style.background = c.surface}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 18 }}>📁</span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>Previous Requests</div>
                            <div style={{ color: c.sub, fontSize: 12 }}>{closedReqs.length} completed call{closedReqs.length !== 1 ? "s" : ""}</div>
                          </div>
                        </div>
                        <span style={{ color: c.sub, fontSize: 18 }}>{hostHistoryOpen ? "▲" : "▼"}</span>
                      </div>
                      {hostHistoryOpen && (
                        <div style={{ padding: "0 12px 12px" }}>
                          {closedReqs.map(pay => {
                            const callDone = calls.find(cl => cl.payment_id === pay.id);
                            const conf = (callConfirmations || []).find(cc => cc.payment_id === pay.id);
                            const dispute = disputes.find(d => d.payment_id === pay.id);
                            return (
                              <div key={pay.id} style={{ padding: 14, borderRadius: 10, marginBottom: 8, background: c.surface, border: `1px solid ${c.border}` }}>
                                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                                  <div>
                                    <div style={{ fontWeight: 600, fontSize: 13 }}>{pay.watcher_name}</div>
                                    <div style={{ fontSize: 11, color: c.sub }}>{new Date(pay.created_at || pay.ts).toLocaleString()}</div>
                                  </div>
                                  <div style={{ textAlign: "right" }}>
                                    <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, color: c.goldL }}>{S}{pay.total_charged || pay.amount}</div>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: pay.status === "completed" ? c.green : pay.status === "refunded" || pay.status === "refunded_partial" || pay.status === "cancelled" ? c.red : conf?.status === "confirmed" || conf?.status === "auto_confirmed" ? c.green : dispute?.status === "resolved_host" ? c.green : dispute?.status === "resolved_watcher" ? c.red : c.sub }}>
                                      {pay.status === "completed" || conf?.status === "confirmed" || conf?.status === "auto_confirmed" || dispute?.status === "resolved_host"
                                        ? "✅ Done"
                                        : pay.status === "refunded"
                                          ? "❌ Cancelled — refunded"
                                          : pay.status === "refunded_partial" || pay.status === "cancelled"
                                            ? "↩ Partial Refund"
                                            : dispute?.status === "resolved_watcher"
                                              ? "❌ Dispute lost — refunded"
                                              : "Done"}
                                    </div>
                                  </div>
                                </div>
                                {callDone?.released && (
  <div style={{ marginTop: 8, fontSize: 12, color: c.green }}>
    💸 {pay.status === "completed" ? "Funds released to your MoMo" : 
        pay.status === "refunded" || pay.status === "refunded_partial" ? "Funds refunded to watcher" : 
        "Funds will be released to your MoMo after confirmation"}
  </div>
)}
                                {conf?.status === "auto_confirmed" && <div style={{ marginTop: 6, fontSize: 11, color: c.dim }}>🤖 Auto-confirmed after timeout</div>}
                                {dispute && (dispute.status === "resolved_host" || dispute.status === "resolved_watcher") && (
                                  <div style={{ marginTop: 6, fontSize: 11, color: dispute.status === "resolved_host" ? c.green : c.red }}>
                                    {dispute.status === "resolved_host" ? "✅ Dispute won" : "❌ Dispute lost"} — {dispute.resolved_by === "ai" ? `AI verdict (${dispute.ai_confidence}%)` : "Admin decision"}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
            }
          </div>
        )}

        {/* ── Manage Profile ── */}
        {tab === "manage profile" && (
          <div className="fu">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22 }}>Manage Profile</div>
              {!editing
                ? <Btn small onClick={startEdit}>Edit Profile</Btn>
                : <div style={{ display: "flex", gap: 8 }}><Btn small variant="green" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Btn><Btn small variant="surface" onClick={() => setEditing(false)}>Cancel</Btn></div>
              }
            </div>
            <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 16, padding: 28 }}>
              {!editing ? (
                <>
                  <div style={{ display: "flex", gap: 18, alignItems: "center", marginBottom: 22 }}>
                    <Avatar user={live} size={78} ring />
                    <div><div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 600 }}>{live.name}</div><div style={{ color: c.sub, fontSize: 14 }}>{live.bio}</div></div>
                  </div>
                  {safeArr(live.photos).length > 0 && (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ color: c.sub, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Gallery</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{safeArr(live.photos).map((src, i) => <img key={i} src={src} alt="" style={{ width: 96, height: 96, borderRadius: 10, objectFit: "cover" }} />)}</div>
                    </div>
                  )}
                  <div style={{ borderTop: `1px solid ${c.border}`, paddingTop: 20 }}>
                    <SectionHeader icon="🔒" title="Payout Information" />
                    <div style={{ color: c.sub, fontSize: 13, lineHeight: 2.1 }}>
                      <div>Provider: <strong style={{ color: c.text }}>{live.payoutProvider || "Not set"}</strong></div>
                      <div>Number: <strong style={{ color: c.goldL }}>{live.payoutNumber || "Not set"}</strong></div>
                      <div>Status: <strong style={{ color: live.paystackRecipientCode ? c.green : c.orange }}>{live.paystackRecipientCode ? "Active ✓" : "Not configured"}</strong></div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 2, marginBottom: 20, background: c.surface, padding: 4, borderRadius: 8, width: "fit-content" }}>
                    {["Public Info", "Payout Info"].map((s, i) => (
                      <button key={s} onClick={() => setEditStep(i + 1)} style={{ padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", background: editStep === i + 1 ? c.card : "transparent", color: editStep === i + 1 ? c.goldL : c.sub, fontSize: 11, fontWeight: 600 }}>{s}</button>
                    ))}
                  </div>
                  {editStep === 1 ? (
                    <>
                      <PhotoPick label="Profile Photo" value={ef.profilePhoto} onChange={eu("profilePhoto")} circle />
                      <Field label="Username" value={ef.name || ""} onChange={eu("name")} />
                      <Field label="Bio" value={ef.bio || ""} onChange={eu("bio")} rows={3} />
                      <Field label="Platform" value={ef.platform || "WhatsApp"} onChange={eu("platform")} options={["WhatsApp", "Telegram"]} />
                      <Field label="Contact" value={ef.contactNumber || ""} onChange={eu("contactNumber")} maxLength={10} type="tel" />
                      <Field label={`Rate (${CURRENCY})`} value={ef.rate || ""} onChange={eu("rate")} type="number" />
                      <Field label="Tags" value={typeof ef.tags === "string" ? ef.tags : safeArr(ef.tags).join(", ")} onChange={eu("tags")} />
                      <MultiPick label="Gallery" value={safeArr(ef.photos)} onChange={eu("photos")} max={4} />
                    </>
                  ) : (
                    <>
                      <SectionHeader icon="🔒" title="Payout Info" subtitle="Private — never shown to watchers" />
                      <Field label="Payout Name" value={ef.payoutName || ""} onChange={eu("payoutName")} />
                      <Field label="Payout Number" value={ef.payoutNumber || ""} onChange={eu("payoutNumber")} type="tel" maxLength={10} />
                      <Field label="Provider" value={ef.payoutProvider || "MTN"} onChange={eu("payoutProvider")} options={PAYOUT_PROVIDERS} />
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