import { useState } from "react";
import { c, S } from "../constants";
import { safeArr } from "../utils";
import { Btn, Field, Chip, OnlineDot, Spinner } from "../components/UI";
import { HostRating, HostResponseRate } from "../components/HostRating";

export function ProfileView({ host, setView, currentUser, onInitiatePayment, toast }) {
  const [watcherContact, setWatcherContact]   = useState("");
  const [watcherPlatform, setWatcherPlatform] = useState("WhatsApp");
  const [paying, setPaying]   = useState(false);
  const [showPay, setShowPay] = useState(false);
  const allPhotos = [host.profilePhoto, ...safeArr(host.photos)].filter(Boolean);
  const [idx, setIdx]         = useState(0);
  const isBlurred = !currentUser;

  const FEE_PCT     = 20;
  const feePreview  = parseFloat((host.rate * FEE_PCT / 100).toFixed(2));
  const totalPreview = host.rate + feePreview;

  const shareLink = `${window.location.origin}/?host=${encodeURIComponent(host.name)}`;
  const copyLink  = () => { navigator.clipboard.writeText(shareLink); toast("Link copied! 📋"); };

  const handlePay = async () => {
    if (!currentUser) { toast("Please sign in first", "error"); setView("login"); return; }
    if (!watcherContact || watcherContact.length !== 10) { toast("Enter valid 10-digit number", "error"); return; }
    setPaying(true);
    await onInitiatePayment(host, { watcherName: currentUser.name, watcherContact, watcherPlatform });
    setPaying(false);
  };

  return (
    <div style={{ minHeight: "calc(100vh - 60px)", maxWidth: 600, margin: "0 auto", padding: "32px 24px" }}>
      <button onClick={() => setView("browse")} style={{ background: "none", border: "none", color: c.gold, cursor: "pointer", marginBottom: 20, fontSize: 13 }}>← Back to Browse</button>

      {/* Photo carousel */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "4/3", borderRadius: 16, overflow: "hidden", marginBottom: 20, background: c.surface }}>
        {allPhotos.length > 0
          ? <img src={allPhotos[idx]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: isBlurred ? "blur(12px) brightness(0.6)" : "none", transform: isBlurred ? "scale(1.05)" : "none" }} />
          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cormorant Garamond',serif", fontSize: 72, color: c.gold, opacity: .3 }}>{host.avatar}</div>
        }
        {isBlurred && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, zIndex: 3 }}>
            <div style={{ fontSize: 36 }}>🔐</div>
            <div style={{ color: "#fff", fontWeight: 600, fontSize: 15, textAlign: "center", lineHeight: 1.5 }}>Sign up to view<br />full profile</div>
            <Btn small onClick={() => setView("signup")} style={{ marginTop: 4 }}>Sign Up Free →</Btn>
          </div>
        )}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, background: "linear-gradient(to top,#000000cc,transparent)" }} />
        <div style={{ position: "absolute", top: 12, right: 12, display: "flex", alignItems: "center", gap: 5, background: "#0a0a0f99", padding: "4px 10px", borderRadius: 20 }}>
          <OnlineDot on={host.online} />
          <span style={{ fontSize: 11, color: host.online ? c.green : c.dim }}>{host.online ? "Live" : "Offline"}</span>
        </div>
        {!isBlurred && allPhotos.length > 1 && (
          <>
            <button onClick={() => setIdx(p => (p - 1 + allPhotos.length) % allPhotos.length)} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", background: "#0a0a0faa", border: "none", color: c.text, width: 32, height: 32, borderRadius: "50%", cursor: "pointer", fontSize: 18 }}>‹</button>
            <button onClick={() => setIdx(p => (p + 1) % allPhotos.length)}                   style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "#0a0a0faa", border: "none", color: c.text, width: 32, height: 32, borderRadius: "50%", cursor: "pointer", fontSize: 18 }}>›</button>
          </>
        )}
      </div>

      {/* Info */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 32, fontWeight: 600, marginBottom: 4 }}>{host.name}</div>
        {!isBlurred && <HostRating hostId={host.id} />}
        {!isBlurred && <HostResponseRate hostId={host.id} />}
        <div style={{ color: c.sub, fontSize: 14, marginBottom: 12 }}>{isBlurred ? "Sign up to read full bio" : host.bio}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {isBlurred ? [1, 2, 3].map(i => <Chip key={i} label="••••" />) : safeArr(host.tags).map(t => <Chip key={t} label={t} />)}
        </div>
        <div style={{ color: c.sub, fontSize: 13 }}>via {host.platform}</div>
      </div>

      {/* Rate card */}
      <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 14, padding: 20, marginBottom: 20, textAlign: "center" }}>
        <div style={{ color: c.sub, fontSize: 12, marginBottom: 4 }}>Consultation Fee</div>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 42, color: isBlurred ? c.sub : c.goldL, fontWeight: 600 }}>
          {isBlurred ? "₵ ••" : `${S}${host.rate}`}
        </div>
        <div style={{ color: c.dim, fontSize: 11, marginTop: 2 }}>per call via {host.platform}</div>
      </div>

      {/* CTA */}
      {isBlurred ? (
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexDirection: "column" }}>
          <Btn onClick={() => setView("signup")} full>Sign Up to Connect →</Btn>
          <Btn variant="ghost" onClick={() => setView("login")} full>Already have an account? Sign In</Btn>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <Btn onClick={() => setShowPay(!showPay)} style={{ flex: 1 }}>{showPay ? "Cancel" : "Connect Now ✦"}</Btn>
            <Btn variant="ghost" onClick={copyLink} small style={{ flex: 0 }}>📋 Share</Btn>
          </div>
          {showPay && (
            <div className="fu" style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
              <div style={{ fontWeight: 600, marginBottom: 14 }}>Enter Your Details</div>
              <div style={{ background: `${c.gold}12`, borderRadius: 10, padding: 12, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: c.sub, fontSize: 13 }}>Total ({FEE_PCT}% platform fee included)</span>
                <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, color: c.goldL, fontWeight: 600 }}>{S}{totalPreview.toFixed(2)}</span>
              </div>
              <Field label="Your Contact Number" value={watcherContact} onChange={setWatcherContact} type="tel" maxLength={10} placeholder="10-digit number" />
              <Field label="Platform" value={watcherPlatform} onChange={setWatcherPlatform} options={["WhatsApp", "Telegram"]} />
              {!paying
                ? <Btn onClick={handlePay} full>Pay {S}{totalPreview.toFixed(2)} Securely →</Btn>
                : <div style={{ textAlign: "center", padding: 16 }}><Spinner /></div>
              }
            </div>
          )}
        </>
      )}
    </div>
  );
}