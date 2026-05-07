import { useState } from "react";
import { c, S, ADMIN_TOKEN } from "../constants";
import { Btn, Avatar, OnlineDot } from "../components/UI";
import { AdminRefundActions } from "../components/AdminRefundActions";
import { WithdrawBtn } from "../components/WithdrawBtn";

export function AdminView({ users, payments, calls, wallet, verifyPrompts, onRelease, reports, onPushVerify, setView, confirmPayment, refundReqs, callConfirmations, onApproveRefund, onDenyRefund, toast }) {
  const [tab, setTab] = useState("overview");
  const [showPayHistory,  setShowPayHistory]  = useState(false);
  const [showCallHistory, setShowCallHistory] = useState(false);
  const [adminPayOpen,    setAdminPayOpen]    = useState(false);
  const [expandedPayments, setExpandedPayments] = useState(new Set());
  const [expandedCalls,    setExpandedCalls]    = useState(new Set());

  const pendingRefunds  = refundReqs.filter(r => r.status === "pending" || r.status === "pending_host");
  const pendingPayments = payments.filter(p => p.status === "pending" && p.paystack_verified);
  const hostsWithPayout    = users.filter(u => u.role === "host" && u.paystack_recipient_code).length;
  const hostsWithoutPayout = users.filter(u => u.role === "host" && !u.paystack_recipient_code).length;

  const togglePayment = id => setExpandedPayments(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleCall    = id => setExpandedCalls(prev    => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const exportCSV = () => {
    const rows = [
      ["Date", "Watcher", "Host", "Amount", "Fee", "Status"],
      ...payments.filter(p => p.paystack_verified).map(p => {
        const host = users.find(u => u.id === (p.target_user_id || p.targetUserId));
        return [new Date(p.created_at).toLocaleDateString(), p.watcher_name, host?.name || "—", p.total_charged || p.amount, p.platform_fee || 0, p.status];
      }),
    ];
    const csv  = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `connectcall-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const renderCallCard = (conf, isPending) => {
    const pay  = payments.find(p => p.id === conf.payment_id);
    const host = users.find(u => u.id === pay?.target_user_id);
    const isExp = expandedCalls.has(conf.id);
    return (
      <div key={conf.id} style={{ background: c.card, border: `1px solid ${isPending ? c.orange + "50" : c.green + "30"}`, borderRadius: 12, marginBottom: 8, overflow: "hidden" }}>
        <div onClick={() => toggleCall(conf.id)} style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 600 }}>{host?.name || "Host"} → {pay?.watcher_name || "Watcher"}</div>
            <div style={{ color: c.sub, fontSize: 12 }}>{S}{pay?.amount} · {new Date(conf.created_at).toLocaleString()}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: isPending ? c.orange : c.green }}>
              {isPending ? `🟡 Pending — expires ${new Date(conf.expires_at).toLocaleTimeString()}` : conf.status === "auto_confirmed" ? "🤖 Auto-confirmed" : "✅ Confirmed"}
            </span>
            <span style={{ color: c.sub }}>{isExp ? "▲" : "▼"}</span>
          </div>
        </div>
        {isExp && (
          <div style={{ padding: "0 18px 14px", borderTop: `1px solid ${c.border}`, paddingTop: 12, fontSize: 13, color: c.sub, lineHeight: 2 }}>
            <div>Host: <strong style={{ color: c.text }}>{host?.name}</strong></div>
            <div>Watcher: <strong style={{ color: c.text }}>{pay?.watcher_name}</strong></div>
            <div>Amount: <strong style={{ color: c.goldL }}>{S}{pay?.amount}</strong></div>
            {!isPending && <div>Confirmed: <strong style={{ color: c.green }}>{conf.status === "auto_confirmed" ? "Automatically" : "By watcher"}</strong></div>}
            <div>Ref: <span style={{ fontFamily: "'DM Mono',monospace" }}>{pay?.paystack_ref}</span></div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ minHeight: "calc(100vh - 60px)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>

        {/* Escrow header */}
        <div className="glow" style={{ background: `linear-gradient(135deg,${c.card},#1a1a24)`, border: `1px solid ${c.gold}40`, borderRadius: 18, padding: 28, marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ color: c.sub, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Escrow Balance</div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 52, color: c.goldL, fontWeight: 600 }}>{S}{Number(wallet).toFixed(2)}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              ["Users",       users.length],
              ["Verified",    payments.filter(p => p.paystack_verified).length],
              ["Calls",       callConfirmations?.filter(c => c.status === "confirmed" || c.status === "auto_confirmed").length || 0],
              ["Payout Ready", hostsWithPayout],
              ["No Payout",   hostsWithoutPayout],
              ["Refunds",     pendingRefunds.length],
            ].map(([l, v]) => (
              <div key={l} style={{ background: c.surface, borderRadius: 10, padding: "12px 16px", minWidth: 90 }}>
                <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 600, color: l === "Refunds" && v > 0 ? c.orange : l === "No Payout" && v > 0 ? c.red : c.text }}>{v}</div>
                <div style={{ color: c.sub, fontSize: 11 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending payments alert */}
        {pendingPayments.length > 0 && (
          <div style={{ background: `${c.gold}15`, border: `1px solid ${c.gold}`, borderRadius: 12, padding: "12px 18px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div><strong style={{ color: c.goldL }}>{pendingPayments.length} payment(s)</strong> <span style={{ color: c.sub, fontSize: 13 }}>awaiting confirmation</span></div>
            <Btn small onClick={() => setTab("payments")}>Review →</Btn>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, marginBottom: 22, background: c.surface, padding: 4, borderRadius: 10, width: "fit-content", flexWrap: "wrap" }}>
          {["overview", "payments", "calls", "refunds", "reports", "users"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", background: tab === t ? c.card : "transparent", color: tab === t ? c.goldL : c.sub, fontSize: 12, fontWeight: 600, position: "relative" }}>
              {t}
              {t === "refunds"  && pendingRefunds.length > 0                          && <span style={{ position: "absolute", top: 4, right: 4, width: 8, height: 8, borderRadius: "50%", background: c.red }} />}
              {t === "payments" && pendingPayments.length > 0                         && <span style={{ position: "absolute", top: 4, right: 4, width: 8, height: 8, borderRadius: "50%", background: c.gold }} />}
              {t === "reports"  && reports.filter(r => r.status === "pending").length > 0 && <span style={{ position: "absolute", top: 4, right: 4, width: 8, height: 8, borderRadius: "50%", background: c.orange }} />}
            </button>
          ))}
        </div>

        {/* ── Overview ── */}
        {tab === "overview" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20 }}>Platform Overview</div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn small variant="ghost" onClick={exportCSV}>📥 Export CSV</Btn>
                <WithdrawBtn adminToken={ADMIN_TOKEN} toast={toast} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12, marginBottom: 24 }}>
              {[
                ["Hosts Online", users.filter(u => u.online && u.role === "host").length, c.green],
                ["Total Users",  users.length, c.blue],
                ["Payments",     payments.filter(p => p.paystack_verified).length, c.goldL],
                ["Revenue",      `${S}${payments.filter(p => p.paystack_verified).reduce((a, x) => a + Number(x.platform_fee || 0), 0).toFixed(0)}`, c.purple],
                ["Refunds",      pendingRefunds.length, c.orange],
                ["Payout Ready", hostsWithPayout, c.green],
              ].map(([l, v, col]) => (
                <div key={l} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: 16, textAlign: "center" }}>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 600, color: col }}>{v}</div>
                  <div style={{ color: c.sub, fontSize: 11 }}>{l}</div>
                </div>
              ))}
            </div>

            {/* Top hosts */}
            <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 14, padding: 20, marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 14, color: c.goldL }}>🏆 Top Hosts by Earnings</div>
              {(() => {
                const hostEarnings = {};
                payments.filter(p => p.paystack_verified).forEach(p => {
                  const hid = p.target_user_id || p.targetUserId;
                  hostEarnings[hid] = (hostEarnings[hid] || 0) + Number(p.amount || 0);
                });
                const ranked = Object.entries(hostEarnings)
                  .map(([id, amt]) => ({ host: users.find(u => u.id === id), amount: amt }))
                  .filter(h => h.host).sort((a, b) => b.amount - a.amount).slice(0, 5);
                if (ranked.length === 0) return <div style={{ color: c.sub, fontSize: 13 }}>No data yet.</div>;
                return ranked.map((h, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: i < ranked.length - 1 ? `1px solid ${c.border}` : "none" }}>
                    <span style={{ fontSize: 18, minWidth: 24 }}>{["🥇", "🥈", "🥉", "4", "5"][i]}</span>
                    <Avatar user={h.host} size={36} />
                    <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{h.host.name}</div></div>
                    <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 600, color: c.goldL }}>{S}{h.amount.toFixed(0)}</div>
                  </div>
                ));
              })()}
            </div>

            {/* Revenue chart */}
            <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 14, padding: 20 }}>
              <div style={{ fontWeight: 600, marginBottom: 14, color: c.goldL }}>📊 Revenue (Last 7 Days)</div>
              {(() => {
                const days = [];
                for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d.toLocaleDateString("en-US", { weekday: "short" })); }
                const dayRevenue = days.map(day =>
                  payments.filter(p => p.paystack_verified).reduce((sum, p) => {
                    const pDate = new Date(p.created_at || p.ts).toLocaleDateString("en-US", { weekday: "short" });
                    return pDate === day ? sum + Number(p.platform_fee || 0) : sum;
                  }, 0)
                );
                const maxRev = Math.max(...dayRevenue, 1);
                return days.map((day, i) => (
                  <div key={day} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <span style={{ minWidth: 35, fontSize: 11, color: c.sub }}>{day}</span>
                    <div style={{ flex: 1, height: 22, background: c.surface, borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(dayRevenue[i] / maxRev) * 100}%`, background: `linear-gradient(90deg,${c.gold},${c.goldL})`, borderRadius: 4, minWidth: 2 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, minWidth: 40, textAlign: "right" }}>{S}{dayRevenue[i].toFixed(0)}</span>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {/* ── Payments ── */}
        {tab === "payments" && (() => {
          const visiblePays = payments.filter(p => p.status !== "poke" && p.status !== "pending_init" && p.status !== "failed");
          const pendingPays = visiblePays.filter(p => p.status === "pending" && p.paystack_verified);
          const historyPays = visiblePays.filter(p => p.status !== "pending" || !p.paystack_verified);
          return (
            <div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, marginBottom: 18 }}>Payment Ledger</div>
              {pendingPays.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.gold, display: "inline-block" }} />
                    <div style={{ fontWeight: 600, color: c.goldL }}>Awaiting Confirmation ({pendingPays.length})</div>
                  </div>
                  {pendingPays.map(pay => {
                    const host  = users.find(u => u.id === (pay.target_user_id || pay.targetUserId));
                    const isExp = expandedPayments.has(pay.id);
                    return (
                      <div key={pay.id} style={{ background: c.card, border: `1px solid ${c.gold}`, borderRadius: 12, marginBottom: 8, overflow: "hidden" }}>
                        <div onClick={() => togglePayment(pay.id)} style={{ padding: "14px 18px", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", cursor: "pointer" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600 }}>{pay.watcher_name} → {host?.name || "—"}</div>
                            <div style={{ color: c.sub, fontSize: 12 }}>{new Date(pay.created_at || pay.ts).toLocaleString()}</div>
                          </div>
                          <div style={{ fontWeight: 600 }}>{S}{pay.total_charged || pay.amount}</div>
                          <Btn small onClick={e => { e.stopPropagation(); confirmPayment(pay.id); }}>✓ Confirm</Btn>
                          <span style={{ color: c.sub }}>{isExp ? "▲" : "▼"}</span>
                        </div>
                        {isExp && (
                          <div style={{ padding: "0 18px 14px", borderTop: `1px solid ${c.border}`, paddingTop: 12, fontSize: 13, color: c.sub, lineHeight: 2 }}>
                            <div>Ref: <span style={{ fontFamily: "'DM Mono',monospace", color: c.text }}>{pay.paystack_ref}</span></div>
                            <div>Fee: {S}{pay.platform_fee || 0}</div>
                            {pay.watcher_contact && <div>Watcher: {pay.watcher_contact}</div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {historyPays.length > 0 && (
                <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 14, overflow: "hidden" }}>
                  <div onClick={() => setAdminPayOpen(o => !o)} style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = c.surface}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 18 }}>📁</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>Payment History</div>
                        <div style={{ color: c.sub, fontSize: 12 }}>{historyPays.length} transaction{historyPays.length !== 1 ? "s" : ""}</div>
                      </div>
                    </div>
                    <span style={{ color: c.sub, fontSize: 18 }}>{adminPayOpen ? "▲" : "▼"}</span>
                  </div>
                  {adminPayOpen && (
                    <div style={{ padding: "0 12px 12px" }}>
                      {historyPays.map(pay => {
                        const host  = users.find(u => u.id === (pay.target_user_id || pay.targetUserId));
                        const isExp = expandedPayments.has(pay.id);
                        return (
                          <div key={pay.id} style={{ background: c.surface, border: `1px solid ${pay.status === "refunded" ? c.red : pay.status === "completed" ? `${c.green}40` : c.border}`, borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
                            <div onClick={() => togglePayment(pay.id)} style={{ padding: "12px 16px", display: "flex", gap: 12, alignItems: "center", cursor: "pointer" }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{pay.watcher_name} → {host?.name || "—"}</div>
                                <div style={{ color: c.sub, fontSize: 11 }}>{new Date(pay.created_at || pay.ts).toLocaleString()}</div>
                              </div>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{S}{pay.total_charged || pay.amount}</div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: pay.status === "completed" ? c.green : pay.status === "refunded" ? c.red : c.sub }}>{pay.status.toUpperCase()}</div>
                              <span style={{ color: c.sub, fontSize: 14 }}>{isExp ? "▲" : "▼"}</span>
                            </div>
                            {isExp && (
                              <div style={{ padding: "0 16px 12px", borderTop: `1px solid ${c.border}`, paddingTop: 10, fontSize: 12, color: c.sub, lineHeight: 2 }}>
                                <div>Ref: <span style={{ fontFamily: "'DM Mono',monospace", color: c.text, fontSize: 11 }}>{pay.paystack_ref}</span></div>
                                <div>Fee collected: {S}{pay.platform_fee || 0}</div>
                                {pay.host_contact_revealed && <div>Host contact: {pay.host_contact_revealed}</div>}
                                {pay.watcher_contact && <div>Watcher contact: {pay.watcher_contact}</div>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Calls ── */}
        {tab === "calls" && (() => {
          const pendingConfs = (callConfirmations || []).filter(cc => cc.status === "pending");
          const doneConfs    = (callConfirmations || []).filter(cc => cc.status === "confirmed" || cc.status === "auto_confirmed");
          return (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: pendingConfs.length > 0 ? c.orange : c.dim, animation: pendingConfs.length > 0 ? "pulse 2s infinite" : "none" }} />
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22 }}>Live Calls</div>
                <span style={{ fontSize: 12, color: c.sub }}>awaiting watcher confirmation</span>
                {pendingConfs.length === 0 && <span style={{ fontSize: 12, color: c.dim }}>— none</span>}
              </div>
              {pendingConfs.length === 0
                ? <div style={{ background: c.card, border: `1px dashed ${c.border}`, borderRadius: 14, padding: "24px 20px", textAlign: "center", color: c.sub, fontSize: 13, marginBottom: 20 }}>No calls awaiting confirmation.</div>
                : <div style={{ marginBottom: 20 }}>{pendingConfs.map(conf => renderCallCard(conf, true))}</div>
              }
              {doneConfs.length > 0 && (
                <>
                  <button onClick={() => setShowCallHistory(h => !h)} style={{ width: "100%", background: c.card, border: `1px solid ${c.border}`, borderRadius: 14, padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", fontFamily: "'Plus Jakarta Sans',sans-serif", marginBottom: showCallHistory ? 10 : 0 }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = c.gold}
                    onMouseLeave={e => e.currentTarget.style.borderColor = c.border}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 18 }}>📂</span>
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontWeight: 600, color: c.text, fontSize: 14 }}>Completed Calls</div>
                        <div style={{ fontSize: 11, color: c.sub }}>{doneConfs.length} call{doneConfs.length !== 1 ? "s" : ""}</div>
                      </div>
                    </div>
                    <span style={{ color: c.sub, fontSize: 16 }}>{showCallHistory ? "▲" : "▼"}</span>
                  </button>
                  {showCallHistory && <div className="fu">{doneConfs.map(conf => renderCallCard(conf, false))}</div>}
                </>
              )}
            </>
          );
        })()}

        {/* ── Refunds ── */}
        {tab === "refunds" && (
          <div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, marginBottom: 18 }}>Refund Requests</div>
            {refundReqs.length === 0 && <div style={{ color: c.sub, textAlign: "center", padding: "40px 0" }}>No refund requests.</div>}
            {refundReqs.map(r => {
              const pay  = payments.find(p => p.id === r.payment_id);
              const host = users.find(u => u.id === pay?.target_user_id);
              const isDispute = r.reason?.toLowerCase().includes("call did not") || r.reason?.toLowerCase().includes("dispute") || r.refund_type === "dispute";
              const isPending  = r.status === "pending" || r.status === "pending_host";
              const isApproved = r.status === "approved";
              const isDenied   = r.status === "denied";
              return (
                <div key={r.id} style={{ background: c.card, border: `1px solid ${isDispute ? c.red : isPending ? c.orange : isApproved ? c.green : c.border}`, borderRadius: 14, padding: 20, marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
                    <div>
                      {isDispute && (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `${c.red}15`, border: `1px solid ${c.red}40`, borderRadius: 20, padding: "3px 10px", marginBottom: 8 }}>
                          <span style={{ fontSize: 12 }}>⚠️</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: c.red, letterSpacing: .5 }}>DISPUTED CALL</span>
                        </div>
                      )}
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{r.watcher_name} → {host?.name || "Host"}</div>
                      <div style={{ fontSize: 12, color: c.sub, marginTop: 2 }}>{r.refund_type || "Manual"} · {new Date(r.created_at).toLocaleString()}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, color: c.goldL, fontWeight: 600 }}>{S}{r.refund_amount || pay?.total_charged || 0}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4, color: isPending ? c.orange : isApproved ? c.green : isDenied ? c.red : c.sub }}>
                        {isPending ? "⏳ Awaiting Review" : isApproved ? "✅ Refund Approved" : isDenied ? "❌ Denied" : "—"}
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: "10px 14px", background: isDispute ? `${c.red}10` : c.surface, border: `1px solid ${isDispute ? c.red + "30" : c.border}`, borderRadius: 8, marginBottom: 12, fontSize: 13, color: isDispute ? c.text : c.sub }}>
                    {isDispute && <span style={{ fontWeight: 600, color: c.red }}>Watcher says: </span>}{r.reason}
                  </div>
                  {pay && (
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: c.sub, marginBottom: 12, padding: "8px 12px", background: c.surface, borderRadius: 8 }}>
                      <span>Payment: <strong style={{ color: c.text }}>{S}{pay.total_charged || pay.amount}</strong></span>
                      <span>Status: <strong style={{ color: c.text }}>{pay.status}</strong></span>
                      <span>Ref: <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{pay.paystack_ref}</span></span>
                    </div>
                  )}
                  {isPending  && <AdminRefundActions r={r} onApproveRefund={onApproveRefund} onDenyRefund={onDenyRefund} />}
                  {isApproved && <div style={{ fontSize: 12, color: c.green, fontWeight: 600 }}>💸 Refund processed — funds returned to watcher</div>}
                  {isDenied   && <div style={{ fontSize: 12, color: c.red }}>❌ Refund denied — payment remains with host</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Reports ── */}
        {tab === "reports" && (
          <div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, marginBottom: 18 }}>User Reports</div>
            {reports.length === 0 && (
              <div style={{ color: c.sub, textAlign: "center", padding: "40px 0" }}>
                No reports yet.<br /><span style={{ fontSize: 12, color: c.dim }}>Reports submitted by users will appear here.</span>
              </div>
            )}
            {reports.map(r => {
              const reported     = users.find(u => u.id === r.reported_user_id);
              const reporter     = users.find(u => u.id === r.reporter_id);
              const reportedName = reported?.name || r.reported_username || "Unknown user";
              const reporterName = reporter?.name || "Anonymous";
              return (
                <div key={r.id} style={{ background: c.card, border: `1px solid ${r.status === "pending" ? c.orange : c.border}`, borderRadius: 14, padding: 20, marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <Avatar user={reported || { avatar: reportedName[0] }} size={44} />
                      <div>
                        <div style={{ fontWeight: 600 }}>Reported: <span style={{ color: c.goldL }}>{reportedName}</span> <span style={{ color: c.sub, fontSize: 12 }}>({reported?.role || "user"})</span></div>
                        <div style={{ fontSize: 12, color: c.sub, display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                          <Avatar user={reporter || { avatar: reporterName[0] }} size={18} /> By: {reporterName}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ padding: "3px 10px", borderRadius: 20, border: `1px solid ${c.border}`, fontSize: 11, color: c.orange }}>{r.reason}</span>
                      <div style={{ fontSize: 11, color: c.dim, marginTop: 4 }}>{new Date(r.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                  {r.details && <div style={{ padding: "10px 14px", background: c.surface, borderRadius: 8, marginBottom: 12, fontSize: 13, color: c.sub }}>{r.details}</div>}
                  <div style={{ fontSize: 12, fontWeight: 600 }}>
                    <span style={{ color: r.status === "pending" || r.status === "pending_host" ? c.orange : r.status === "approved" ? c.green : c.red }}>
                      {r.status === "pending" || r.status === "pending_host" ? "⏳ Awaiting review" : r.status === "approved" ? "✅ Approved" : "❌ Denied"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Users ── */}
        {tab === "users" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
            {users.map(u => (
              <div key={u.id} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 14, padding: 20 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                  <Avatar user={u} size={44} />
                  <div><div style={{ fontWeight: 600 }}>{u.name}</div><div style={{ color: c.sub, fontSize: 11 }}>{u.role}</div></div>
                  <OnlineDot on={u.online} />
                </div>
                <div style={{ color: c.sub, fontSize: 12 }}>Rate: {S}{u.rate || 0} | Payout: {u.paystackRecipientCode ? "✓" : "⚠"}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}