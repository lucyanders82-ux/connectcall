import { useState, useEffect } from "react";
import { c, S, ALL_TAGS, API_BASE } from "../constants";
import { safeArr } from "../utils";
import { Btn, Modal, Field, Chip, OnlineDot, Spinner, Avatar } from "../components/UI";
import { HostRating, HostResponseRate } from "../components/HostRating";

// ─── HostCard (BrowseView) ────────────────────────────────────────────────────
export function HostCard({ u, onConnect, setGallery, onReport, onFavorite, isFav, currentUser }) {
  const [showFullBio, setShowFullBio] = useState(false);
  const photos = [u.profilePhoto, ...safeArr(u.photos)].filter(Boolean);
  const [idx, setIdx] = useState(0);
  const isBlurred = !currentUser;

  return (
    <div className="fi" style={{
      background: c.card,
      border: `1px solid ${c.border}`,
      borderRadius: 24,          // rounder card
      overflow: "hidden",
      cursor: "pointer",
      transition: "all .35s cubic-bezier(.4,0,.2,1)",
      position: "relative",
    }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = `${c.gold}60`;
        e.currentTarget.style.transform = "translateY(-6px)";
        e.currentTarget.style.boxShadow = `0 24px 60px ${c.gold}12, 0 8px 24px #00000060`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = c.border;
        e.currentTarget.style.transform = "";
        e.currentTarget.style.boxShadow = "";
      }}>

      {/* Favorite button */}
      {currentUser && (
        <button onClick={e => { e.stopPropagation(); onFavorite(u.id); }}
          style={{
            position: "absolute", top: 14, right: 14, zIndex: 10,
            background: "rgba(13,10,18,0.7)",
            border: `1px solid ${isFav ? c.gold + "60" : "#ffffff18"}`,
            borderRadius: "50%", width: 36, height: 36,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", fontSize: 16,
            backdropFilter: "blur(8px)",
            color: isFav ? c.gold : "#ffffff80",
            transition: "all .2s",
          }}
          onMouseEnter={e => e.currentTarget.style.transform = "scale(1.15)"}
          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
          {isFav ? "❤️" : "♡"}
        </button>
      )}

      {/* Photo area */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "4/5", overflow: "hidden" }}>
        {photos.length > 0
          ? <img src={photos[idx]} alt="" style={{
              width: "100%", height: "100%", objectFit: "cover",
              filter: isBlurred ? "blur(6px) brightness(0.6)" : "none",
              transform: isBlurred ? "scale(1.08)" : "scale(1)",
              transition: "all .4s ease",
            }} />
          : <div style={{
              width: "100%", height: "100%",
              background: `linear-gradient(160deg, ${c.surface}, ${c.card})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Cormorant Garamond', serif", fontSize: 72,
              color: c.gold, opacity: .2,
            }}>{u.avatar}</div>
        }

        {/* Blurred sign-up overlay */}
        {isBlurred && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 8, zIndex: 3,
          }}>
            <div style={{ fontSize: 32 }}>🔐</div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 13, textAlign: "center", lineHeight: 1.5 }}>
              Sign up to<br />view profile
            </div>
          </div>
        )}

        {/* Bottom gradient fade */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 120,
          background: "linear-gradient(to top, rgba(13,10,18,0.95) 0%, transparent 100%)",
        }} />

        {/* Name + rate overlaid on photo */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "16px 18px", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div>
              <div style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 22, fontWeight: 600,
                color: "#fff", lineHeight: 1.1, marginBottom: 2,
              }}>{u.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <OnlineDot on={u.online} />
                <span style={{ fontSize: 11, color: u.online ? c.green : "#ffffff50", fontWeight: 500 }}>
                  {u.online ? "Available now" : "Offline"}
                </span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              {u.country === "Nigeria" && <div style={{ fontSize: 12, marginBottom: 2 }}>🇳🇬</div>}
              <div style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 26, fontWeight: 600,
                color: c.goldL, lineHeight: 1,
              }}>
                {u.country === "Nigeria" ? "₦" : S}{u.rate}
              </div>
              <div style={{ fontSize: 10, color: "#ffffff50", marginTop: 2 }}>per call</div>
            </div>
          </div>
        </div>

        {/* Photo navigation */}
        {!isBlurred && photos.length > 1 && (
          <>
            <button onClick={e => { e.stopPropagation(); setIdx(p => (p - 1 + photos.length) % photos.length); }}
              style={{ position: "absolute", left: 10, top: "40%", transform: "translateY(-50%)", background: "rgba(13,10,18,0.7)", backdropFilter: "blur(4px)", border: "1px solid #ffffff18", color: "#fff", width: 30, height: 30, borderRadius: "50%", cursor: "pointer", fontSize: 16, zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
            <button onClick={e => { e.stopPropagation(); setIdx(p => (p + 1) % photos.length); }}
              style={{ position: "absolute", right: 10, top: "40%", transform: "translateY(-50%)", background: "rgba(13,10,18,0.7)", backdropFilter: "blur(4px)", border: "1px solid #ffffff18", color: "#fff", width: 30, height: 30, borderRadius: "50%", cursor: "pointer", fontSize: 16, zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
            <div style={{ position: "absolute", bottom: 70, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 5, zIndex: 2 }}>
              {photos.map((_, di) => (
                <div key={di} onClick={e => { e.stopPropagation(); setIdx(di); }}
                  style={{ width: di === idx ? 18 : 5, height: 5, borderRadius: 999, background: di === idx ? c.goldL : "#ffffff40", cursor: "pointer", transition: "all .2s" }} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Card body */}
      <div style={{ padding: "14px 18px 18px" }}>

        {/* Rating */}
        {!isBlurred && <div style={{ marginBottom: 10 }}><HostRating hostId={u.id} /></div>}

        {/* Bio */}
        <div style={{ color: c.sub, fontSize: 12.5, lineHeight: 1.65, marginBottom: 12, minHeight: 38 }}>
          {showFullBio ? u.bio : `${(u.bio || "").slice(0, 72)}${(u.bio || "").length > 72 ? "…" : ""}`}
          {(u.bio || "").length > 72 && (
            <span onClick={e => { e.stopPropagation(); setShowFullBio(!showFullBio); }}
              style={{ color: c.gold, cursor: "pointer", marginLeft: 4, fontSize: 11, opacity: .8 }}>
              {showFullBio ? "less" : "more"}
            </span>
          )}
        </div>

        {/* Tags — pill treatment */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 16 }}>
          {isBlurred
            ? [1,2,3].map(i => <Chip key={i} label="••••" />)
            : <>
                {safeArr(u.tags).slice(0, 3).map(t => (
                  <span key={t} style={{
                    padding: "4px 12px", borderRadius: 999,
                    background: `${c.gold}10`,
                    border: `1px solid ${c.gold}25`,
                    fontSize: 11, color: c.goldL,
                    fontWeight: 600, letterSpacing: .3,
                  }}>{t}</span>
                ))}
                {safeArr(u.tags).length > 3 && (
                  <span style={{
                    padding: "4px 12px", borderRadius: 999,
                    background: `${c.dim}20`, border: `1px solid ${c.dim}30`,
                    fontSize: 11, color: c.sub,
                  }}>+{safeArr(u.tags).length - 3}</span>
                )}
              </>
          }
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontSize: 11, color: c.dim }}>
            via <span style={{ color: c.sub, fontWeight: 500 }}>{u.platform || "WhatsApp"}</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {!isBlurred && (
              <button onClick={e => { e.stopPropagation(); onReport(u); }}
                style={{ background: "none", border: "none", color: c.dim, fontSize: 13, cursor: "pointer", padding: "4px 6px", borderRadius: 999, transition: "all .2s" }}
                onMouseEnter={e => e.currentTarget.style.color = c.red}
                onMouseLeave={e => e.currentTarget.style.color = c.dim}>⚠</button>
            )}
            {/* Full pill CTA */}
            <button
              onClick={e => { e.stopPropagation(); onConnect(u); }}
              style={{
                padding: "9px 22px", borderRadius: 999,
                background: c.gradWarm,
                border: "none", color: "#fff",
                fontSize: 12, fontWeight: 700,
                cursor: "pointer", letterSpacing: .3,
                fontFamily: "'Montserrat', sans-serif",
                boxShadow: `0 4px 18px ${c.gold}28`,
                transition: "all .2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = ".88"; e.currentTarget.style.transform = "scale(1.04)"; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "scale(1)"; }}>
              {isBlurred ? "Sign Up →" : "Connect →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── GalleryModal ────────────────────────────────────────────────────────────
export function GalleryModal({ host, onClose }) {
  const photos = [host.profilePhoto, ...safeArr(host.photos)].filter(Boolean);
  const [idx, setIdx] = useState(0);
  if (!host) return null;
  return (
    <Modal onClose={onClose} wide>
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
          {photos[idx]
            ? <img src={photos[idx]} alt="" style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: 16, objectFit: "contain" }} />
            : <div style={{ padding: 60, color: c.sub }}>No photos</div>
          }
        </div>
        {photos.length > 1 && (
          <>
            <button onClick={() => setIdx(p => (p - 1 + photos.length) % photos.length)} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", background: "#0a0a0fcc", border: "none", color: c.text, width: 40, height: 40, borderRadius: "50%", cursor: "pointer", fontSize: 24 }}>‹</button>
            <button onClick={() => setIdx(p => (p + 1) % photos.length)}                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "#0a0a0fcc", border: "none", color: c.text, width: 40, height: 40, borderRadius: "50%", cursor: "pointer", fontSize: 24 }}>›</button>
          </>
        )}
        <div style={{ textAlign: "center", marginTop: 16, color: c.sub, fontSize: 12 }}>{idx + 1} / {photos.length}</div>
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: c.goldL }}>{host.name}</div>
          <div style={{ color: c.sub, fontSize: 13, marginTop: 4 }}>{host.bio}</div>
        </div>
      </div>
    </Modal>
  );
}

// ─── BrowseView ──────────────────────────────────────────────────────────────
export function BrowseView({ users, payments, onInitiatePayment, currentUser, toast, verifyPrompts, onAnswerVerify, setView, refundReqs, onRefundRequest, onHostApproveRefund, pendingHost, setPendingHost, callConfirmations, onConfirmCall, favorites, toggleFavorite }) {
  const [watcherContact,  setWatcherContact]  = useState("");
  const [watcherPlatform, setWatcherPlatform] = useState("WhatsApp");
  const [payModal,  setPayModal]  = useState(null);
  const [gallery,   setGallery]   = useState(null);
  const [watcher,   setWatcher]   = useState(currentUser?.name || "");
  const [paying,    setPaying]    = useState(false);
  const [page,      setPage]      = useState(1);
  const [filter,    setFilter]    = useState("all");
  const [refundModal,  setRefundModal]  = useState(null);
  const [refundReason, setRefundReason] = useState("");
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [search,        setSearch]        = useState("");
  const [selectedTags,  setSelectedTags]  = useState([]);
  const [reportModal,   setReportModal]   = useState(null);
  const [reportReason,  setReportReason]  = useState("");
  const [reportDetails, setReportDetails] = useState("");

  useEffect(() => { if (currentUser?.name) setWatcher(currentUser.name); }, [currentUser]);
  useEffect(() => { if (pendingHost && currentUser) { setPayModal(pendingHost); setPendingHost(null); } }, [pendingHost, currentUser]);
  useEffect(() => { setPage(1); }, [search, selectedTags, filter]);

  const pendingVP    = verifyPrompts.filter(v => !v.answered);
  const allHosts     = users.filter(u => u.role === "host");
  const onlineHosts  = allHosts.filter(u => u.online);
  const offlineHosts = allHosts.filter(u => !u.online);

  let filtered = filter === "online" ? onlineHosts : [...onlineHosts, ...offlineHosts];
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(u => u.name.toLowerCase().includes(q) || (u.bio || "").toLowerCase().includes(q));
  }
  if (selectedTags.length > 0) {
    filtered = filtered.filter(u => {
      const hostTags = safeArr(u.tags).map(t => t.toLowerCase());
      return selectedTags.some(tag => hostTags.includes(tag.toLowerCase()));
    });
  }

  const toggleTag = tag => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  const handleConnect = host => {
    if (!currentUser) { localStorage.setItem("pendingHost", JSON.stringify(host)); setShowLoginModal(true); return; }
    setPayModal(host);
  };

  const confirmPay = async () => {
    if (!watcher.trim()) { toast("Enter your name", "error"); return; }
    const cleanContact = watcherContact.replace(/\D/g, "");
    if (!cleanContact || (cleanContact.length !== 10 && cleanContact.length !== 11)) {
      toast("Enter a valid contact number (10 digits Ghana, 11 digits Nigeria)", "error"); return;
    }
    setPaying(true);
    await onInitiatePayment(payModal, { watcherName: watcher, watcherContact, watcherPlatform });
    setPaying(false);
  };

  const submitRefund = async () => {
    if (!refundModal) return;
    await onRefundRequest(refundModal.id, refundReason || "Call did not take place");
    setRefundModal(null); setRefundReason("");
  };

  const handleReport = host => {
    if (!currentUser) { setShowLoginModal(true); return; }
    setReportModal(host);
  };

  const submitReport = async () => {
    if (!reportReason.trim()) { toast("Please enter a reason", "error"); return; }
    await fetch(`${API_BASE}/api/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reporterId: currentUser?.id, reportedUsername: reportModal.name, reason: reportReason, details: reportDetails }),
    });
    toast("Report submitted. Thank you.");
    setReportModal(null); setReportReason(""); setReportDetails("");
  };

  const FEE_PCT      = 20;
  const feePreview   = payModal ? parseFloat((payModal.rate * FEE_PCT / 100).toFixed(2)) : 0;
  const totalPreview = payModal ? payModal.rate + feePreview : 0;
  const currencySymbol = payModal?.country === "Nigeria" ? "₦" : S;

  return (
    <div style={{ minHeight: "calc(100vh - 60px)" }}>

      {/* Verify prompts banner */}
      {pendingVP.length > 0 && (
        <div style={{ background: `${c.gold}18`, borderBottom: `1px solid ${c.gold}`, padding: "14px 40px" }}>
          <div style={{ fontWeight: 600, color: c.goldL, marginBottom: 8 }}>📋 Admin Verification Request</div>
          {pendingVP.map(vp => (
            <div key={vp.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
              <span style={{ color: c.sub, fontSize: 13, flex: 1 }}>Did the video call take place?</span>
              <Btn variant="green" small onClick={() => onAnswerVerify(vp.id, true)}>Yes</Btn>
              <Btn variant="red"   small onClick={() => onAnswerVerify(vp.id, false)}>Dispute</Btn>
            </div>
          ))}
        </div>
      )}

      {/* Pending call confirmation banner (watcher) */}
      {currentUser?.role === "watcher" && (() => {
        const myPaymentIds = new Set(payments.filter(p => p.watcher_id === currentUser.id || p.watcher_name?.toLowerCase() === currentUser.name?.toLowerCase()).map(p => p.id));
        const conf = (callConfirmations || []).find(c => c.status === "pending" && myPaymentIds.has(c.payment_id));
        if (!conf) return null;
        return (
          <div style={{ background: `linear-gradient(135deg,${c.gold}20,${c.goldD})`, borderBottom: `2px solid ${c.gold}`, padding: "18px 40px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 24 }}>📞</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: c.goldL, marginBottom: 2 }}>Did the call happen?</div>
              <div style={{ color: c.sub, fontSize: 12 }}>Your host marked this call as done. Confirm to release their payment.</div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn variant="green" small onClick={() => onConfirmCall(conf.id, "yes")}>✓ Yes — Pay Host</Btn>
              <Btn variant="red"   small onClick={() => onConfirmCall(conf.id, "no")}>✕ Dispute</Btn>
            </div>
          </div>
        );
      })()}

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 24px" }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 36, fontWeight: 300, marginBottom: 6 }}>Find Your Consultant</div>

        {!currentUser && (
          <div style={{ background: `${c.gold}15`, border: `1px solid ${c.gold}40`, borderRadius: 20, padding: "12px 20px", marginBottom: 18, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 18 }}>🔐</span>
            <span style={{ color: c.sub, fontSize: 13, flex: 1 }}>Sign up to see full profiles, photos, and rates</span>
            <Btn small onClick={() => setView("signup")}>Sign Up Free →</Btn>
            <Btn small variant="ghost" onClick={() => setView("login")}>Sign In</Btn>
          </div>
        )}

        {/* Search — rounder input */}
        <div style={{ marginBottom: 14 }}>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or expertise…"
            style={{ width: "100%", maxWidth: 500, padding: "11px 18px", background: c.surface, border: `1px solid ${c.border}`, borderRadius: 999, color: c.text, fontSize: 14, fontFamily: "'Montserrat',sans-serif", outline: "none" }} />
        </div>

        {/* Filter tabs — pill buttons */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {["all", "online"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "8px 20px", borderRadius: 999,
              border: `1px solid ${filter === f ? c.gold : c.border}`,
              background: filter === f ? `${c.gold}18` : "transparent",
              color: filter === f ? c.goldL : c.sub,
              cursor: "pointer", fontSize: 13, fontFamily: "'Montserrat',sans-serif",
              fontWeight: filter === f ? 600 : 400,
              transition: "all .2s",
            }}>
              {f === "all" ? "All Consultants" : "🟢 Online Now"}
            </button>
          ))}
        </div>

        {/* Tag chips — full pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
          {ALL_TAGS.map(tag => (
            <button key={tag} onClick={() => toggleTag(tag)} style={{
              padding: "5px 14px", borderRadius: 999,
              border: `1px solid ${selectedTags.includes(tag) ? c.gold : c.border}`,
              background: selectedTags.includes(tag) ? `${c.gold}18` : "transparent",
              color: selectedTags.includes(tag) ? c.goldL : c.sub,
              cursor: "pointer", fontSize: 11,
              fontFamily: "'Montserrat',sans-serif",
              fontWeight: selectedTags.includes(tag) ? 600 : 400,
              transition: "all .2s",
            }}>{tag}</button>
          ))}
          {selectedTags.length > 0 && (
            <button onClick={() => setSelectedTags([])} style={{
              padding: "5px 14px", borderRadius: 999,
              border: `1px solid ${c.red}`,
              background: `${c.red}12`,
              color: c.red, cursor: "pointer", fontSize: 11,
              fontFamily: "'Montserrat',sans-serif",
            }}>✕ Clear</button>
          )}
        </div>

        <div style={{ color: c.sub, fontSize: 12, marginBottom: 16 }}>{filtered.length} consultant{filtered.length !== 1 ? "s" : ""} found</div>

        {filtered.length === 0 && (
          <div style={{ textAlign: "center", color: c.sub, padding: "60px 0" }}>
            No consultants match your filters.{" "}
            <span style={{ color: c.gold, cursor: "pointer" }} onClick={() => { setSearch(""); setSelectedTags([]); setFilter("all"); }}>Clear filters →</span>
          </div>
        )}

        {/* Grid + pagination */}
        {(() => {
          const PER_PAGE   = 12;
          const totalPages = Math.ceil(filtered.length / PER_PAGE);
          const paged      = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
          return (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 18 }}>
                {paged.map(u => (
                  <HostCard key={u.id} u={u} onConnect={handleConnect} setGallery={setGallery}
                    onReport={handleReport} onFavorite={toggleFavorite} currentUser={currentUser}
                    isFav={favorites.some(f => f.host_id === u.id && f.watcher_id === currentUser?.id)} />
                ))}
              </div>

              {/* Pagination — pill buttons */}
              {totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, marginTop: 32 }}>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    style={{
                      padding: "9px 22px", borderRadius: 999,
                      border: `1px solid ${c.border}`,
                      background: page === 1 ? c.surface : c.card,
                      color: page === 1 ? c.dim : c.text,
                      cursor: page === 1 ? "default" : "pointer",
                      fontSize: 13, fontFamily: "'Montserrat',sans-serif",
                    }}>← Prev</button>
                  <span style={{
                    padding: "9px 18px", borderRadius: 999,
                    background: `${c.gold}14`, border: `1px solid ${c.gold}30`,
                    color: c.goldL, fontSize: 12, fontWeight: 600,
                  }}>
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    style={{
                      padding: "9px 22px", borderRadius: 999,
                      border: `1px solid ${c.border}`,
                      background: page === totalPages ? c.surface : c.card,
                      color: page === totalPages ? c.dim : c.text,
                      cursor: page === totalPages ? "default" : "pointer",
                      fontSize: 13, fontFamily: "'Montserrat',sans-serif",
                    }}>Next →</button>
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Login prompt modal */}
      {showLoginModal && (
        <Modal onClose={() => setShowLoginModal(false)} title="Sign In to Continue">
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
            <div style={{ color: c.sub, fontSize: 14, marginBottom: 20, lineHeight: 1.7 }}>
              You need an account to connect with consultants.<br />It only takes a moment.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexDirection: "column" }}>
              <Btn onClick={() => { setShowLoginModal(false); setView("login"); }} full>Sign In</Btn>
              <Btn variant="ghost" onClick={() => { setShowLoginModal(false); setView("signup"); }} full>Create Account</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Pay modal */}
      {payModal && currentUser && (
        <Modal onClose={() => !paying && setPayModal(null)}>
          <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 20 }}>
            <Avatar user={payModal} size={56} ring />
            <div>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22 }}>{payModal.name}</div>
              <div style={{ color: c.sub, fontSize: 13 }}>via {payModal.platform}</div>
            </div>
          </div>

          {/* Escrow notice */}
          <div style={{ background: `${c.green}12`, border: `1px solid ${c.green}35`, borderRadius: 16, padding: "12px 16px", marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>🔒</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: c.green }}>Secure Escrow via Paystack</div>
              <div style={{ fontSize: 11, color: c.sub }}>Funds held securely. Contact revealed after payment.</div>
            </div>
          </div>

          {/* Price breakdown */}
          <div style={{ background: `${c.gold}10`, border: `1px solid ${c.gold}35`, borderRadius: 20, padding: 22, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: c.sub, fontSize: 13 }}>Consultation fee</span>
              <span style={{ fontWeight: 600 }}>{currencySymbol}{payModal.rate}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${c.border}` }}>
              <span style={{ color: c.sub, fontSize: 13 }}>Platform fee ({FEE_PCT}%)</span>
              <span style={{ color: c.sub }}>{currencySymbol}{feePreview}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600 }}>Total</span>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, color: c.goldL, fontWeight: 600 }}>{currencySymbol}{totalPreview.toFixed(2)}</div>
            </div>
          </div>

          <Field label="Your Name" value={watcher} onChange={setWatcher} disabled />
          <Field label="Contact Number *" value={watcherContact} onChange={setWatcherContact} type="tel" maxLength={11} hint={payModal?.country === "Nigeria" ? "11-digit Nigerian number" : "10-digit Ghana number"} />
          <Field label="Preferred Platform" value={watcherPlatform} onChange={setWatcherPlatform} options={["WhatsApp", "Telegram"]} />

          {!paying
            ? <Btn onClick={confirmPay} full style={{ marginTop: 8 }}>Pay {S}{totalPreview.toFixed(2)} Securely →</Btn>
            : <div style={{ textAlign: "center", padding: "22px 0" }}><Spinner /><div style={{ color: c.sub, marginTop: 12 }}>Preparing payment…</div></div>
          }
          <div style={{ textAlign: "center", marginTop: 10, color: c.dim, fontSize: 11 }}>Redirected to Paystack. Funds held in escrow.</div>
        </Modal>
      )}

      {/* Refund modal */}
      {refundModal && (
        <Modal onClose={() => setRefundModal(null)} title="Request Refund">
          <div style={{ marginBottom: 16, padding: "14px 16px", borderRadius: 16, background: `${c.orange}14`, border: `1px solid ${c.orange}35` }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Payment: {S}{refundModal.total_charged || refundModal.amount}</div>
            <div style={{ fontSize: 12, color: c.sub }}>
              {refundModal.status === "pending" ? "Payment not yet confirmed. 70% automatic refund available." : "Payment confirmed. Host must approve the refund."}
            </div>
          </div>
          <Field label="Reason" value={refundReason} onChange={setRefundReason} rows={3} placeholder="e.g. Host didn't show up" />
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <Btn variant="orange" onClick={submitRefund} full>Submit Request</Btn>
            <Btn variant="surface" onClick={() => setRefundModal(null)} small>Cancel</Btn>
          </div>
        </Modal>
      )}

      {/* Report modal */}
      {reportModal && (
        <Modal onClose={() => setReportModal(null)} title={`Report ${reportModal.name}`}>
          <div style={{ marginBottom: 16, color: c.sub, fontSize: 13 }}>Report this consultant for violating terms or suspicious behavior.</div>
          <Field label="Reason *" value={reportReason} onChange={setReportReason} options={["Did not show up", "Fake profile", "Inappropriate behavior", "Scam/fraud", "Other"]} />
          <Field label="Details" value={reportDetails} onChange={setReportDetails} rows={3} placeholder="Describe what happened…" />
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <Btn variant="red" onClick={submitReport} full>Submit Report</Btn>
            <Btn variant="surface" onClick={() => setReportModal(null)} small>Cancel</Btn>
          </div>
        </Modal>
      )}

      {gallery && <GalleryModal host={gallery} onClose={() => setGallery(null)} />}
    </div>
  );
}