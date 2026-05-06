import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabase";

const API_BASE      = import.meta.env.VITE_API_URL || "http://localhost:4000";
const PAYOUT_PROVIDERS = ["MTN","VOD","ATL"];
const CURRENCY = "GHS";
const S = "₵";

const c = {
  bg:"#0a0a0f", surface:"#111118", card:"#16161f",
  border:"#ffffff12", gold:"#c9a84c", goldL:"#e8c97a", goldD:"#c9a84c22",
  text:"#f0ede8", sub:"#8a8799", dim:"#45435a",
  green:"#3ecf8e", red:"#f04444", blue:"#4a9eff",
  orange:"#f97316", purple:"#a855f7", pink:"#ec4899", rose:"#f43f5e",
};

const ALL_TAGS = ["tarot","career","love","wellness","spiritual","meditation","coaching","finance","fitness","yoga","astrology","therapy"];

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300&family=DM+Mono:wght@400&family=Plus+Jakarta+Sans:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:${c.bg};color:${c.text};font-family:'Plus Jakarta Sans',sans-serif;min-height:100vh;overflow-x:hidden}
  ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:${c.bg}}::-webkit-scrollbar-thumb{background:${c.gold};border-radius:2px}
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes pulse{0%,100%{box-shadow:0 0 0 0 ${c.green}44}70%{box-shadow:0 0 8px transparent}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes glow{0%,100%{box-shadow:0 0 20px ${c.gold}25}50%{box-shadow:0 0 40px ${c.gold}55}}
  @keyframes slideIn{from{transform:translateX(110%);opacity:0}to{transform:translateX(0);opacity:1}}
  @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
  @keyframes petalFall{0%{transform:translateY(-10vh) rotate(0deg);opacity:1}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}
  @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
  @keyframes borderGlow{0%,100%{border-color:${c.gold}40}50%{border-color:${c.gold}}} 
  .fu{animation:fadeUp .4s ease forwards}
  .fi{animation:fadeIn .6s ease forwards}
  .glow{animation:glow 3s ease-in-out infinite}
  .float{animation:float 4s ease-in-out infinite}
  .shimmer{background:linear-gradient(90deg,transparent,${c.gold}20,transparent);background-size:200% 100%;animation:shimmer 2s infinite}
  input:focus,select:focus,textarea:focus{border-color:${c.gold}!important;outline:none;box-shadow:0 0 0 2px ${c.gold}30}
  button:hover{opacity:.88}
`;

async function uploadFile(bucket, file) {
  const ext = file.name.split(".").pop();
  const path = `public/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
  if (error) { console.error("Upload error:", error); return null; }
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return urlData.publicUrl;
}

function safeArr(val) {
  if (Array.isArray(val)) return val.filter(v => v && v !== "[]" && v !== "{}");
  if (typeof val === "string" && val.length > 0) {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.filter(v => v && v !== "[]" && v !== "{}");
    } catch {}
    if (val === "[]" || val === "{}") return [];
    return val.split(",").map(t => t.trim()).filter(v => v && v !== "[]" && v !== "{}");
  }
  return [];
}

function normaliseUser(row) {
  return {
    ...row,
    contactNumber: row.contact_number ?? row.contactNumber ?? "",
    profilePhoto:  row.profile_photo  ?? row.profilePhoto  ?? null,
    photos:        safeArr(row.photos),
    tags:          safeArr(row.tags),
    wallet:        Number(row.wallet  ?? 0),
    online:        row.online  ?? true,
    role:          row.role    ?? "host",
    email:         row.email   ?? "",
    payoutName:     row.payout_name     ?? row.payoutName     ?? "",
    payoutNumber:   row.payout_number   ?? row.payoutNumber   ?? "",
    payoutProvider: row.payout_provider ?? row.payoutProvider ?? "",
    paystackRecipientCode: row.paystack_recipient_code ?? row.paystackRecipientCode ?? "",
    avatar: (row.name || "?").split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase(),
  };
}

async function apiInitializePayment(payload) {
  const res = await fetch(`${API_BASE}/api/pay/initialize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
  });
  return res.json();
}

async function apiVerifyPayment(reference) {
  const res = await fetch(`${API_BASE}/api/pay/verify/${reference}`);
  return res.json();
}

async function apiConfirmPayment(paymentId) {
  const res = await fetch(`${API_BASE}/api/admin/confirm-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": "my-secret-token-123" },
    body: JSON.stringify({ paymentId }),
  });
  return res.json();
}

async function apiReleaseFunds(callId, paymentId) {
  const res = await fetch(`${API_BASE}/api/admin/release-funds`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": "my-secret-token-123" },
    body: JSON.stringify({ callId, paymentId }),
  });
  return res.json();
}

async function apiOnboardPayout(hostId, payoutName, payoutNumber, payoutProvider) {
  const res = await fetch(`${API_BASE}/api/host/onboard-payout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hostId, payoutName, payoutNumber, payoutProvider }),
  });
  return res.json();
}

async function apiConfirmCall(confirmationId, watcherId, response) {
  const res = await fetch(`${API_BASE}/api/call/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmationId, watcherId, response }),
  });
  return res.json();
}

async function apiWatcherRefund(paymentId, reason, watcherId) {
  const res = await fetch(`${API_BASE}/api/watcher/refund`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentId, reason, watcherId }),
  });
  return res.json();
}

async function apiHostApproveRefund(refundId, hostId) {
  const res = await fetch(`${API_BASE}/api/host/approve-refund`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refundId, hostId }),
  });
  return res.json();
}

async function apiAdminApproveRefund(refundId) {
  const res = await fetch(`${API_BASE}/api/admin/approve-refund`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": "my-secret-token-123" },
    body: JSON.stringify({ refundId }),
  });
  return res.json();
}

function Spinner({ size=36 }) {
  return <div style={{ width:size, height:size, border:`3px solid ${c.gold}`, borderTopColor:"transparent", borderRadius:"50%", animation:"spin 1s linear infinite" }} />;
}

function SkeletonCard() {
  return (
    <div style={{ background:`linear-gradient(180deg,${c.card},#1a1a24)`, border:`1px solid ${c.border}`, borderRadius:18, overflow:"hidden" }}>
      <div className="shimmer" style={{ width:"100%", aspectRatio:"1/1", background:c.surface }} />
      <div style={{ padding:"14px 16px 16px" }}>
        <div className="shimmer" style={{ height:18, width:"70%", borderRadius:4, marginBottom:8 }} />
        <div className="shimmer" style={{ height:12, width:"90%", borderRadius:4, marginBottom:4 }} />
        <div className="shimmer" style={{ height:12, width:"50%", borderRadius:4, marginBottom:12 }} />
        <div style={{ display:"flex", gap:4, marginBottom:10 }}>
          <div className="shimmer" style={{ height:20, width:50, borderRadius:20 }} />
          <div className="shimmer" style={{ height:20, width:50, borderRadius:20 }} />
        </div>
        <div style={{ display:"flex", justifyContent:"space-between" }}>
          <div className="shimmer" style={{ height:22, width:60, borderRadius:4 }} />
          <div className="shimmer" style={{ width:30, height:30, borderRadius:"50%" }} />
        </div>
      </div>
    </div>
  );
}

function HostRating({ hostId }) {
  const [rating, setRating] = useState(null);
  useEffect(() => {
    fetch(`${API_BASE}/api/rating/${hostId}`).then(r=>r.json()).then(d=>{
      if (d.average) setRating(d);
    });
  }, [hostId]);
  if (!rating || rating.count===0) return null;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:4, marginBottom:6 }}>
      <span style={{ color:c.gold, fontSize:13 }}>{"★".repeat(Math.round(rating.average))}{"☆".repeat(5-Math.round(rating.average))}</span>
      <span style={{ color:c.sub, fontSize:10 }}>({rating.count})</span>
    </div>
  );
}

function OnlineDot({ on }) {
  return <span style={{ display:"inline-block", width:9, height:9, borderRadius:"50%", background:on?c.green:c.dim, animation:on?"pulse 2s infinite":"none", flexShrink:0 }} />;
}

function MobileNav({ setView, currentUser, isAdmin, handleLogout }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div style={{ 
        display:"none", 
        position:"fixed", bottom:0, left:0, right:0, 
        background:"#0a0a0fee", borderTop:`1px solid ${c.border}`,
        padding:"8px 16px 12px", zIndex:100, backdropFilter:"blur(20px)",
        justifyContent:"space-around", alignItems:"center"
      }} className="mobile-nav">
        <NavBtn icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        } label="Home" onClick={()=>setView("home")} />
        <NavBtn icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        } label="Browse" onClick={()=>setView("browse")} />
        {currentUser && !isAdmin && <NavBtn icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        } label="Dashboard" onClick={()=>setView("dashboard")} />}
        {isAdmin && <NavBtn icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        } label="Admin" onClick={()=>setView("admin")} />}
        {!currentUser && !isAdmin && <NavBtn icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        } label="Sign In" onClick={()=>setView("login")} />}
        <NavBtn icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
          </svg>
        } label="More" onClick={()=>setOpen(true)} />
      </div>

      {open && (
        <div style={{ display:"none", position:"fixed", inset:0, zIndex:200 }} className="mobile-nav" onClick={()=>setOpen(false)}>
          <div style={{ position:"absolute", bottom:70, left:16, right:16, background:c.card, border:`1px solid ${c.border}`, borderRadius:16, padding:8 }}
            onClick={e=>e.stopPropagation()}>
            <MobileMenuItem icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            } label="How It Works" onClick={()=>{setView("howItWorks");setOpen(false);}} />
            {!currentUser && <MobileMenuItem icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
              </svg>
            } label="Join" onClick={()=>{setView("signup");setOpen(false);}} />}
            {currentUser && <MobileMenuItem icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            } label="Logout" onClick={()=>{handleLogout();setOpen(false);}} />}
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .mobile-nav { display: flex !important; }
          .desktop-nav { display: none !important; }
          body { padding-bottom: 70px; }
        }
      `}</style>
    </>
  );
}

function NavBtn({ icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{ 
      background:"none", border:"none", color:c.sub, cursor:"pointer",
      display:"flex", flexDirection:"column", alignItems:"center", gap:4,
      padding:"4px 8px", fontSize:10, fontFamily:"'Plus Jakarta Sans',sans-serif",
      transition:"color .2s"
    }}
    onMouseEnter={e=>e.currentTarget.style.color=c.goldL}
    onMouseLeave={e=>e.currentTarget.style.color=c.sub}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function MobileMenuItem({ icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{
      width:"100%", padding:"12px 16px", background:"none", border:"none",
      color:c.text, cursor:"pointer", display:"flex", alignItems:"center", gap:10,
      fontSize:14, borderRadius:10, fontFamily:"'Plus Jakarta Sans',sans-serif",
      transition:"background .2s"
    }}
    onMouseEnter={e=>e.currentTarget.style.background=c.surface}
    onMouseLeave={e=>e.currentTarget.style.background="none"}>
      {icon} {label}
    </button>
  );
}

function Avatar({ user, size=48, ring=false }) {
  if (user?.profilePhoto) {
    return <img src={user.profilePhoto} alt="" style={{ width:size, height:size, borderRadius:"50%", objectFit:"cover", flexShrink:0, border:`2px solid ${ring?c.gold:c.border}` }} />;
  }
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", flexShrink:0, background:ring?`linear-gradient(135deg,${c.gold},${c.goldL})`:`linear-gradient(135deg,#252535,#353545)`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Cormorant Garamond',serif", fontSize:size*.36, fontWeight:600, color:ring?"#0a0a0f":c.text }}>
      {user?.avatar || "?"}
    </div>
  );
}

function Chip({ label, color=c.sub }) {
  return <span style={{ padding:"3px 10px", borderRadius:20, border:`1px solid ${c.border}`, fontSize:11, color, letterSpacing:.4 }}>{label}</span>;
}

function Btn({ children, onClick, variant="gold", small=false, disabled=false, full=false, style:s={} }) {
  const styles = {
    gold:    { background:`linear-gradient(135deg,${c.gold},${c.goldL})`, color:"#0a0a0f", border:"none" },
    ghost:   { background:"transparent", color:c.gold, border:`1px solid ${c.gold}` },
    surface: { background:c.card, color:c.text, border:`1px solid ${c.border}` },
    green:   { background:c.green, color:"#0a0a0f", border:"none" },
    red:     { background:c.red,   color:"#fff",    border:"none" },
    orange:  { background:c.orange, color:"#fff",   border:"none" },
    purple:  { background:c.purple, color:"#fff",   border:"none" },
    pink:    { background:`linear-gradient(135deg,${c.pink},${c.rose})`, color:"#fff", border:"none" },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6, padding:small?"8px 16px":"11px 26px", borderRadius:8, cursor:disabled?"not-allowed":"pointer", fontSize:small?12:14, fontWeight:600, letterSpacing:.4, fontFamily:"'Plus Jakarta Sans',sans-serif", opacity:disabled?.45:1, transition:"all .2s", width:full?"100%":"auto", ...styles[variant], ...s }}>
      {children}
    </button>
  );
}

function Modal({ children, onClose, title, wide=false, noPadding=false }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"#000000cc", display:"flex", alignItems:"center", justifyContent:"center", zIndex:999, padding:20, backdropFilter:"blur(12px)", animation:"fadeIn .3s ease" }}
      onClick={e=>e.target===e.currentTarget&&onClose?.()}>
      <div style={{ background:c.card, border:`1px solid ${c.border}`, borderRadius:20, padding:noPadding?0:32, maxWidth:wide?680:460, width:"100%", animation:"fadeUp .3s ease", maxHeight:"92vh", overflowY:"auto", boxShadow:"0 32px 80px #000000aa" }}>
        {title && <div style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:600, color:c.goldL, marginBottom:22, padding:noPadding?"24px 32px 0":0 }}>{title}</div>}
        <div style={{ padding:noPadding?"0 32px 32px":0 }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type="text", options, placeholder, rows, hint, disabled=false, maxLength }) {
  const base = { width:"100%", padding:"10px 14px", background:c.surface, border:`1px solid ${c.border}`, borderRadius:8, color:c.text, fontSize:14, fontFamily:"'Plus Jakarta Sans',sans-serif", transition:"all .2s" };
  return (
    <div style={{ marginBottom:16 }}>
      <label style={{ display:"block", fontSize:11, letterSpacing:1, color:c.sub, marginBottom:5, textTransform:"uppercase", fontWeight:500 }}>{label}</label>
      {options
        ? <select value={value} onChange={e=>onChange(e.target.value)} style={base} disabled={disabled}>{options.map(o=><option key={o} value={o}>{o}</option>)}</select>
        : rows
          ? <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{...base,resize:"vertical"}} disabled={disabled} maxLength={maxLength} />
          : <input type={type} value={value} onChange={e=>{
              if (maxLength && e.target.value.length > maxLength) return;
              if (type==="tel") { const v=e.target.value.replace(/\D/g,""); onChange(v.slice(0,10)); return; }
              onChange(e.target.value);
            }} placeholder={placeholder} style={base} disabled={disabled} maxLength={maxLength} />
      }
      {hint && <div style={{ fontSize:11, color:c.dim, marginTop:4 }}>{hint}</div>}
    </div>
  );
}

function Toast({ toasts }) {
  return (
    <div style={{ position:"fixed", top:18, right:18, zIndex:9999, display:"flex", flexDirection:"column", gap:8, pointerEvents:"none" }}>
      {toasts.map(t=>(
        <div key={t.id} style={{ background:t.type==="error"?c.red:t.type==="info"?c.blue:t.type==="warning"?c.orange:c.green, color:"#0a0a0f", padding:"11px 18px", borderRadius:10, fontWeight:600, fontSize:13, animation:"slideIn .3s ease", boxShadow:"0 4px 20px #00000066", maxWidth:300 }}>{t.msg}</div>
      ))}
    </div>
  );
}

function PhotoPick({ label, value, onChange, circle=false }) {
  const ref = useRef();
  const sz = circle ? 80 : 96;
  const preview = value instanceof File ? URL.createObjectURL(value) : value;
  return (
    <div style={{ marginBottom:18 }}>
      <label style={{ display:"block", fontSize:11, letterSpacing:1, color:c.sub, marginBottom:8, textTransform:"uppercase", fontWeight:500 }}>{label}</label>
      <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
        {preview && (
          <div style={{ position:"relative" }}>
            <img src={preview} alt="" style={{ width:sz, height:sz, borderRadius:circle?"50%":10, objectFit:"cover", border:`2px solid ${c.gold}` }} />
            <button onClick={()=>onChange(null)} style={{ position:"absolute", top:-7, right:-7, width:20, height:20, borderRadius:"50%", background:c.red, color:"#fff", border:"none", cursor:"pointer", fontSize:11, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
          </div>
        )}
        <div onClick={()=>ref.current.click()} style={{ width:sz, height:sz, borderRadius:circle?"50%":10, border:`2px dashed ${c.border}`, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", cursor:"pointer", color:c.sub, fontSize:11, gap:4 }}
          onMouseEnter={e=>e.currentTarget.style.borderColor=c.gold}
          onMouseLeave={e=>e.currentTarget.style.borderColor=c.border}>
          <span style={{ fontSize:22, lineHeight:1 }}>+</span><span>Upload</span>
        </div>
        <input ref={ref} type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{ const f=e.target.files[0]; if(f) onChange(f); e.target.value=""; }} />
      </div>
    </div>
  );
}

function MultiPick({ label, value=[], onChange, max=4 }) {
  const ref = useRef();
  const safeValue = safeArr(value);
  const previews = safeValue.map(v => v instanceof File ? URL.createObjectURL(v) : v);
  return (
    <div style={{ marginBottom:18 }}>
      <label style={{ display:"block", fontSize:11, letterSpacing:1, color:c.sub, marginBottom:8, textTransform:"uppercase", fontWeight:500 }}>{label} (up to {max})</label>
      <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
        {previews.map((src,i)=>(
          <div key={i} style={{ position:"relative" }}>
            <img src={src} alt="" style={{ width:88, height:88, borderRadius:10, objectFit:"cover", border:`2px solid ${c.gold}40` }} />
            <button onClick={()=>onChange(safeValue.filter((_,j)=>j!==i))} style={{ position:"absolute", top:-7, right:-7, width:20, height:20, borderRadius:"50%", background:c.red, color:"#fff", border:"none", cursor:"pointer", fontSize:11, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
          </div>
        ))}
        {safeValue.length < max && (
          <div onClick={()=>ref.current.click()} style={{ width:88, height:88, borderRadius:10, border:`2px dashed ${c.border}`, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", cursor:"pointer", color:c.sub, fontSize:11, gap:4 }}
            onMouseEnter={e=>e.currentTarget.style.borderColor=c.gold}
            onMouseLeave={e=>e.currentTarget.style.borderColor=c.border}>
            <span style={{ fontSize:22, lineHeight:1 }}>+</span><span>Add</span>
          </div>
        )}
        <input ref={ref} type="file" accept="image/*" multiple style={{ display:"none" }}
          onChange={e=>{ const files=Array.from(e.target.files).slice(0,max-safeValue.length); onChange([...safeValue,...files].slice(0,max)); e.target.value=""; }} />
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }) {
  return (
    <div style={{ marginBottom:20, paddingBottom:16, borderBottom:`1px solid ${c.border}` }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
        <span style={{ fontSize:22 }}>{icon}</span>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20, color:c.goldL, fontWeight:600 }}>{title}</div>
      </div>
      {subtitle && <div style={{ color:c.sub, fontSize:12 }}>{subtitle}</div>}
    </div>
  );
}

function Petals() {
  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
      {[...Array(15)].map((_,i)=>(
        <div key={i} style={{
          position:"absolute",
          left:`${Math.random()*100}%`,
          top:`-${Math.random()*20}px`,
          fontSize:8+Math.random()*16,
          opacity:0.08+Math.random()*0.12,
          animation:`petalFall ${8+Math.random()*12}s linear infinite`,
          animationDelay:`${Math.random()*10}s`,
          color:i%3===0?c.goldL:i%3===1?c.pink:c.rose,
        }}>✦</div>
      ))}
    </div>
  );
}

function Nav({ setView, currentUser, isAdmin, handleLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <nav style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 32px", borderBottom:`1px solid ${c.border}`, background:"#0a0a0fee", position:"sticky", top:0, zIndex:100, backdropFilter:"blur(20px)" }}>
      <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:600, letterSpacing:2, color:c.goldL, cursor:"pointer" }} onClick={()=>setView("home")}>◈ CONNECTCALL</div>
      <div style={{ display:"flex", gap:8, alignItems:"center" }} className="desktop-nav">
        <Btn variant="ghost" small onClick={()=>setView("home")}>Home</Btn>
        <Btn variant="ghost" small onClick={()=>setView("browse")}>Browse</Btn>
        <Btn variant="ghost" small onClick={()=>setView("howItWorks")}>How It Works</Btn>
        {currentUser && !isAdmin && (
          <>
            {(currentUser.role === "host" || currentUser.role === "watcher") && (
              <Btn variant="surface" small onClick={()=>setView("dashboard")}>{currentUser.name.split(" ")[0]}'s Dashboard</Btn>
            )}
            <Btn variant="ghost" small onClick={handleLogout}>Logout</Btn>
          </>
        )}
        {isAdmin && (
          <>
            <Btn variant="ghost" small onClick={()=>setView("admin")} style={{ borderColor:c.red, color:c.red }}>Admin</Btn>
            <Btn variant="ghost" small onClick={handleLogout}>Logout</Btn>
          </>
        )}
        {!currentUser && !isAdmin && (
          <>
            <Btn variant="surface" small onClick={()=>setView("login")}>Sign In</Btn>
            <Btn small onClick={()=>setView("signup")}>Join</Btn>
          </>
        )}
      </div>
      <button onClick={()=>setMenuOpen(!menuOpen)} style={{ display:"none", background:"none", border:"none", color:c.text, fontSize:24, cursor:"pointer" }}
        className="mobile-menu-btn">☰</button>
      {menuOpen && (
        <div style={{ position:"absolute", top:60, right:16, background:c.card, border:`1px solid ${c.border}`, borderRadius:12, padding:16, display:"flex", flexDirection:"column", gap:8, zIndex:200, minWidth:180, boxShadow:"0 16px 40px #00000088" }}>
          <Btn variant="ghost" small full onClick={()=>{setView("home");setMenuOpen(false);}}>Home</Btn>
          <Btn variant="ghost" small full onClick={()=>{setView("browse");setMenuOpen(false);}}>Browse</Btn>
          <Btn variant="ghost" small full onClick={()=>{setView("howItWorks");setMenuOpen(false);}}>How It Works</Btn>
          {!currentUser && !isAdmin && (
            <>
              <Btn variant="surface" small full onClick={()=>{setView("login");setMenuOpen(false);}}>Sign In</Btn>
              <Btn small full onClick={()=>{setView("signup");setMenuOpen(false);}}>Join</Btn>
            </>
          )}
          {currentUser && <Btn variant="ghost" small full onClick={()=>{handleLogout();setMenuOpen(false);}}>Logout</Btn>}
        </div>
      )}
    </nav>
  );
}

export default function App() {
  const [callConfirmations, setCallConfirmations] = useState([]);
  const [view, setView]               = useState("home");
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin]         = useState(false);
  const [users, setUsers]             = useState([]);
  const [payments, setPayments]       = useState([]);
  const [calls, setCalls]             = useState([]);
  const [reports, setReports]         = useState([]);
  const [verifyPrompts, setVP]        = useState([]);
  const [refundReqs, setRefundReqs]   = useState([]);
  const [favorites, setFavorites]     = useState([]);
  const [adminWallet, setAdminWallet] = useState(0);
  const [loading, setLoading]         = useState(true);
  const [toasts, setToasts]           = useState([]);
  const [pendingHost, setPendingHost] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    const savedAdmin = localStorage.getItem("isAdmin");
    const savedUser  = localStorage.getItem("user");
    const savedView  = localStorage.getItem("view");
    const savedHost  = localStorage.getItem("pendingHost");
    if (savedAdmin === "true") { setIsAdmin(true); setView("admin"); return; }
    if (savedHost) {
      try { setPendingHost(JSON.parse(savedHost)); localStorage.removeItem("pendingHost"); } catch {}
    }
    if (savedUser) {
      try {
        const parsed = normaliseUser(JSON.parse(savedUser));
        setCurrentUser(parsed);
        if (savedView) setView(savedView);
      } catch { localStorage.clear(); }
    }
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const ref = url.searchParams.get("ref");
    if (ref && (url.pathname === "/payment-callback" || url.search.includes("ref="))) {
      window.history.replaceState({}, "", "/");
      apiVerifyPayment(ref).then(result => {
        if (result.success) {
          toast("Payment verified! Your request is now pending review ✦");
          try {
            const saved = JSON.parse(localStorage.getItem("user") || "{}");
            setView(saved.role === "watcher" ? "dashboard" : "browse");
          } catch { setView("browse"); }
          supabase.from("payments").select("*").order("created_at", { ascending:false }).then(({ data }) => {
            if (data) setPayments(data.map(r=>({ ...r, ts:new Date(r.created_at), targetUserId:r.target_user_id, watcherName:r.watcher_name })));
          });
        } else {
          toast(result.error || "Payment verification failed", "error");
        }
      });
    }
  }, []);

  useEffect(() => {
    const handleOffline = async () => {
      const savedUser = localStorage.getItem("user");
      if (savedUser) {
        try { const p = JSON.parse(savedUser); await supabase.from("users").update({ online:false }).eq("id",p.id); } catch {}
      }
    };
    window.addEventListener("beforeunload", handleOffline);
    return () => window.removeEventListener("beforeunload", handleOffline);
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;
    supabase.from("users").update({ online:true }).eq("id", currentUser.id);
    const hb = setInterval(() => supabase.from("users").update({ online:true }).eq("id", currentUser.id), 30000);
    return () => { clearInterval(hb); supabase.from("users").update({ online:false }).eq("id", currentUser.id); };
  }, [currentUser?.id]);

  useEffect(() => {
    const channel = supabase.channel("realtime-updates")
      .on("postgres_changes", { event:"*", schema:"public", table:"payments" }, (payload) => {
        const newRow = payload.new;
        setPayments(prev => { const exists = prev.find(p => p.id === newRow.id); return exists ? prev.map(p => p.id===newRow.id ? newRow : p) : [newRow, ...prev]; });
      })
      .on("postgres_changes", { event:"*", schema:"public", table:"calls" }, (payload) => {
        const newRow = payload.new;
        setCalls(prev => { const exists = prev.find(cl => cl.id===newRow.id); return exists ? prev.map(cl => cl.id===newRow.id ? newRow : cl) : [newRow, ...prev]; });
      })
      .on("postgres_changes", { event:"*", schema:"public", table:"users" }, (payload) => {
        if (payload.eventType==="UPDATE") setUsers(prev => prev.map(u => u.id===payload.new.id ? normaliseUser(payload.new) : u));
      })
      .on("postgres_changes", { event:"*", schema:"public", table:"refund_requests" }, (payload) => {
        const newRow = payload.new;
        setRefundReqs(prev => { const exists = prev.find(r => r.id===newRow.id); return exists ? prev.map(r => r.id===newRow.id ? newRow : r) : [newRow, ...prev]; });
      })
      .on("postgres_changes", { event:"*", schema:"public", table:"call_confirmations" }, (payload) => {
        const newRow = payload.new;
        setCallConfirmations(prev => {
          const exists = prev.find(c => c.id === newRow.id);
          return exists ? prev.map(c => c.id===newRow.id ? newRow : c) : [newRow, ...prev];
        });
      })
      .on("postgres_changes", { event:"*", schema:"public", table:"favorites" }, (payload) => {
        if (payload.eventType === "INSERT") setFavorites(prev => [...prev, payload.new]);
        if (payload.eventType === "DELETE") setFavorites(prev => prev.filter(f => f.id !== payload.old.id));
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const toast = useCallback((msg, type="success") => {
    const id = Date.now();
    setToasts(t=>[...t,{id,msg,type}]);
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)), 4200);
  }, []);

  const handleLogout = async () => {
    if (currentUser?.id) await supabase.from("users").update({ online:false }).eq("id", currentUser.id);
    setCurrentUser(null); setIsAdmin(false); setView("home");
    localStorage.removeItem("user"); localStorage.removeItem("view"); localStorage.removeItem("isAdmin");
    // Clear remember-me on explicit logout
    localStorage.removeItem("rememberedName"); localStorage.removeItem("rememberedPass");
    toast("Logged out");
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hostName = params.get('host');
    if (hostName && users.length > 0) {
      const host = users.find(u => u.name.toLowerCase() === hostName.toLowerCase() && u.role === 'host');
      if (host) { setSelectedUser(host); setView('profile'); }
    }
  }, [users]);

  useEffect(() => {
    const run = async () => {
      try {
        await fetch(`${API_BASE}/api/admin/auto-confirm-pending`, { 
          method:"POST",
          headers: { 'x-admin-token': 'my-secret-token-123' }
        });
        await fetch(`${API_BASE}/api/call/check-expired`, { method:"POST" });
      } catch(e) {}
    };
    run();
    const interval = setInterval(run, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  useEffect(() => {
    (async () => {
      try {
        const [{ data:uRows },{ data:pRows },{ data:cRows },{ data:vRows },{ data:favRows },{ data:rRows },{ data:confRows },{ data:repRows }] = await Promise.all([
          supabase.from("users").select("*").order("created_at",{ ascending:false }),
          supabase.from("payments").select("*").order("created_at",{ ascending:false }),
          supabase.from("calls").select("*").order("created_at",{ ascending:false }),
          supabase.from("verify_prompts").select("*").order("created_at",{ ascending:false }),
          supabase.from("favorites").select("*"),
          supabase.from("refund_requests").select("*").order("created_at",{ ascending:false }),
          supabase.from("call_confirmations").select("*").order("created_at",{ ascending:false }),
          supabase.from("reports").select("*").order("created_at",{ ascending:false }),
        ]);
        if (uRows) {
          const mapped = uRows.map(normaliseUser);
          setUsers(mapped);
          const savedUser = localStorage.getItem("user");
          if (savedUser) {
            try {
              const parsed = JSON.parse(savedUser);
              const freshUser = mapped.find(u => u.id===parsed.id);
              if (freshUser) { setCurrentUser(freshUser); localStorage.setItem("user", JSON.stringify(freshUser)); supabase.from("users").update({ online:true }).eq("id", freshUser.id); }
            } catch {}
          }
        }
        if (confRows) setCallConfirmations(confRows);
        if (pRows) setPayments(pRows.map(r=>({ ...r, ts:new Date(r.created_at), targetUserId:r.target_user_id, watcherName:r.watcher_name })));
        if (cRows) setCalls(cRows.map(r=>({ ...r, ts:new Date(r.created_at), targetUserId:r.target_user_id, paymentId:r.payment_id })));
        if (vRows) setVP(vRows.map(r=>({ ...r, paymentId:r.payment_id })));
        if (favRows) setFavorites(favRows);
        if (rRows) setRefundReqs(rRows);
        if (repRows) setReports(repRows);
        if (pRows && cRows) {
          const releasedIds = new Set((cRows||[]).filter(r=>r.released).map(r=>r.payment_id));
          const held = (pRows||[]).filter(r=>!releasedIds.has(r.id) && r.status!=="refunded" && r.status!=="failed" && r.status!=="pending_init").reduce((a,r)=>a+Number(r.total_charged||r.amount),0);
          setAdminWallet(held);
        }
      } catch(e) { console.error("Load error:", e); toast("Failed to load data", "error"); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleSignup = async (formData) => {
    let profilePhotoUrl = null;
    if (formData.profilePhoto instanceof File) {
      profilePhotoUrl = await uploadFile("avatars", formData.profilePhoto);
      if (!profilePhotoUrl) { toast("Profile photo upload failed", "error"); return null; }
    }
    let photoUrls = [];
    for (const photo of (formData.photos||[])) {
      if (photo instanceof File) { const url = await uploadFile("gallery", photo); if (url) photoUrls.push(url); }
      else if (typeof photo==="string") photoUrls.push(photo);
    }
    const { data, error } = await supabase.from("users").insert([{
      name: formData.name, bio: formData.bio||"", platform: formData.platform||null,
      contact_number: formData.contactNumber||null, rate: formData.rate||0,
      tags: safeArr(formData.tags), profile_photo: profilePhotoUrl, photos: photoUrls,
      online: true, wallet: 0, password: formData.password||"pass1234",
      role: formData.role||"host", email: formData.email||"",
      payout_name: "", payout_number: "", payout_provider: "", paystack_recipient_code: "",
      accepted_terms: true, accepted_terms_at: new Date().toISOString(),
    }]).select();
    if (error) { toast(error.message||"Signup failed","error"); return null; }
    if (!data || data.length === 0) { toast("Signup failed","error"); return null; }
    const newUser = normaliseUser(data[0]);
    setUsers(x=>[newUser,...x]);
    setCurrentUser(newUser);
    if (formData.role === "host" && formData.payoutNumber && formData.payoutProvider) {
      const onboardResult = await apiOnboardPayout(newUser.id, formData.payoutName || formData.name, formData.payoutNumber, formData.payoutProvider);
      if (onboardResult.success) {
        newUser.paystackRecipientCode = onboardResult.recipientCode;
        newUser.payoutName = formData.payoutName || formData.name;
        newUser.payoutNumber = formData.payoutNumber;
        newUser.payoutProvider = formData.payoutProvider;
        setCurrentUser({...newUser});
        localStorage.setItem("user", JSON.stringify(newUser));
        toast("Payout setup complete! You'll receive payments automatically ✦");
      } else {
        toast("Profile created but payout setup failed: " + (onboardResult.error||"Unknown error"), "warning");
      }
    }
    const dest = "dashboard";
    setView(dest);
    localStorage.setItem("user", JSON.stringify(newUser));
    localStorage.setItem("view", dest);
    localStorage.setItem("isAdmin","false");
    if (newUser.role==="host" && Notification.permission==="default") Notification.requestPermission();
    if (newUser.role==="watcher") toast("Account created! Browse consultants ✦");
    else toast("Profile created! You're live ✦");
    if (newUser.role==="watcher" && pendingHost) setTimeout(() => setView("browse"), 500);
    return newUser;
  };

  const handleLogin = async (name, password) => {
    if (!name||!password) { toast("Enter login details","error"); return; }
    const inputName = name.trim().toLowerCase();
    const ADMIN_USER = import.meta.env.VITE_ADMIN_USER || "admin";
    const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASS || "admin123";
    if (inputName === ADMIN_USER.toLowerCase() && password === ADMIN_PASS) {
      setIsAdmin(true); setView("admin");
      localStorage.setItem("isAdmin","true"); localStorage.setItem("view","admin");
      toast("Admin access granted"); return;
    }
    const found = users.find(u=>u.name.toLowerCase()===inputName && (!u.password||u.password===password));
    if (!found) { toast("Name or password incorrect","error"); return; }
    const user = normaliseUser(found);
    setCurrentUser(user);
    const dest = "dashboard";
    setView(dest);
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("view", dest);
    localStorage.setItem("isAdmin","false");
    await supabase.from("users").update({ online:true }).eq("id", user.id);
    toast(`Welcome back, ${user.name.split(" ")[0]} ✦`);
  };

  const handleUpdateUser = async (formData) => {
    const id = formData.id;
    let profilePhotoUrl = formData.profilePhoto;
    if (formData.profilePhoto instanceof File) {
      profilePhotoUrl = await uploadFile("avatars", formData.profilePhoto);
      if (!profilePhotoUrl) { toast("Photo upload failed","error"); return; }
    }
    let photoUrls = [];
    for (const photo of safeArr(formData.photos)) {
      if (photo instanceof File) { const url = await uploadFile("gallery", photo); if (url) photoUrls.push(url); }
      else if (typeof photo==="string") photoUrls.push(photo);
    }
    const { data, error } = await supabase.from("users").update({
      name:formData.name, bio:formData.bio, platform:formData.platform,
      contact_number:formData.contactNumber, rate:Number(formData.rate),
      tags:safeArr(formData.tags), profile_photo:profilePhotoUrl, photos:photoUrls,
    }).eq("id",id).select();
    if (error) { toast("Update failed: "+error.message,"error"); return; }
    if (!data || data.length === 0) { toast("Update failed","error"); return; }
    if (formData.payoutNumber && formData.payoutProvider) {
      const onboardResult = await apiOnboardPayout(id, formData.payoutName || formData.name, formData.payoutNumber, formData.payoutProvider);
      if (!onboardResult.success) toast("Profile updated but payout setup failed: " + onboardResult.error, "warning");
    }
    const u = normaliseUser(data[0]);
    setUsers(x=>x.map(xu=>xu.id===id?u:xu));
    if (currentUser?.id===id) { setCurrentUser(u); localStorage.setItem("user",JSON.stringify(u)); }
    toast("Profile updated ✦");
  };

  const handleInitiatePayment = async (targetUser, watcherData) => {
    const result = await apiInitializePayment({
      hostId: targetUser.id,
      watcherId: currentUser?.id || null,
      watcherName: watcherData.watcherName,
      watcherContact: watcherData.watcherContact,
      watcherPlatform: watcherData.watcherPlatform || "WhatsApp",
    });
    if (result.error) { toast(result.error, "error"); return null; }
    window.location.href = result.authorizationUrl;
    return result;
  };

  const handleMarkDone = async (paymentId, targetUser) => {
    const res = await fetch(`${API_BASE}/api/call/mark-done`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId, hostId: currentUser?.id }),
    });
    const result = await res.json();
    if (result.error) { toast(result.error, "error"); return; }
    if (result.alreadyMarked) { toast("Already marked — awaiting watcher confirmation"); return; }
    toast("Call marked done! Waiting for watcher to confirm…");
  };

  const handleConfirmCall = async (confirmationId, response) => {
    const result = await apiConfirmCall(confirmationId, currentUser?.id, response);
    if (result.error) { toast(result.error, "error"); return; }
    if (response === "yes") {
      toast("Call confirmed! Host has been paid ✦", "success");
    } else {
      toast("Dispute filed — admin will review", "info");
    }
    const { data: pRows } = await supabase.from("payments").select("*").order("created_at",{ascending:false});
    if (pRows) setPayments(pRows.map(r=>({ ...r, ts:new Date(r.created_at), targetUserId:r.target_user_id, watcherName:r.watcher_name })));
  };

  const confirmPayment = async (paymentId) => {
    const result = await apiConfirmPayment(paymentId);
    if (result.error) { toast("Failed: "+result.error,"error"); return; }
    const { data: refreshed } = await supabase.from("payments").select("*").eq("id",paymentId).single();
    if (refreshed) setPayments(prev=>prev.map(p=>p.id===paymentId?refreshed:p));
    toast(result.transferCode ? "Payment confirmed ✓ — Contact revealed & payout sent" : `Payment confirmed ✓ (${result.transferMessage})`);
  };

  const handleRelease = async (callId, paymentId) => {
    const result = await apiReleaseFunds(callId, paymentId);
    if (result.error) { toast("Error: "+result.error,"error"); return; }
    setCalls(x=>x.map(cl=>cl.id===callId?{...cl,released:true}:cl));
    setPayments(x=>x.map(p=>p.id===paymentId?{...p,status:"completed"}:p));
    const amount = payments.find(p=>p.id===paymentId)?.amount || 0;
    setAdminWallet(w=>w-Number(amount));
    toast("Funds released");
  };

  const handlePushVerify = async (paymentId) => {
    const { data, error } = await supabase.from("verify_prompts").insert([{ payment_id:paymentId, answered:false }]).select().single();
    if (error) { toast("Error: "+error.message,"error"); return; }
    setVP(x=>[{ ...data, paymentId:data.payment_id },...x]);
    toast("Verification prompt sent");
  };

  const handleAnswerVerify = async (vpId, confirmed) => {
    await supabase.from("verify_prompts").update({ answered:true }).eq("id", vpId);
    setVP(x=>x.map(v=>v.id===vpId?{...v,answered:true}:v));
    toast(confirmed?"Call confirmed ✓":"Dispute noted", confirmed?"success":"error");
  };

  const handleRefundRequest = async (paymentId, reason) => {
    const result = await apiWatcherRefund(paymentId, reason, currentUser?.id);
    if (result.error) { toast(result.error, "error"); return; }
    const { data: rRows } = await supabase.from("refund_requests").select("*").order("created_at",{ascending:false});
    if (rRows) setRefundReqs(rRows);
    const { data: pRows } = await supabase.from("payments").select("*").order("created_at",{ascending:false});
    if (pRows) setPayments(pRows.map(r=>({ ...r, ts:new Date(r.created_at), targetUserId:r.target_user_id, watcherName:r.watcher_name })));
    if (result.autoRefunded) {
      toast(`${result.message}`, "success");
    } else {
      toast(result.message, "info");
    }
    return result;
  };

  const handleHostApproveRefund = async (refundId) => {
    const result = await apiHostApproveRefund(refundId, currentUser?.id);
    if (result.error) { toast("Error: "+result.error,"error"); return; }
    const { data: rRows } = await supabase.from("refund_requests").select("*").order("created_at",{ascending:false});
    if (rRows) setRefundReqs(rRows);
    const { data: pRows } = await supabase.from("payments").select("*").order("created_at",{ascending:false});
    if (pRows) setPayments(pRows.map(r=>({ ...r, ts:new Date(r.created_at), targetUserId:r.target_user_id, watcherName:r.watcher_name })));
    toast("Refund approved — funds returned to watcher ✅");
  };

  const handleApproveRefund = async (refundId) => {
    const result = await apiAdminApproveRefund(refundId);
    if (result.error) { toast("Error: "+result.error,"error"); return; }
    const { data: rRows } = await supabase.from("refund_requests").select("*").order("created_at",{ascending:false});
    if (rRows) setRefundReqs(rRows);
    const { data: pRows } = await supabase.from("payments").select("*").order("created_at",{ascending:false});
    if (pRows) setPayments(pRows.map(r=>({ ...r, ts:new Date(r.created_at), targetUserId:r.target_user_id, watcherName:r.watcher_name })));
    toast("Refund approved ✅");
  };

  const handleDenyRefund = async (refundId) => {
    const { error } = await supabase.from("refund_requests").update({ status:"denied" }).eq("id", refundId);
    if (error) { toast("Error: "+error.message,"error"); return; }
    setRefundReqs(x=>x.map(r=>r.id===refundId?{...r,status:"denied"}:r));
    toast("Refund denied", "error");
  };

  const toggleFavorite = async (hostId) => {
    if (!currentUser) return toast("Sign in to save favorites", "error");
    const exists = favorites.find(f => f.host_id === hostId && f.watcher_id === currentUser.id);
    if (exists) {
      await supabase.from("favorites").delete().eq("id", exists.id);
      setFavorites(prev => prev.filter(f => f.id !== exists.id));
      toast("Removed from favorites");
    } else {
      const { data } = await supabase.from("favorites").insert([{
        watcher_id: currentUser.id, host_id: hostId
      }]).select().single();
      if (data) setFavorites(prev => [...prev, data]);
      toast("Saved to favorites ❤️");
    }
  };

  if (loading) return (
    <div style={{ minHeight:"100vh", background:c.bg, padding:"40px 24px" }}>
      <div style={{ maxWidth:1100, margin:"0 auto" }}>
        <div className="shimmer" style={{ height:40, width:300, borderRadius:8, marginBottom:30 }} />
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:18 }}>
          {[...Array(6)].map((_,i)=> <SkeletonCard key={i} />)}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <Petals />
      <Toast toasts={toasts} />
      <Nav setView={setView} currentUser={currentUser} isAdmin={isAdmin} handleLogout={handleLogout} />
      <MobileNav setView={setView} currentUser={currentUser} isAdmin={isAdmin} handleLogout={handleLogout} />
      {view==="home" && <HomeView setView={setView} users={users} favorites={favorites} toggleFavorite={toggleFavorite} currentUser={currentUser} />}
      {view==="howItWorks"  && <HowItWorksView setView={setView} />}
      {view==="profile" && selectedUser && <ProfileView host={selectedUser} setView={setView} currentUser={currentUser} onInitiatePayment={handleInitiatePayment} toast={toast} />}
      {view==="signup"      && <SignupView onSignup={handleSignup} setView={setView} toast={toast} />}
      {view==="login"       && <LoginView onLogin={handleLogin} setView={setView} />}
      {view==="browse" && <BrowseView users={users} payments={payments} onInitiatePayment={handleInitiatePayment} currentUser={currentUser} toast={toast} verifyPrompts={verifyPrompts} onAnswerVerify={handleAnswerVerify} setView={setView} refundReqs={refundReqs} onRefundRequest={handleRefundRequest} onHostApproveRefund={handleHostApproveRefund} pendingHost={pendingHost} setPendingHost={setPendingHost} callConfirmations={callConfirmations} onConfirmCall={handleConfirmCall} favorites={favorites} toggleFavorite={toggleFavorite} />}
      {view==="dashboard" && currentUser && currentUser.role==="host" && <DashboardView user={currentUser} users={users} payments={payments} calls={calls} verifyPrompts={verifyPrompts} onMarkDone={handleMarkDone} onUpdate={handleUpdateUser} onAnswerVerify={handleAnswerVerify} toast={toast} setView={setView} refundReqs={refundReqs} onHostApproveRefund={handleHostApproveRefund} callConfirmations={callConfirmations} />}
      {view==="dashboard" && currentUser && currentUser.role==="watcher" && <WatcherDashboardView user={currentUser} users={users} payments={payments} refundReqs={refundReqs} onRefundRequest={handleRefundRequest} toast={toast} setView={setView} callConfirmations={callConfirmations} onConfirmCall={handleConfirmCall} favorites={favorites} toggleFavorite={toggleFavorite} />}
      {view==="admin"       && isAdmin && <AdminView users={users} payments={payments} calls={calls} wallet={adminWallet} verifyPrompts={verifyPrompts} onRelease={handleRelease} reports={reports} onPushVerify={handlePushVerify} setView={setView} confirmPayment={confirmPayment} refundReqs={refundReqs} callConfirmations={callConfirmations} onApproveRefund={handleApproveRefund} onDenyRefund={handleDenyRefund} />}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  HOME VIEW — blurred host images for non-logged-in visitors
// ═══════════════════════════════════════════════════════════════
function HomeView({ setView, users, favorites, toggleFavorite, currentUser }) {
  const allHosts = users.filter(u=>u.role==="host");
  const online = allHosts.filter(u=>u.online);
  return (
    <div style={{ minHeight:"100vh", position:"relative" }}>
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0 }}>
        <div style={{ position:"absolute", top:"10%", left:"15%", width:500, height:500, borderRadius:"50%", background:`radial-gradient(circle,${c.gold}08 0%,transparent 70%)` }} />
        <div style={{ position:"absolute", bottom:"10%", right:"10%", width:400, height:400, borderRadius:"50%", background:`radial-gradient(circle,${c.pink}08 0%,transparent 70%)` }} />
        <div style={{ position:"absolute", top:"50%", left:"50%", width:600, height:600, borderRadius:"50%", background:`radial-gradient(circle,${c.purple}05 0%,transparent 70%)`, transform:"translate(-50%,-50%)" }} />
      </div>
      <div style={{ position:"relative", zIndex:1, maxWidth:1100, margin:"0 auto", padding:"70px 40px 60px" }}>
        <div className="fu" style={{ textAlign:"center", marginBottom:80 }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(40px,7vw,72px)", fontWeight:600, lineHeight:1.1, marginBottom:20, background:`linear-gradient(135deg,${c.goldL},${c.gold},${c.rose})`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
            Guaranteed Payment.<br/>Guaranteed Pleasure.<br/>No Trust Issues.
          </div>
          <p style={{ color:c.sub, fontSize:18, maxWidth:520, margin:"0 auto 40px", lineHeight:1.8, fontWeight:300 }}>
            Curated consultants. Private. Secure Payment.
          </p>
          <div style={{ display:"flex", gap:14, justifyContent:"center", flexWrap:"wrap" }}>
            <Btn onClick={()=>setView("browse")} style={{ fontSize:15, padding:"14px 34px" }}>Browse Consultants ✦</Btn>
            <Btn variant="ghost" onClick={()=>setView("signup")} style={{ fontSize:15, padding:"14px 34px" }}>Become a Host</Btn>
          </div>
        </div>

        <div className="fu" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:1, marginBottom:70, background:c.border, borderRadius:20, overflow:"hidden" }}>
          {[[`${online.length}+`,"Online Now",c.green],[`${allHosts.length}+`,"Consultants",c.goldL],["3,000+","Calls Completed",c.blue]].map(([n,l,col])=>(
            <div key={l} style={{ background:`linear-gradient(180deg,${c.card},#1a1a24)`, padding:"20px 8px", textAlign:"center", border:`1px solid ${c.border}` }}>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(18px,4vw,38px)", fontWeight:700, color:col, marginBottom:4 }}>{n}</div>
              <div style={{ color:c.sub, fontSize:"clamp(8px,1.8vw,12px)", letterSpacing:1 }}>{l}</div>
            </div>
          ))}
        </div>

        {online.length > 0 && (
          <div className="fu">
            <div style={{ textAlign:"center", marginBottom:40 }}>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:34, marginBottom:8, color:c.goldL }}>Featured Consultants</div>
              <div style={{ color:c.sub, fontSize:14 }}>Available now</div>
              {!currentUser && (
                <div style={{ marginTop:10, fontSize:13, color:c.sub }}>
                  <span style={{ color:c.gold, cursor:"pointer", textDecoration:"underline" }} onClick={()=>setView("signup")}>Sign up</span> or <span style={{ color:c.gold, cursor:"pointer", textDecoration:"underline" }} onClick={()=>setView("login")}>sign in</span> to see full profiles
                </div>
              )}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:20 }}>
              {online.slice(0,9).map((u,i)=>(
                <HomeHostCard key={u.id} u={u} i={i} setView={setView} favorites={favorites} toggleFavorite={toggleFavorite} currentUser={currentUser} />
              ))}
            </div>
          </div>
        )}

        <div className="fu" style={{ marginTop: 60 }}>
          <div style={{ textAlign:"center", marginBottom:40 }}>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:34, marginBottom:8, color:c.goldL }}>All Consultants</div>
            <div style={{ color:c.sub, fontSize:14 }}>Browse our full collection</div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:20 }}>
            {allHosts.map((u,i)=>(
              <HomeHostCard key={u.id} u={u} i={i} setView={setView} favorites={favorites} toggleFavorite={toggleFavorite} currentUser={currentUser} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// CHANGE 3: Host card with blur for non-logged-in users
function HomeHostCard({ u, i, setView, favorites, toggleFavorite, currentUser }) {
  const isFav = favorites.some(f => f.host_id === u.id && f.watcher_id === currentUser?.id);
  const isBlurred = !currentUser;
  return (
    <div className="fu" style={{ animationDelay:`${i*0.05}s`, background:`linear-gradient(180deg,${c.card},#1a1a24)`, border:`1px solid ${c.border}`, borderRadius:18, overflow:"hidden", cursor:"pointer", transition:"all .3s", position:"relative" }}
      onClick={()=>isBlurred ? setView("signup") : setView("browse")}
      onMouseEnter={e=>{e.currentTarget.style.borderColor=c.gold;e.currentTarget.style.transform="translateY(-4px)";}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor=c.border;e.currentTarget.style.transform="";}}>
      {currentUser && (
        <button onClick={e=>{ e.stopPropagation(); toggleFavorite(u.id); }}
          style={{ position:"absolute", top:12, right:12, zIndex:10, background:"#0a0a0fcc", border:"none", borderRadius:"50%", width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:16, color:isFav?c.gold:c.sub }}>
          {isFav?"❤️":"♡"}
        </button>
      )}
      <div style={{ position:"relative", width:"100%", aspectRatio:"1/1", overflow:"hidden" }}>
        {u.profilePhoto ? (
          <img src={u.profilePhoto} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", filter:isBlurred?"blur(4px) brightness(0.7)":"none", transform:isBlurred?"scale(1.05)":"none", transition:"filter .3s" }} />
        ) : (
          <div style={{ width:"100%", height:"100%", background:`linear-gradient(135deg,${c.goldD},#1a1a2e)`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Cormorant Garamond',serif", fontSize:48, color:c.gold, opacity:.3 }}>{u.avatar}</div>
        )}
        {isBlurred && (
          <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, zIndex:3 }}>
            <div style={{ fontSize:28 }}>🔐</div>
            <div style={{ color:"#fff", fontWeight:600, fontSize:13, textAlign:"center", lineHeight:1.4 }}>Sign up to<br/>view profile</div>
          </div>
        )}
        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:40, background:"linear-gradient(to top,#0a0a0fcc,transparent)" }} />
        <div style={{ position:"absolute", top:10, right:12, display:"flex", alignItems:"center", gap:5, background:"#0a0a0f99", padding:"3px 8px", borderRadius:20, zIndex:2 }}>
          <OnlineDot on={u.online} />
          <span style={{ fontSize:10, color:u.online?c.green:c.dim }}>{u.online?"Live":"Offline"}</span>
        </div>
      </div>
      <div style={{ padding:"14px 16px 16px" }}>
        <div style={{ fontWeight:600, fontSize:15, marginBottom:2 }}>{u.name}</div>
        {!isBlurred && <HostRating hostId={u.id} />}
        <div style={{ color:c.sub, fontSize:11, marginBottom:8 }}>
          {`${(u.bio||"").slice(0,45)}${(u.bio||"").length>45?"…":""}`}
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:10 }}>
          {isBlurred
  ? [1,2].map(i => <Chip key={i} label="••••" />)
  : safeArr(u.tags).slice(0,3).map(t=><Chip key={t} label={t}/>)
}
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
  <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, color:c.goldL, fontWeight:600 }}>{S}{u.rate}</div>
  <div style={{ color:c.dim, fontSize:10 }}>via {u.platform}</div>
</div>
          <div style={{ width:30, height:30, borderRadius:"50%", border:`1px solid ${isBlurred?c.sub+"50":c.gold+"50"}`, display:"flex", alignItems:"center", justifyContent:"center", color:isBlurred?c.sub:c.gold, fontSize:13 }}>
            {isBlurred?"🔒":"→"}
          </div>
        </div>
      </div>
    </div>
  );
}

function HowItWorksView({ setView }) {
  const steps = [
    { n:"1", t:"Browse", d:"Find a consultant that matches your needs. Browse profiles, view galleries, and check availability." },
    { n:"2", t:"Connect & Pay", d:"Click Connect, enter your contact number, and pay securely via Paystack. Funds are held in escrow." },
    { n:"3", t:"Contact Revealed", d:"Once Paystack verifies your payment, the host's contact is revealed automatically within seconds." },
    { n:"4", t:"Call Happens", d:"Connect with your consultant on WhatsApp or Telegram. Have your private session." },
    { n:"5", t:"Confirm & Pay Host", d:"After the call, confirm it happened and the host gets paid instantly to their MoMo via Paystack." },
  ];
  return (
    <div style={{ minHeight:"100vh", position:"relative" }}>
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0 }}>
        <div style={{ position:"absolute", top:"20%", right:"20%", width:400, height:400, borderRadius:"50%", background:`radial-gradient(circle,${c.gold}06 0%,transparent 70%)` }} />
      </div>
      <div style={{ position:"relative", zIndex:1, maxWidth:800, margin:"0 auto", padding:"60px 24px" }}>
        <div className="fu" style={{ textAlign:"center", marginBottom:50 }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:42, fontWeight:600, color:c.goldL, marginBottom:10 }}>How It Works</div>
          <div style={{ color:c.sub, fontSize:15, maxWidth:500, margin:"0 auto", lineHeight:1.7 }}>
            A secure, admin-controlled escrow flow that protects both consultants and clients.
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
          {steps.map((s,i)=>(
            <div key={s.n} className="fu" style={{ animationDelay:`${i*0.1}s`, background:`linear-gradient(135deg,${c.card},#1a1a24)`, border:`1px solid ${c.border}`, borderRadius:18, padding:28, display:"flex", gap:20, alignItems:"flex-start" }}>
              <div style={{ minWidth:48, height:48, borderRadius:"50%", background:`linear-gradient(135deg,${c.gold},${c.goldL})`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700, color:"#0a0a0f", flexShrink:0 }}>{s.n}</div>
              <div>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20, fontWeight:600, marginBottom:6, color:c.goldL }}>{s.t}</div>
                <div style={{ color:c.sub, fontSize:13, lineHeight:1.7 }}>{s.d}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="fu" style={{ textAlign:"center", marginTop:40 }}>
          <Btn onClick={()=>setView("browse")}>Start Browsing →</Btn>
        </div>
      </div>
    </div>
  );
}

function SignupView({ onSignup, setView, toast }) {
  const [mode, setMode] = useState("watcher");
  const [step, setStep] = useState(1);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name:"", bio:"", platform:"WhatsApp", contactNumber:"", rate:"", tags:"", password:"",
    profilePhoto:null, photos:[],
    payoutName:"", payoutNumber:"", payoutProvider:PAYOUT_PROVIDERS[0],
  });
  const set = k => v => setForm(x=>({...x,[k]:v}));

  const submitWatcher = async () => {
    if (!form.name.trim()) { toast("Username is required","error"); return; }
    if (!form.password.trim()) { toast("Password is required","error"); return; }
    if (!acceptedTerms) { toast("You must accept the Terms & Conditions","error"); return; }
    setBusy(true);
    await onSignup({ name:form.name.trim(), password:form.password, role:"watcher" });
    setBusy(false);
  };

  const submitHost = async () => {
    if (!form.name.trim())          { toast("Name is required","error"); return; }
    if (!form.contactNumber.trim()) { toast("Contact number is required","error"); return; }
    if (!form.rate||isNaN(Number(form.rate))) { toast("Enter a valid rate","error"); return; }
    if (!form.password.trim())      { toast("Set a password","error"); return; }
    if (!form.payoutNumber.trim())  { toast("Payout number is required","error"); return; }
    if (!form.payoutProvider)       { toast("Select your payout provider","error"); return; }
    if (!acceptedTerms) { toast("You must accept the Terms & Conditions","error"); return; }
    setBusy(true);
    await onSignup({ ...form, rate:parseFloat(form.rate), tags:form.tags.split(",").map(t=>t.trim()).filter(Boolean), role:"host" });
    setBusy(false);
  };

  return (
    <div style={{ minHeight:"calc(100vh - 60px)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ maxWidth:500, width:"100%", background:`linear-gradient(180deg,${c.card},#1a1a24)`, border:`1px solid ${c.border}`, borderRadius:24, padding:40, animation:"fadeUp .4s ease", boxShadow:`0 24px 60px #00000044` }}>
        <div style={{ display:"flex", gap:10, marginBottom:20 }}>
          <Btn small variant={mode==="watcher"?"gold":"ghost"} onClick={()=>{setMode("watcher");setStep(1);}}>I want to book</Btn>
          <Btn small variant={mode==="host"?"gold":"ghost"} onClick={()=>{setMode("host");setStep(1);}}>I want to host</Btn>
        </div>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:30, color:c.goldL }}>
            {mode==="watcher" ? "Create Account" : step===1 ? "Public Call Profile" : "Private Payout Setup"}
          </div>
          <div style={{ color:c.sub, fontSize:13, marginTop:5 }}>
            {mode==="watcher" ? "Sign up to book calls" : step===1 ? "Shown to watchers after payment" : "NEVER shared with watchers"}
          </div>
        </div>

        {mode==="watcher" && (
          <>
            <Field label="Username *" value={form.name} onChange={set("name")} placeholder="e.g. Lucy" />
            <Field label="Password *" value={form.password} onChange={set("password")} type="password" placeholder="Enter password" />
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16, marginTop:8 }}>
              <input type="checkbox" checked={acceptedTerms} onChange={e=>setAcceptedTerms(e.target.checked)} style={{ width:18, height:18, accentColor:c.gold }} />
              <span style={{ fontSize:12, color:c.sub }}>
                I accept the <span style={{ color:c.gold, cursor:"pointer", textDecoration:"underline" }} onClick={()=>setShowTerms(true)}>Terms & Conditions</span>
              </span>
            </div>
            <Btn onClick={submitWatcher} full disabled={busy || !acceptedTerms} style={{ marginTop:10 }}>{busy?"Creating…":"Create Account →"}</Btn>
          </>
        )}

        {mode==="host" && step===1 && (
          <>
            <SectionHeader icon="📞" title="Public Call Information" subtitle="This is what watchers see after payment." />
            <PhotoPick label="Profile Photo" value={form.profilePhoto} onChange={set("profilePhoto")} circle />
            <Field label="Name *" value={form.name} onChange={set("name")} />
            <Field label="Bio" value={form.bio} onChange={set("bio")} rows={3} placeholder="Describe your expertise…" />
            <Field label="Video Platform *" value={form.platform} onChange={set("platform")} options={["WhatsApp","Telegram"]} />
            <Field label="Contact Number / ID *" value={form.contactNumber} onChange={set("contactNumber")} maxLength={10} type="tel" hint="10-digit number. Shown to watchers after payment." />
            <Field label={`Rate per Call (${CURRENCY}) *`} value={form.rate} onChange={set("rate")} type="number" hint="You receive this full amount. Platform adds 20% on top for watchers." />
            <Field label="Tags" value={form.tags} onChange={set("tags")} placeholder="tarot, career, love, wellness" />
            <Field label="Password *" value={form.password} onChange={set("password")} type="password" />
            <MultiPick label="Gallery Photos" value={form.photos} onChange={set("photos")} max={4} />
            <Btn onClick={()=>setStep(2)} full style={{ marginTop:10 }}>Next: Payout Setup →</Btn>
          </>
        )}

        {mode==="host" && step===2 && (
          <>
            <SectionHeader icon="🔒" title="Private Payout Information" subtitle="NEVER shown to watchers. Used only for Paystack payouts." />
            <div style={{ background:`${c.purple}15`, border:`1px solid ${c.purple}40`, borderRadius:10, padding:"12px 14px", marginBottom:20, fontSize:12, color:c.sub, lineHeight:1.7 }}>
              <div style={{ fontWeight:600, color:c.purple, marginBottom:4 }}>🔐 Why we need this:</div>
              <div>• Earnings sent automatically via <strong style={{ color:c.text }}>Paystack Transfers</strong> to your MoMo</div>
              <div>• <strong style={{ color:c.orange }}>Watchers NEVER see this</strong></div>
            </div>
            <Field label="Payout Name *" value={form.payoutName} onChange={set("payoutName")} placeholder={form.name||"Your full name"} />
            <Field label="Payout Number *" value={form.payoutNumber} onChange={set("payoutNumber")} type="tel" maxLength={10} placeholder="MoMo number" />
            <Field label="Payout Provider *" value={form.payoutProvider} onChange={set("payoutProvider")} options={PAYOUT_PROVIDERS} />
            <div style={{ background:`${c.gold}10`, border:`1px solid ${c.gold}30`, borderRadius:10, padding:"14px 16px", marginBottom:20 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ color:c.sub, fontSize:13 }}>Your rate</span>
                <span style={{ fontWeight:600, color:c.goldL }}>{S}{form.rate||0}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ color:c.sub, fontSize:13 }}>You receive</span>
                <span style={{ fontWeight:700, color:c.green }}>{S}{form.rate||0}</span>
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
              <input type="checkbox" checked={acceptedTerms} onChange={e=>setAcceptedTerms(e.target.checked)} style={{ width:18, height:18, accentColor:c.gold }} />
              <span style={{ fontSize:12, color:c.sub }}>
                I accept the <span style={{ color:c.gold, cursor:"pointer", textDecoration:"underline" }} onClick={()=>setShowTerms(true)}>Terms & Conditions</span>
              </span>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <Btn variant="surface" onClick={()=>setStep(1)} style={{ flex:1 }}>← Back</Btn>
              <Btn onClick={submitHost} full disabled={busy || !acceptedTerms} style={{ flex:2 }}>{busy?"Creating…":"Launch Profile →"}</Btn>
            </div>
          </>
        )}

        <div style={{ textAlign:"center", marginTop:16, color:c.sub, fontSize:13 }}>
          Already registered? <span style={{ color:c.gold, cursor:"pointer" }} onClick={()=>setView("login")}>Sign in</span>
        </div>

        {showTerms && <TermsView onAccept={() => { setAcceptedTerms(true); setShowTerms(false); }} onDecline={() => setShowTerms(false)} setView={setView} />}
      </div>
    </div>
  );
}

// CHANGE 1: Remember Me login
function LoginView({ onLogin, setView }) {
  const [name, setName] = useState(() => localStorage.getItem("rememberedName") || "");
  const [pass, setPass] = useState(() => localStorage.getItem("rememberedPass") || "");
  const [remember, setRemember] = useState(() => !!localStorage.getItem("rememberedName"));
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (remember) {
      localStorage.setItem("rememberedName", name);
      localStorage.setItem("rememberedPass", pass);
    } else {
      localStorage.removeItem("rememberedName");
      localStorage.removeItem("rememberedPass");
    }
    setBusy(true);
    await onLogin(name, pass);
    setBusy(false);
  };
  return (
    <div style={{ minHeight:"calc(100vh - 60px)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ maxWidth:400, width:"100%", background:`linear-gradient(180deg,${c.card},#1a1a24)`, border:`1px solid ${c.border}`, borderRadius:24, padding:40, animation:"fadeUp .4s ease", boxShadow:`0 24px 60px #00000044` }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:30, color:c.goldL }}>Welcome Back</div>
        </div>
        <Field label="Your Name" value={name} onChange={setName} placeholder="Exactly as registered" />
        <Field label="Password" value={pass} onChange={setPass} type="password" placeholder="••••••••" />
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
          <input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} style={{ width:16, height:16, accentColor:c.gold }} />
          <span style={{ fontSize:12, color:c.sub }}>Remember me</span>
        </div>
        <Btn onClick={submit} full disabled={busy} style={{ marginTop:8 }}>{busy?"Signing in…":"Sign In →"}</Btn>
        <div style={{ textAlign:"center", marginTop:14, color:c.sub, fontSize:13 }}>
          New? <span style={{ color:c.gold, cursor:"pointer" }} onClick={()=>setView("signup")}>Create a profile</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  HOST DASHBOARD VIEW
// ═══════════════════════════════════════════════════════════════
function DashboardView({ user, users, payments, calls, verifyPrompts, onMarkDone, onUpdate, onAnswerVerify, toast, setView, refundReqs, onHostApproveRefund, callConfirmations }) {
  if (user?.role==="watcher") { setView("browse"); return null; }

  const [tab, setTab]         = useState("overview");
  const [editing, setEditing] = useState(false);
  const [hostHistoryOpen, setHostHistoryOpen] = useState(false);
  const [editStep, setEditStep] = useState(1);
  const [ef, setEf]           = useState({});
  const [busy, setBusy]       = useState(false);
  const eu = k => v => setEf(x=>({...x,[k]:v}));

  const live    = normaliseUser(users.find(u=>u.id===user.id)||user);
  const myPay   = payments.filter(x=>x.target_user_id===user.id||x.targetUserId===user.id);
  const myCalls = calls.filter(cl=>cl.target_user_id===user.id||cl.targetUserId===user.id);
  const myVP    = verifyPrompts.filter(v=>!v.answered && myPay.some(p=>p.id===v.payment_id||p.id===v.paymentId));
  const hostRefundReqs = refundReqs.filter(r=>r.status==="pending_host" && myPay.some(p=>p.id===r.payment_id));

  const liveReqs = myPay.filter(p => {
    if (p.status === "pending" || p.status === "confirmed") {
      const conf = (callConfirmations || []).find(cc => cc.payment_id === p.id);
      if (conf && (conf.status === "confirmed" || conf.status === "auto_confirmed")) return false;
      if (p.status === "completed") return false;
      return true;
    }
    return false;
  });

  const closedReqs = myPay.filter(p => {
    if (p.status === "completed" || p.status === "refunded" || p.status === "refunded_partial") return true;
    const conf = (callConfirmations || []).find(cc => cc.payment_id === p.id);
    if (conf && (conf.status === "confirmed" || conf.status === "auto_confirmed")) return true;
    return false;
  });

  const startEdit = () => {
    setEf({ ...live, tags:safeArr(live.tags).join(", "), photos:safeArr(live.photos), payoutName:live.payoutName||live.name, payoutNumber:live.payoutNumber||"", payoutProvider:live.payoutProvider||"MTN" });
    setEditStep(1); setEditing(true);
  };

  const save = async () => { setBusy(true); await onUpdate({ ...ef, id:live.id, tags:safeArr(ef.tags), photos:safeArr(ef.photos) }); setBusy(false); setEditing(false); };

  return (
    <div style={{ minHeight:"calc(100vh - 60px)" }}>
      <div style={{ maxWidth:900, margin:"0 auto", padding:"32px 24px" }}>
        {myVP.length > 0 && (
          <div style={{ background:`${c.gold}18`, border:`1px solid ${c.gold}`, borderRadius:14, padding:18, marginBottom:20 }}>
            <div style={{ fontWeight:600, marginBottom:10, color:c.goldL }}>⚠ Admin Verification Request</div>
            {myVP.map(vp=>(
              <div key={vp.id} style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap", marginBottom:8 }}>
                <span style={{ color:c.sub, fontSize:13, flex:1 }}>Did the call take place?</span>
                <Btn variant="green" small onClick={()=>onAnswerVerify(vp.id,true)}>Yes</Btn>
                <Btn variant="red" small onClick={()=>onAnswerVerify(vp.id,false)}>Dispute</Btn>
              </div>
            ))}
          </div>
        )}

        {hostRefundReqs.length > 0 && (
          <div style={{ background:`${c.orange}15`, border:`1px solid ${c.orange}`, borderRadius:14, padding:18, marginBottom:20 }}>
            <div style={{ fontWeight:600, marginBottom:10, color:c.orange }}>↩ Refund Requests Awaiting Your Approval</div>
            {hostRefundReqs.map(r=>(
              <div key={r.id} style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap", marginBottom:8 }}>
                <span style={{ color:c.sub, fontSize:13, flex:1 }}>{r.watcher_name} requests refund: {r.reason}</span>
                <Btn variant="green" small onClick={()=>onHostApproveRefund(r.id)}>Approve Refund</Btn>
              </div>
            ))}
          </div>
        )}

        <div style={{ display:"flex", gap:2, marginBottom:24, background:c.surface, padding:4, borderRadius:10, width:"fit-content", flexWrap:"wrap" }}>
          {["overview","requests","manage profile"].map(t=>{
            const badge = t==="requests" ? liveReqs.filter(p=>p.status==="confirmed" && !calls.find(cl=>cl.payment_id===p.id)).length : 0;
            return (
              <button key={t} onClick={()=>setTab(t)} style={{ padding:"8px 18px", borderRadius:8, border:"none", cursor:"pointer", background:tab===t?c.card:"transparent", color:tab===t?c.goldL:c.sub, fontSize:12, fontWeight:600, fontFamily:"'Plus Jakarta Sans',sans-serif", textTransform:"capitalize", position:"relative" }}>
                {t}
                {badge > 0 && (
                  <span style={{ position:"absolute", top:4, right:4, background:c.red, color:"#fff", fontSize:9, fontWeight:700, padding:"1px 5px", borderRadius:10, minWidth:16, textAlign:"center" }}>{badge}</span>
                )}
              </button>
            );
          })}
        </div>

        {tab==="overview" && (
          <div className="fu">
            <div style={{ background:`linear-gradient(135deg,${c.card},#1a1a24)`, border:`1px solid ${c.border}`, borderRadius:18, padding:28, marginBottom:16, display:"flex", gap:20, alignItems:"flex-start", flexWrap:"wrap" }}>
              <Avatar user={live} size={76} ring />
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:4 }}>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:600 }}>{live.name}</div>
                  <OnlineDot on={live.online} />
                </div>
                <div style={{ color:c.sub, fontSize:14, marginBottom:10 }}>{live.bio}</div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>{safeArr(live.tags).map(t=><Chip key={t} label={t}/>)}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:30, color:c.goldL, fontWeight:600 }}>{S}{live.rate}</div>
                <div style={{ color:c.sub, fontSize:11 }}>per call via {live.platform}</div>
                <div style={{ marginTop:8, color:c.green, fontWeight:700, fontSize:15 }}>Wallet: {S}{Number(live.wallet||0).toFixed(2)}</div>
              </div>
            </div>

            <div style={{ background:c.card, border:`1px solid ${live.paystackRecipientCode?c.green:c.orange}`, borderRadius:14, padding:20, marginBottom:16 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                <span style={{ fontSize:20 }}>{live.paystackRecipientCode?"✅":"⚠️"}</span>
                <div style={{ fontWeight:600 }}>{live.paystackRecipientCode ? "Automatic Payouts Active" : "Payout Setup Incomplete"}</div>
              </div>
            </div>

            <div style={{ background:`linear-gradient(135deg,${c.gold}10,${c.goldD})`, border:`1px solid ${c.gold}40`, borderRadius:14, padding:20, marginBottom:16, textAlign:"center" }}>
              <div style={{ fontSize:28, marginBottom:8 }}>🔗</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, color:c.goldL, fontWeight:600, marginBottom:4 }}>Share Your Profile</div>
              <div style={{ color:c.sub, fontSize:12, marginBottom:14, lineHeight:1.6 }}>Get more calls. Get more payments.<br/>Share your profile link anywhere.</div>
              <Btn onClick={() => {
                const link = `${window.location.origin}/?host=${encodeURIComponent(live.name)}`;
                navigator.clipboard.writeText(link);
                toast("Profile link copied! 📋");
              }} full>📋 Copy Your Profile Link</Btn>
              <div style={{ color:c.dim, fontSize:10, marginTop:8 }}>{window.location.origin}/?host={live.name}</div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              {[["Payments Received",myPay.filter(p=>p.paystack_verified).length,c.green],["Calls Completed",myCalls.length,c.blue]].map(([l,v,col])=>(
                <div key={l} style={{ background:c.card, border:`1px solid ${c.border}`, borderRadius:14, padding:22 }}>
                  <div style={{ color:c.sub, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>{l}</div>
                  <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:34, fontWeight:600, color:col }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab==="requests" && (
          <div className="fu">
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, marginBottom:18 }}>Incoming Requests</div>

            {myPay.filter(p=>p.status!=="poke"&&p.status!=="pending_init"&&p.status!=="failed").length===0
              ? <div style={{ color:c.sub, textAlign:"center", padding:"50px 0" }}>No requests yet.</div>
              : <>
                {liveReqs.length > 0 ? (
                  <div style={{ marginBottom:20 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                      <span style={{ width:8, height:8, borderRadius:"50%", background:c.green, display:"inline-block", animation:"pulse 2s infinite" }} />
                      <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, color:c.goldL }}>Live Requests ({liveReqs.length})</div>
                    </div>
                    {liveReqs.map(pay => {
                      const callDone = calls.find(cl=>cl.payment_id===pay.id||cl.paymentId===pay.id);
                      const refund = refundReqs.find(r=>r.payment_id===pay.id);
                      const conf = (callConfirmations||[]).find(cc=>cc.payment_id===pay.id);
                      return (
                        <div key={pay.id} style={{ padding:16, borderRadius:12, marginBottom:10, background:`linear-gradient(135deg,${c.card},#1a1a24)`, border:`1px solid ${pay.status==="confirmed"?c.gold:c.border}` }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                            <div style={{ fontWeight:600 }}>{pay.status==="pending"?"🔒 New Request":pay.watcher_name||pay.watcherName}</div>
                            {pay.paystack_verified && <span style={{ fontSize:10, padding:"2px 8px", borderRadius:20, background:`${c.green}20`, color:c.green }}>✓ Verified</span>}
                            {refund && <span style={{ fontSize:11, padding:"2px 8px", borderRadius:20, background:`${c.orange}20`, color:c.orange }}>Refund {refund.status}</span>}
                          </div>
                          {pay.status==="pending" && (
                            <div style={{ padding:"10px", borderRadius:8, background:c.surface, border:`1px solid ${c.border}`, fontSize:12, color:c.sub }}>
                              🔒 Contacts hidden — waiting for admin confirmation
                            </div>
                          )}
                          {pay.status==="confirmed" && (
                            <div style={{ padding:"10px", borderRadius:8, background:`${c.green}10`, border:`1px solid ${c.green}30` }}>
                              <div style={{ fontSize:12, fontWeight:600, color:c.green, marginBottom:4 }}>✓ Confirmed — Contacts Revealed</div>
                              {(() => {
                                const number = pay.watcher_contact || "";
                                const platform = pay.watcher_platform || "WhatsApp";
                                const digits = number.replace(/\D/g, "");
                                const intl = digits.startsWith("0") ? "233" + digits.slice(1) : digits;
                                const link = platform === "Telegram" ? `https://t.me/+${intl}` : `https://wa.me/${intl}`;
                                return (
                                  <a href={link} target="_blank" rel="noopener noreferrer"
                                    style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"10px 16px", borderRadius:10, background:platform==="Telegram"?`#0088cc22`:`#25D36622`, border:`1px solid ${platform==="Telegram"?"#0088cc":"#25D366"}`, textDecoration:"none", marginTop:6 }}>
                                    <span style={{ fontSize:20 }}>{platform==="Telegram"?"✈️":"💬"}</span>
                                    <div>
                                      <div style={{ fontFamily:"'DM Mono',monospace", fontSize:15, color:platform==="Telegram"?"#0088cc":"#25D366", fontWeight:700 }}>{number}</div>
                                      <div style={{ fontSize:11, color:c.sub }}>Tap to call on {platform}</div>
                                    </div>
                                  </a>
                                );
                              })()}
                            </div>
                          )}
                          {conf && conf.status === "pending" && (
                            <div style={{ marginTop:8, padding:"8px 10px", borderRadius:8, background:`${c.gold}10`, border:`1px solid ${c.gold}30`, fontSize:12, color:c.goldL }}>
                              ⏳ Awaiting watcher confirmation…
                            </div>
                          )}
                          {pay.status==="confirmed" && !callDone && !conf && (
                            <Btn small variant="green" onClick={()=>onMarkDone(pay.id,live)} style={{ marginTop:10 }}>✓ Mark Call Done</Btn>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding:"12px 16px", borderRadius:10, background:`${c.green}10`, border:`1px solid ${c.green}30`, marginBottom:20, fontSize:13, color:c.green }}>
                    ✅ No active requests right now.
                  </div>
                )}

                {closedReqs.length > 0 && (
                  <div style={{ background:c.card, border:`1px solid ${c.border}`, borderRadius:14, overflow:"hidden" }}>
                    <div onClick={()=>setHostHistoryOpen(o=>!o)} style={{ padding:"14px 18px", display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}
                      onMouseEnter={e=>e.currentTarget.style.background=c.surface}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <span style={{ fontSize:18 }}>📁</span>
                        <div>
                          <div style={{ fontWeight:600, fontSize:14 }}>Previous Requests</div>
                          <div style={{ color:c.sub, fontSize:12 }}>{closedReqs.length} completed call{closedReqs.length!==1?"s":""}</div>
                        </div>
                      </div>
                      <span style={{ color:c.sub, fontSize:18 }}>{hostHistoryOpen?"▲":"▼"}</span>
                    </div>
                    {hostHistoryOpen && (
                      <div style={{ padding:"0 12px 12px" }}>
                        {closedReqs.map(pay => {
                          const callDone = calls.find(cl=>cl.payment_id===pay.id);
                          const conf = (callConfirmations||[]).find(cc=>cc.payment_id===pay.id);
                          return (
                            <div key={pay.id} style={{ padding:14, borderRadius:10, marginBottom:8, background:c.surface, border:`1px solid ${c.border}` }}>
                              <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
                                <div>
                                  <div style={{ fontWeight:600, fontSize:13 }}>{pay.watcher_name}</div>
                                  <div style={{ fontSize:11, color:c.sub }}>{new Date(pay.created_at||pay.ts).toLocaleString()}</div>
                                </div>
                                <div style={{ textAlign:"right" }}>
                                  <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18, color:c.goldL }}>{S}{pay.total_charged||pay.amount}</div>
                                  <div style={{ fontSize:11, fontWeight:600, color:
                                    pay.status==="completed"?c.green:
                                    pay.status==="refunded"||pay.status==="refunded_partial"?c.red:
                                    conf?.status==="confirmed"||conf?.status==="auto_confirmed"?c.green:c.sub
                                  }}>
                                    {pay.status==="completed"||conf?.status==="confirmed"||conf?.status==="auto_confirmed"?"✅ Done":
                                     pay.status==="refunded"?"↩ Refunded":
                                     pay.status==="refunded_partial"?"↩ Partial Refund":"Done"}
                                  </div>
                                </div>
                              </div>
                              {(callDone?.released) && (
                                <div style={{ marginTop:8, fontSize:12, color:c.green }}>💸 Funds released to your MoMo</div>
                              )}
                              {conf?.status==="auto_confirmed" && (
                                <div style={{ marginTop:6, fontSize:11, color:c.dim }}>🤖 Auto-confirmed after timeout</div>
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

        {tab==="manage profile" && (
          <div className="fu">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22 }}>Manage Profile</div>
              {!editing ? <Btn small onClick={startEdit}>Edit Profile</Btn>
                : <div style={{ display:"flex", gap:8 }}><Btn small variant="green" onClick={save} disabled={busy}>{busy?"Saving…":"Save"}</Btn><Btn small variant="surface" onClick={()=>setEditing(false)}>Cancel</Btn></div>}
            </div>
            <div style={{ background:c.card, border:`1px solid ${c.border}`, borderRadius:16, padding:28 }}>
              {!editing ? (
                <>
                  <div style={{ display:"flex", gap:18, alignItems:"center", marginBottom:22 }}>
                    <Avatar user={live} size={78} ring />
                    <div><div style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:600 }}>{live.name}</div><div style={{ color:c.sub, fontSize:14 }}>{live.bio}</div></div>
                  </div>
                  {safeArr(live.photos).length>0 && (
                    <div style={{ marginBottom:18 }}><div style={{ color:c.sub, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>Gallery</div>
                      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>{safeArr(live.photos).map((src,i)=><img key={i} src={src} alt="" style={{ width:96, height:96, borderRadius:10, objectFit:"cover" }} />)}</div>
                    </div>
                  )}
                  <div style={{ borderTop:`1px solid ${c.border}`, paddingTop:20 }}>
                    <SectionHeader icon="🔒" title="Payout Information" />
                    <div style={{ color:c.sub, fontSize:13, lineHeight:2.1 }}>
                      <div>Provider: <strong style={{ color:c.text }}>{live.payoutProvider||"Not set"}</strong></div>
                      <div>Number: <strong style={{ color:c.goldL }}>{live.payoutNumber||"Not set"}</strong></div>
                      <div>Status: <strong style={{ color:live.paystackRecipientCode?c.green:c.orange }}>{live.paystackRecipientCode?"Active ✓":"Not configured"}</strong></div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display:"flex", gap:2, marginBottom:20, background:c.surface, padding:4, borderRadius:8, width:"fit-content" }}>
                    {["Public Info","Payout Info"].map((s,i)=>(
                      <button key={s} onClick={()=>setEditStep(i+1)} style={{ padding:"6px 14px", borderRadius:6, border:"none", cursor:"pointer", background:editStep===i+1?c.card:"transparent", color:editStep===i+1?c.goldL:c.sub, fontSize:11, fontWeight:600 }}>{s}</button>
                    ))}
                  </div>
                  {editStep===1 ? (
                    <>
                      <PhotoPick label="Profile Photo" value={ef.profilePhoto} onChange={eu("profilePhoto")} circle />
                      <Field label="Username" value={ef.name||""} onChange={eu("name")} />
                      <Field label="Bio" value={ef.bio||""} onChange={eu("bio")} rows={3} />
                      <Field label="Platform" value={ef.platform||"WhatsApp"} onChange={eu("platform")} options={["WhatsApp","Telegram"]} />
                      <Field label="Contact" value={ef.contactNumber||""} onChange={eu("contactNumber")} maxLength={10} type="tel" />
                      <Field label={`Rate (${CURRENCY})`} value={ef.rate||""} onChange={eu("rate")} type="number" />
                      <Field label="Tags" value={typeof ef.tags==="string"?ef.tags:safeArr(ef.tags).join(", ")} onChange={eu("tags")} />
                      <MultiPick label="Gallery" value={safeArr(ef.photos)} onChange={eu("photos")} max={4} />
                    </>
                  ) : (
                    <>
                      <SectionHeader icon="🔒" title="Payout Info" subtitle="Private — never shown to watchers" />
                      <Field label="Payout Name" value={ef.payoutName||""} onChange={eu("payoutName")} />
                      <Field label="Payout Number" value={ef.payoutNumber||""} onChange={eu("payoutNumber")} type="tel" maxLength={10} />
                      <Field label="Provider" value={ef.payoutProvider||"MTN"} onChange={eu("payoutProvider")} options={PAYOUT_PROVIDERS} />
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

function HostCard({ u, onConnect, setGallery, onReport, onFavorite, isFav, currentUser }) {
  const [showFullBio, setShowFullBio] = useState(false);
  const photos = [u.profilePhoto, ...safeArr(u.photos)].filter(Boolean);
  const [idx, setIdx] = useState(0);
  // CHANGE 3: blur for non-logged-in on browse page too
  const isBlurred = !currentUser;
  
  return (
    <div className="fi" style={{ background: `linear-gradient(180deg, ${c.card}, #1a1a24)`, border: `1px solid ${c.border}`, borderRadius: 18, overflow: "hidden", cursor: "pointer", transition: "all .3s", position: "relative" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = c.gold; e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = `0 20px 50px ${c.gold}10`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
      
      {currentUser && (
        <button onClick={(e) => { e.stopPropagation(); onFavorite(u.id); }}
          style={{ position: "absolute", top: 12, right: 12, zIndex: 10, background: "#0a0a0fcc", border: "none", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 18, backdropFilter: "blur(4px)", color: isFav ? c.gold : c.sub, transition: "all .2s" }}
          onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"}
          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
          {isFav ? "❤️" : "♡"}
        </button>
      )}

      <div style={{ position: "relative", width: "100%", aspectRatio: "1/1", overflow: "hidden" }}>
        {photos.length > 0 ? (
          <img src={photos[idx]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: isBlurred ? "blur(4px) brightness(0.7)" : "none", transform: isBlurred ? "scale(1.05)" : "none", transition: "filter .3s" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${c.goldD}, #1a1a2e)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cormorant Garamond',serif", fontSize: 64, color: c.gold, opacity: .3 }}>{u.avatar}</div>
        )}
        {isBlurred && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, zIndex: 3 }}>
            <div style={{ fontSize: 28 }}>🔐</div>
            <div style={{ color: "#fff", fontWeight: 600, fontSize: 13, textAlign: "center", lineHeight: 1.4 }}>Sign up to<br/>view profile</div>
          </div>
        )}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 50, background: "linear-gradient(to top,#0a0a0fcc,transparent)" }} />
        <div style={{ position: "absolute", top: 12, left: 12, display: "flex", alignItems: "center", gap: 6, background: "#0a0a0f99", padding: "3px 8px", borderRadius: 20, zIndex: 2 }}>
          <OnlineDot on={u.online} />
          <span style={{ fontSize: 10, color: u.online ? c.green : c.dim }}>{u.online ? "Live" : "Offline"}</span>
        </div>
        {!isBlurred && photos.length > 1 && (
          <>
            <button onClick={e => { e.stopPropagation(); setIdx(p => (p - 1 + photos.length) % photos.length); }}
              style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", background: "#0a0a0faa", border: "none", color: c.text, width: 32, height: 32, borderRadius: "50%", cursor: "pointer", fontSize: 18, zIndex: 2 }}>‹</button>
            <button onClick={e => { e.stopPropagation(); setIdx(p => (p + 1) % photos.length); }}
              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "#0a0a0faa", border: "none", color: c.text, width: 32, height: 32, borderRadius: "50%", cursor: "pointer", fontSize: 18, zIndex: 2 }}>›</button>
            <div style={{ position: "absolute", bottom: 8, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 4, zIndex: 2 }}>
              {photos.map((_, di) => (
                <div key={di} onClick={e => { e.stopPropagation(); setIdx(di); }}
                  style={{ width: di === idx ? 16 : 6, height: 6, borderRadius: 3, background: di === idx ? c.gold : "#ffffff55", cursor: "pointer" }} />
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{ padding: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{u.name}</div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: c.goldL, fontWeight: 600 }}>
  {S}{u.rate}
</div>
        </div>
        {!isBlurred && <HostRating hostId={u.id} />}
        <div style={{ color: c.sub, fontSize: 12, marginBottom: 10, lineHeight: 1.5 }}>
  {showFullBio ? u.bio : `${(u.bio || "").slice(0, 80)}${(u.bio || "").length > 80 ? "…" : ""}`}
  {(u.bio || "").length > 80 && (
    <span onClick={(e) => { e.stopPropagation(); setShowFullBio(!showFullBio); }}
      style={{ color: c.gold, cursor: "pointer", marginLeft: 5, fontSize: 11 }}>
      {showFullBio ? "show less" : "more"}
    </span>
  )}
</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
          {isBlurred
            ? [1,2,3].map(i => <Chip key={i} label="••••" />)
            : <>
                {safeArr(u.tags).slice(0, 3).map(t => <Chip key={t} label={t} color={c.goldD} />)}
                {safeArr(u.tags).length > 3 && <Chip label={`+${safeArr(u.tags).length - 3}`} color={c.sub} />}
              </>
          }
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: c.sub }}>via</span>
            <span style={{ fontSize: 12, fontWeight: 500 }}>{u.platform || "WhatsApp"}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {!isBlurred && (
              <button onClick={(e) => { e.stopPropagation(); onReport(u); }}
                style={{ background: "none", border: "none", color: c.dim, fontSize: 12, cursor: "pointer", padding: "4px 8px", borderRadius: 6, transition: "all .2s" }}
                onMouseEnter={e => e.currentTarget.style.color = c.red}
                onMouseLeave={e => e.currentTarget.style.color = c.dim}>⚠️</button>
            )}
            <Btn small onClick={(e) => { e.stopPropagation(); onConnect(u); }} style={{ padding: "6px 14px" }}>
              {isBlurred ? "Sign Up →" : "Connect →"}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

function GalleryModal({ host, onClose }) {
  const photos = [host.profilePhoto, ...safeArr(host.photos)].filter(Boolean);
  const [idx, setIdx] = useState(0);
  if (!host) return null;
  return (
    <Modal onClose={onClose} wide>
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
          {photos[idx] ? (
            <img src={photos[idx]} alt="" style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: 12, objectFit: "contain" }} />
          ) : (
            <div style={{ padding: 60, color: c.sub }}>No photos</div>
          )}
        </div>
        {photos.length > 1 && (
          <>
            <button onClick={() => setIdx(p => (p - 1 + photos.length) % photos.length)}
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", background: "#0a0a0fcc", border: "none", color: c.text, width: 40, height: 40, borderRadius: "50%", cursor: "pointer", fontSize: 24 }}>‹</button>
            <button onClick={() => setIdx(p => (p + 1) % photos.length)}
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "#0a0a0fcc", border: "none", color: c.text, width: 40, height: 40, borderRadius: "50%", cursor: "pointer", fontSize: 24 }}>›</button>
          </>
        )}
        <div style={{ textAlign: "center", marginTop: 16, color: c.sub, fontSize: 12 }}>{idx + 1} / {photos.length}</div>
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: c.goldL }}>{host.name}</div>
          <div style={{ color: c.sub, fontSize: 13, marginTop: 4 }}>{host.bio}</div>
        </div>
      </div>
    </Modal>
  );
}

function BrowseView({ users, payments, onInitiatePayment, currentUser, toast, verifyPrompts, onAnswerVerify, setView, refundReqs, onRefundRequest, onHostApproveRefund, pendingHost, setPendingHost, callConfirmations, onConfirmCall, favorites, toggleFavorite }) {
  const [watcherContact,  setWatcherContact]  = useState("");
  const [watcherPlatform, setWatcherPlatform]  = useState("WhatsApp");
  const [payModal,  setPayModal]  = useState(null);
  const [gallery,   setGallery]   = useState(null);
  const [watcher,   setWatcher]   = useState(currentUser?.name||"");
  const [paying,    setPaying]    = useState(false);
  const [page, setPage] = useState(1);
  const [filter,    setFilter]    = useState("all");
  const [refundModal,   setRefundModal]   = useState(null);
  const [refundReason,  setRefundReason]  = useState("");
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [reportModal, setReportModal] = useState(null);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");

  useEffect(() => { if (currentUser?.name) setWatcher(currentUser.name); }, [currentUser]);

  useEffect(() => {
    if (pendingHost && currentUser) {
      setPayModal(pendingHost);
      setPendingHost(null);
    }
  }, [pendingHost, currentUser]);

  useEffect(() => { setPage(1); }, [search, selectedTags, filter]);

  const pendingVP = verifyPrompts.filter(v=>!v.answered);
  const allHosts = users.filter(u=>u.role==="host");
  const onlineHosts = allHosts.filter(u=>u.online);
  const offlineHosts = allHosts.filter(u=>!u.online);
  
  let filtered = filter==="online" ? onlineHosts : [...onlineHosts, ...offlineHosts];
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(u => u.name.toLowerCase().includes(q) || (u.bio||"").toLowerCase().includes(q));
  }
  if (selectedTags.length > 0) {
    filtered = filtered.filter(u => {
      const hostTags = safeArr(u.tags).map(t=>t.toLowerCase());
      return selectedTags.some(tag => hostTags.includes(tag.toLowerCase()));
    });
  }

  const toggleTag = (tag) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t=>t!==tag) : [...prev, tag]);
  };

  const handleConnect = (host) => {
    if (!currentUser) {
      localStorage.setItem("pendingHost", JSON.stringify(host));
      setShowLoginModal(true);
      return;
    }
    setPayModal(host);
  };

  const confirmPay = async () => {
    if (!watcher.trim())        { toast("Enter your name","error"); return; }
    if (!watcherContact.trim() || watcherContact.length !== 10) { toast("Enter a valid 10-digit contact number","error"); return; }
    setPaying(true);
    await onInitiatePayment(payModal, { watcherName: watcher, watcherContact, watcherPlatform });
    setPaying(false);
  };

  const submitRefund = async () => {
    if (!refundModal) return;
    await onRefundRequest(refundModal.id, refundReason||"Call did not take place");
    setRefundModal(null); setRefundReason("");
  };

  const handleReport = (host) => {
    if (!currentUser) { setShowLoginModal(true); return; }
    setReportModal(host);
  };

  const submitReport = async () => {
    if (!reportReason.trim()) { toast("Please enter a reason","error"); return; }
    await fetch(`${API_BASE}/api/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reporterId: currentUser?.id, reportedUsername: reportModal.name, reason: reportReason, details: reportDetails })
    });
    toast("Report submitted. Thank you.");
    setReportModal(null); setReportReason(""); setReportDetails("");
  };

  const FEE_PCT = 20;
  const feePreview    = payModal ? parseFloat((payModal.rate * FEE_PCT / 100).toFixed(2)) : 0;
  const totalPreview  = payModal ? payModal.rate + feePreview : 0;

  return (
    <div style={{ minHeight:"calc(100vh - 60px)" }}>
      {pendingVP.length > 0 && (
        <div style={{ background:`${c.gold}18`, borderBottom:`1px solid ${c.gold}`, padding:"14px 40px" }}>
          <div style={{ fontWeight:600, color:c.goldL, marginBottom:8 }}>📋 Admin Verification Request</div>
          {pendingVP.map(vp=>(
            <div key={vp.id} style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap", marginBottom:6 }}>
              <span style={{ color:c.sub, fontSize:13, flex:1 }}>Did the video call take place?</span>
              <Btn variant="green" small onClick={()=>onAnswerVerify(vp.id,true)}>Yes</Btn>
              <Btn variant="red" small onClick={()=>onAnswerVerify(vp.id,false)}>Dispute</Btn>
            </div>
          ))}
        </div>
      )}

      {currentUser?.role==="watcher" && (() => {
        const myPaymentIds = new Set(payments.filter(p=>p.watcher_id===currentUser.id||p.watcher_name?.toLowerCase()===currentUser.name?.toLowerCase()).map(p=>p.id));
        const conf = (callConfirmations||[]).find(c=>c.status==="pending" && myPaymentIds.has(c.payment_id));
        if (!conf) return null;
        return (
          <div style={{ background:`linear-gradient(135deg,${c.gold}20,${c.goldD})`, borderBottom:`2px solid ${c.gold}`, padding:"18px 40px", display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
            <span style={{ fontSize:24 }}>📞</span>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:600, color:c.goldL, marginBottom:2 }}>Did the call happen?</div>
              <div style={{ color:c.sub, fontSize:12 }}>Your host marked this call as done. Confirm to release their payment.</div>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <Btn variant="green" small onClick={()=>onConfirmCall(conf.id,"yes")}>✓ Yes — Pay Host</Btn>
              <Btn variant="red" small onClick={()=>onConfirmCall(conf.id,"no")}>✕ Dispute</Btn>
            </div>
          </div>
        );
      })()}

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"36px 24px" }}>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:36, fontWeight:300, marginBottom:6 }}>Find Your Consultant</div>

        {!currentUser && (
          <div style={{ background:`${c.gold}15`, border:`1px solid ${c.gold}40`, borderRadius:12, padding:"12px 18px", marginBottom:18, display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
            <span style={{ fontSize:18 }}>🔐</span>
            <span style={{ color:c.sub, fontSize:13, flex:1 }}>Sign up to see full profiles, photos, and rates</span>
            <Btn small onClick={()=>setView("signup")}>Sign Up Free →</Btn>
            <Btn small variant="ghost" onClick={()=>setView("login")}>Sign In</Btn>
          </div>
        )}

        <div style={{ marginBottom:14 }}>
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search by name or expertise…" 
            style={{ width:"100%", maxWidth:500, padding:"10px 16px", background:c.surface, border:`1px solid ${c.border}`, borderRadius:10, color:c.text, fontSize:14, fontFamily:"'Plus Jakarta Sans',sans-serif" }}
          />
        </div>

        <div style={{ display:"flex", gap:10, marginBottom:16 }}>
          {["all","online"].map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{ padding:"8px 18px", borderRadius:20, border:`1px solid ${filter===f?c.gold:c.border}`, background:filter===f?c.goldD:"transparent", color:filter===f?c.goldL:c.sub, cursor:"pointer", fontSize:13 }}>
              {f==="all"?"All Consultants":"🟢 Online Now"}
            </button>
          ))}
        </div>

        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:20 }}>
          {ALL_TAGS.map(tag=>(
            <button key={tag} onClick={()=>toggleTag(tag)} style={{
              padding:"5px 12px", borderRadius:20, border:`1px solid ${selectedTags.includes(tag)?c.gold:c.border}`,
              background:selectedTags.includes(tag)?c.goldD:"transparent", color:selectedTags.includes(tag)?c.goldL:c.sub,
              cursor:"pointer", fontSize:11, fontFamily:"'Plus Jakarta Sans',sans-serif", transition:"all .2s"
            }}>{tag}</button>
          ))}
          {selectedTags.length > 0 && (
            <button onClick={()=>setSelectedTags([])} style={{ padding:"5px 12px", borderRadius:20, border:`1px solid ${c.red}`, background:"transparent", color:c.red, cursor:"pointer", fontSize:11 }}>✕ Clear</button>
          )}
        </div>

        <div style={{ color:c.sub, fontSize:12, marginBottom:16 }}>
          {filtered.length} consultant{filtered.length!==1?"s":""} found
        </div>

        {filtered.length===0 && <div style={{ textAlign:"center", color:c.sub, padding:"60px 0" }}>No consultants match your filters. <span style={{ color:c.gold, cursor:"pointer" }} onClick={()=>{setSearch("");setSelectedTags([]);setFilter("all");}}>Clear filters →</span></div>}
        
        {(() => {
          const PER_PAGE = 12;
          const totalPages = Math.ceil(filtered.length / PER_PAGE);
          const paged = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE);
          return (
            <>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:18 }}>
                {paged.map((u)=>(
                  <HostCard key={u.id} u={u} onConnect={handleConnect} setGallery={setGallery}
                    onReport={handleReport}
                    onFavorite={toggleFavorite}
                    currentUser={currentUser}
                    isFav={favorites.some(f => f.host_id === u.id && f.watcher_id === currentUser?.id)} />
                ))}
              </div>
              {totalPages > 1 && (
                <div style={{ display:"flex", justifyContent:"center", gap:8, marginTop:28 }}>
                  <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}
                    style={{ padding:"8px 16px", borderRadius:8, border:`1px solid ${c.border}`, background:page===1?c.surface:c.card, color:page===1?c.dim:c.text, cursor:page===1?"default":"pointer" }}>← Prev</button>
                  <span style={{ padding:"8px 16px", color:c.sub, fontSize:13 }}>Page {page} of {totalPages}</span>
                  <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}
                    style={{ padding:"8px 16px", borderRadius:8, border:`1px solid ${c.border}`, background:page===totalPages?c.surface:c.card, color:page===totalPages?c.dim:c.text, cursor:page===totalPages?"default":"pointer" }}>Next →</button>
                </div>
              )}
            </>
          );
        })()}
      </div>

      {showLoginModal && (
        <Modal onClose={()=>setShowLoginModal(false)} title="Sign In to Continue">
          <div style={{ textAlign:"center", padding:"20px 0" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🔐</div>
            <div style={{ color:c.sub, fontSize:14, marginBottom:20, lineHeight:1.7 }}>
              You need an account to connect with consultants.<br/>It only takes a moment.
            </div>
            <div style={{ display:"flex", gap:10, justifyContent:"center", flexDirection:"column" }}>
              <Btn onClick={()=>{setShowLoginModal(false);setView("login");}} full>Sign In</Btn>
              <Btn variant="ghost" onClick={()=>{setShowLoginModal(false);setView("signup");}} full>Create Account</Btn>
            </div>
          </div>
        </Modal>
      )}

      {payModal && currentUser && (
        <Modal onClose={()=>!paying&&setPayModal(null)}>
          <div style={{ display:"flex", gap:14, alignItems:"center", marginBottom:18 }}>
            <Avatar user={payModal} size={56} ring />
            <div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22 }}>{payModal.name}</div>
              <div style={{ color:c.sub, fontSize:13 }}>via {payModal.platform}</div>
            </div>
          </div>
          <div style={{ background:`${c.green}12`, border:`1px solid ${c.green}40`, borderRadius:10, padding:"10px 14px", marginBottom:16, display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:20 }}>🔒</span>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:c.green }}>Secure Escrow via Paystack</div>
              <div style={{ fontSize:11, color:c.sub }}>Funds held securely. Contact revealed after payment.</div>
            </div>
          </div>
          <div style={{ background:`${c.gold}12`, border:`1px solid ${c.gold}40`, borderRadius:12, padding:20, marginBottom:18 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
              <span style={{ color:c.sub, fontSize:13 }}>Consultation fee</span>
              <span style={{ fontWeight:600 }}>{S}{payModal.rate}</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12, paddingBottom:12, borderBottom:`1px solid ${c.border}` }}>
              <span style={{ color:c.sub, fontSize:13 }}>Platform fee ({FEE_PCT}%)</span>
              <span style={{ color:c.sub }}>{S}{feePreview}</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontWeight:600 }}>Total</span>
              <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:28, color:c.goldL, fontWeight:600 }}>{S}{totalPreview.toFixed(2)}</div>
            </div>
          </div>
          <Field label="Your Name" value={watcher} onChange={setWatcher} disabled />
          <Field label="Contact Number *" value={watcherContact} onChange={setWatcherContact} type="tel" maxLength={10} hint="10-digit WhatsApp/Telegram number" />
          <Field label="Preferred Platform" value={watcherPlatform} onChange={setWatcherPlatform} options={["WhatsApp","Telegram"]} />
          {!paying
            ? <Btn onClick={confirmPay} full style={{ marginTop:8 }}>Pay {S}{totalPreview.toFixed(2)} Securely →</Btn>
            : <div style={{ textAlign:"center", padding:"22px 0" }}><Spinner /><div style={{ color:c.sub, marginTop:12 }}>Preparing payment…</div></div>
          }
          <div style={{ textAlign:"center", marginTop:10, color:c.dim, fontSize:11 }}>Redirected to Paystack. Funds held in escrow.</div>
        </Modal>
      )}

      {refundModal && (
        <Modal onClose={()=>setRefundModal(null)} title="Request Refund">
          <div style={{ marginBottom:16, padding:14, borderRadius:10, background:`${c.orange}14`, border:`1px solid ${c.orange}40` }}>
            <div style={{ fontWeight:600, marginBottom:4 }}>Payment: {S}{refundModal.total_charged||refundModal.amount}</div>
            <div style={{ fontSize:12, color:c.sub }}>
              {refundModal.status==="pending" ? "Payment not yet confirmed. 70% automatic refund available." : "Payment confirmed. Host must approve the refund."}
            </div>
          </div>
          <Field label="Reason" value={refundReason} onChange={setRefundReason} rows={3} placeholder="e.g. Host didn't show up" />
          <div style={{ display:"flex", gap:10, marginTop:8 }}>
            <Btn variant="orange" onClick={submitRefund} full>Submit Request</Btn>
            <Btn variant="surface" onClick={()=>setRefundModal(null)} small>Cancel</Btn>
          </div>
        </Modal>
      )}

      {reportModal && (
        <Modal onClose={()=>setReportModal(null)} title={`Report ${reportModal.name}`}>
          <div style={{ marginBottom:16, color:c.sub, fontSize:13 }}>Report this consultant for violating terms or suspicious behavior.</div>
          <Field label="Reason *" value={reportReason} onChange={setReportReason}
            options={["Did not show up","Fake profile","Inappropriate behavior","Scam/fraud","Other"]} />
          <Field label="Details" value={reportDetails} onChange={setReportDetails} rows={3} placeholder="Describe what happened…" />
          <div style={{ display:"flex", gap:10, marginTop:8 }}>
            <Btn variant="red" onClick={submitReport} full>Submit Report</Btn>
            <Btn variant="surface" onClick={()=>setReportModal(null)} small>Cancel</Btn>
          </div>
        </Modal>
      )}

      {gallery && <GalleryModal host={gallery} onClose={()=>setGallery(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  WATCHER DASHBOARD — Changes: no total spend, early refund,
//  dispute outcome notification, collapse resolved to history
// ═══════════════════════════════════════════════════════════════
function WatcherDashboardView({ user, users, payments, refundReqs, onRefundRequest, toast, setView, callConfirmations, onConfirmCall, favorites, toggleFavorite }) {
  const myPayments = payments.filter(p =>
    (p.watcher_id===user?.id || p.watcher_name?.toLowerCase()===user?.name?.toLowerCase())
    && p.status!=="poke" && p.status!=="pending_init" && p.status!=="failed"
  );

  const myPaymentIds = new Set(myPayments.map(p => p.id));

  const livePayments = myPayments.filter(p => {
    if (p.status !== "pending" && p.status !== "confirmed") return false;
    const conf = (callConfirmations||[]).find(cc => cc.payment_id === p.id);
    if (conf && (conf.status === "confirmed" || conf.status === "auto_confirmed")) return false;
    const myRefund = refundReqs.find(r => r.payment_id === p.id);
    if (myRefund && (myRefund.status === "denied" || myRefund.status === "approved")) return false;
    return true;
  });

  const previousPayments = myPayments.filter(p => {
    if (p.status === "completed" || p.status === "refunded" || p.status === "refunded_partial") return true;
    const conf = (callConfirmations||[]).find(cc => cc.payment_id === p.id);
    if (conf && (conf.status === "confirmed" || conf.status === "auto_confirmed")) return true;
    const myRefund = refundReqs.find(r => r.payment_id === p.id);
    // CHANGE 4: approved OR denied refunds collapse to history
    if (myRefund && (myRefund.status === "approved" || myRefund.status === "denied")) return true;
    return false;
  });

  const pendingConfirmation = (callConfirmations||[]).find(c =>
    c.status === "pending" && myPaymentIds.has(c.payment_id)
  );

  const [ratedPayments, setRatedPayments] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [savedFavorites, setSavedFavorites] = useState([]);

  useEffect(() => {
    if (user?.id) {
      supabase.from("favorites").select("*, users!favorites_host_id_fkey(*)").eq("watcher_id", user.id)
        .then(({ data }) => { if (data) setSavedFavorites(data); });
    }
  }, [user?.id]);

  // CHANGE 4: Check for newly resolved refunds to notify watcher
  const resolvedRefunds = refundReqs.filter(r =>
    myPaymentIds.has(r.payment_id) &&
    (r.status === "approved" || r.status === "denied") &&
    !localStorage.getItem(`notified_refund_${r.id}`)
  );

  useEffect(() => {
    resolvedRefunds.forEach(r => {
      if (r.status === "approved") {
        toast(`✅ Your refund for ${S}${r.refund_amount || ""} was approved — funds returned to you`, "success");
      } else if (r.status === "denied") {
        toast(`❌ Your refund request was denied by admin`, "error");
      }
      localStorage.setItem(`notified_refund_${r.id}`, "1");
    });
  }, [refundReqs]);

  const PaymentCard = ({ p, isLive }) => {
    const host = users.find(u => u.id===(p.target_user_id||p.targetUserId));
    const myRefund = refundReqs.find(r => r.payment_id===p.id);
    const myConf = (callConfirmations||[]).find(c => c.payment_id===p.id);
    const isDone = p.status==="completed" || myConf?.status==="confirmed" || myConf?.status==="auto_confirmed";

    // CHANGE 2: Early refund — show if contact revealed and no refund yet and no confirmation pending
    // Watcher can request refund if host contact revealed but they haven't been contacted in time
    const canEarlyRefund = p.status==="confirmed"
      && !myRefund
      && !(myConf?.status==="confirmed" || myConf?.status==="auto_confirmed")
      && !isDone;

    const canCancel = p.status==="pending" && !myConf && !myRefund;

    return (
      <div style={{
        borderRadius:14, background:`linear-gradient(135deg,${c.card},#1a1a24)`,
        border:`1px solid ${
          isDone?c.green:
          p.status==="refunded"||p.status==="refunded_partial"?c.red:
          myRefund?.status==="denied"?c.red:
          p.status==="confirmed"?c.gold:c.border
        }`,
        overflow:"hidden", marginBottom: isLive ? 0 : 10
      }}>
        <div style={{ padding:"16px 18px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10, marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <Avatar user={host} size={40} />
              <div>
                <div style={{ fontWeight:600, fontSize:15 }}>{host?.name||"Host"}</div>
                <div style={{ fontSize:11, color:c.sub }}>{new Date(p.created_at||p.ts).toLocaleString()}</div>
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, color:c.goldL, fontWeight:600 }}>{S}{p.total_charged||p.amount}</div>
              <div style={{ fontSize:11, fontWeight:600, marginTop:2, color:
                isDone?c.green:
                p.status==="pending"?"#facc15":
                p.status==="confirmed"?c.gold:
                p.status==="refunded"||p.status==="refunded_partial"?c.red:
                myRefund?.status==="denied"?c.red:c.sub
              }}>
                {isDone?"✅ Call complete":
                 p.status==="pending"?"🟡 Awaiting confirmation":
                 p.status==="confirmed"?"🟢 Confirmed — contact revealed":
                 p.status==="refunded"?"↩ Refunded":
                 p.status==="refunded_partial"?"↩ Partially refunded":p.status}
              </div>
            </div>
          </div>

          {p.status==="pending" && !isDone && (
            <div style={{ padding:"10px 14px", borderRadius:8, background:c.surface, border:`1px solid ${c.border}`, fontSize:12, color:c.sub }}>
              🔒 Waiting for payment to be confirmed. Contact will be revealed automatically.
            </div>
          )}

          {(p.status==="confirmed" || isDone) && p.host_contact_revealed && (
            <div style={{ padding:"10px 14px", borderRadius:8, background:`${c.green}10`, border:`1px solid ${c.green}30`, marginBottom:10 }}>
              <div style={{ fontSize:11, color:c.green, marginBottom:3 }}>✓ Host Contact</div>
              {(() => {
                const number = p.host_contact_revealed || "";
                const platform = p.host_platform_revealed || "WhatsApp";
                const digits = number.replace(/\D/g, "");
                const intl = digits.startsWith("0") ? "233" + digits.slice(1) : digits;
                const link = platform === "Telegram" ? `https://t.me/+${intl}` : `https://wa.me/${intl}`;
                return (
                  <a href={link} target="_blank" rel="noopener noreferrer"
                    style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"10px 16px", borderRadius:10, background:platform==="Telegram"?`#0088cc22`:`#25D36622`, border:`1px solid ${platform==="Telegram"?"#0088cc":"#25D366"}`, textDecoration:"none", marginTop:6 }}>
                    <span style={{ fontSize:20 }}>{platform==="Telegram"?"✈️":"💬"}</span>
                    <div>
                      <div style={{ fontFamily:"'DM Mono',monospace", fontSize:15, color:platform==="Telegram"?"#0088cc":"#25D366", fontWeight:700 }}>{number}</div>
                      <div style={{ fontSize:11, color:c.sub }}>Tap to call on {platform}</div>
                    </div>
                  </a>
                );
              })()}
            </div>
          )}

          {isDone && (
            <div style={{ marginBottom:10 }}>
              <div style={{ padding:"10px 14px", borderRadius:8, background:`${c.green}10`, marginBottom:8 }}>
                <div style={{ color:c.green, fontWeight:600, fontSize:13 }}>✅ Call Complete — Thank you for using ConnectCall ✦</div>
                {myConf?.status==="auto_confirmed" && <div style={{ color:c.dim, fontSize:11, marginTop:4 }}>🤖 Auto-confirmed after timeout</div>}
              </div>
              {!ratedPayments.includes(p.id) && (
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  <span style={{ fontSize:12, color:c.sub }}>Rate your experience:</span>
                  {[1,2,3,4,5].map(star=>(
                    <button key={star} onClick={async()=>{
                      const res = await fetch(`${API_BASE}/api/rate`, {
                        method:"POST", headers:{"Content-Type":"application/json"},
                        body:JSON.stringify({ paymentId:p.id, watcherId:user?.id, hostId:p.target_user_id||p.targetUserId, rating:star })
                      });
                      if (res.ok) { setRatedPayments(prev=>[...prev,p.id]); toast("Thanks for rating! ⭐"); }
                      else toast("Already rated", "error");
                    }} style={{ background:"none", border:"none", cursor:"pointer", fontSize:22, padding:"0 1px" }}>⭐</button>
                  ))}
                </div>
              )}
              {ratedPayments.includes(p.id) && <div style={{ fontSize:12, color:c.gold }}>⭐ Rated — thank you!</div>}
            </div>
          )}

          {/* Refund status notification */}
          {myRefund && (
            <div style={{ padding:"8px 12px", borderRadius:8, marginBottom:10, background:
              myRefund.status==="approved"?`${c.green}10`:
              myRefund.status==="denied"?`${c.red}10`:`${c.orange}10`
            }}>
              {myRefund.status==="pending"||myRefund.status==="pending_host"
                ? <span style={{ color:c.orange, fontSize:12 }}>⏳ Refund under review by admin</span>
                : myRefund.status==="approved"
                  ? <span style={{ color:c.green, fontSize:12 }}>✅ Refund approved — funds returned to you</span>
                  : <span style={{ color:c.red, fontSize:12 }}>❌ Refund request denied by admin</span>}
            </div>
          )}

          {/* Actions — only on live cards */}
          {isLive && (
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {/* Cancel before contact revealed */}
              {canCancel && (
                <Btn small variant="orange" onClick={()=>onRefundRequest(p.id,"Cancelling request before contact revealed")}>
                  ✕ Cancel (get 70% back)
                </Btn>
              )}
              {/* CHANGE 2: Early refund — contact revealed but host hasn't contacted watcher */}
              {canEarlyRefund && (
                <Btn small variant="surface" onClick={()=>onRefundRequest(p.id,"Host contact revealed but host did not reach out in time")}>
                  ↩ Host didn't contact me
                </Btn>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ minHeight:"calc(100vh - 60px)", maxWidth:800, margin:"0 auto", padding:"32px 24px" }}>
      <div style={{ fontFamily:"'Playfair Display',serif", fontSize:32, marginBottom:4 }}>My Dashboard</div>
      <div style={{ color:c.sub, fontSize:13, marginBottom:24 }}>Welcome back, {user?.name?.split(" ")[0]} ✦</div>

      {/* CHANGE 1 (Remove total spend): Stats — only calls booked and refunds, no total spend */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:12, marginBottom:28 }}>
        {[
          ["Calls Booked", myPayments.length, c.blue],
          ["Refunds", refundReqs.filter(r=>r.status==="approved"&&(r.watcher_id===user?.id||myPaymentIds.has(r.payment_id))).length, c.orange],
        ].map(([l,v,col])=>(
          <div key={l} style={{ background:c.card, border:`1px solid ${c.border}`, borderRadius:14, padding:18, textAlign:"center" }}>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"clamp(20px,5vw,28px)", fontWeight:600, color:col }}>{v}</div>
            <div style={{ color:c.sub, fontSize:"clamp(9px,2vw,11px)", marginTop:4 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Pending call confirmation prompt */}
      {pendingConfirmation && (
        <div style={{ background:`linear-gradient(135deg,${c.gold}20,${c.goldD})`, border:`2px solid ${c.gold}`, borderRadius:16, padding:22, marginBottom:24 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
            <span style={{ fontSize:26 }}>📞</span>
            <div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, color:c.goldL, fontWeight:600 }}>Did the call happen?</div>
              <div style={{ color:c.sub, fontSize:12, marginTop:2 }}>Your host marked the call complete. Confirm to release payment.</div>
            </div>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <Btn variant="green" onClick={()=>onConfirmCall(pendingConfirmation.id,"yes")} style={{ flex:1 }}>Yes — Pay Host</Btn>
            <Btn variant="red" onClick={()=>onConfirmCall(pendingConfirmation.id,"no")} style={{ flex:1 }}>Dispute</Btn>
          </div>
        </div>
      )}

      {/* Saved Favorites */}
      {savedFavorites.length > 0 && (
        <div style={{ marginBottom:24 }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, marginBottom:12, color:c.goldL }}>❤️ Saved Consultants</div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            {savedFavorites.map(f => {
              const host = f.users || users.find(u=>u.id===f.host_id);
              if (!host) return null;
              const h = normaliseUser(host);
              return (
                <div key={f.id} onClick={()=>setView("browse")} style={{ background:c.card, border:`1px solid ${c.border}`, borderRadius:12, padding:"10px 14px", display:"flex", alignItems:"center", gap:10, cursor:"pointer", transition:"all .2s" }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=c.gold}
                  onMouseLeave={e=>e.currentTarget.style.borderColor=c.border}>
                  <Avatar user={h} size={34} />
                  <div>
                    <div style={{ fontWeight:600, fontSize:13 }}>{h.name}</div>
                    <div style={{ color:c.sub, fontSize:11 }}>{S}{h.rate}</div>
                  </div>
                  <OnlineDot on={h.online} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {myPayments.length === 0 ? (
        <div style={{ color:c.sub, textAlign:"center", padding:"40px 0" }}>
          No requests yet. <span style={{ color:c.gold, cursor:"pointer" }} onClick={()=>setView("browse")}>Browse consultants →</span>
        </div>
      ) : (
        <>
          {livePayments.length > 0 ? (
            <div style={{ marginBottom:24 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                <span style={{ width:8, height:8, borderRadius:"50%", background:c.green, display:"inline-block", animation:"pulse 2s infinite" }} />
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, color:c.goldL }}>
                  Live Request{livePayments.length > 1 ? "s" : ""} ({livePayments.length})
                </div>
              </div>
              {livePayments.map(p => <PaymentCard key={p.id} p={p} isLive />)}
            </div>
          ) : (
            <div style={{ padding:"14px 18px", borderRadius:12, background:`${c.green}10`, border:`1px solid ${c.green}30`, marginBottom:24, fontSize:13, color:c.green }}>
              ✅ No active requests — all calls are complete.
            </div>
          )}

          {/* CHANGE 4: Previous Calls folder — collapses resolved refunds too */}
          {previousPayments.length > 0 && (
            <div style={{ background:c.card, border:`1px solid ${c.border}`, borderRadius:14, overflow:"hidden" }}>
              <div onClick={()=>setHistoryOpen(o=>!o)} style={{ padding:"14px 18px", display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}
                onMouseEnter={e=>e.currentTarget.style.background=c.surface}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:18 }}>📁</span>
                  <div>
                    <div style={{ fontWeight:600, fontSize:14 }}>Previous Calls</div>
                    <div style={{ color:c.sub, fontSize:12 }}>{previousPayments.length} completed call{previousPayments.length!==1?"s":""}</div>
                  </div>
                </div>
                <span style={{ color:c.sub, fontSize:18 }}>{historyOpen?"▲":"▼"}</span>
              </div>
              {historyOpen && (
                <div style={{ padding:"0 12px 12px" }}>
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

function AdminView({ users, payments, calls, wallet, verifyPrompts, onRelease, reports, onPushVerify, setView, confirmPayment, refundReqs, callConfirmations, onApproveRefund, onDenyRefund }) {
  const [tab, setTab] = useState("overview");
  const [showPayHistory, setShowPayHistory] = useState(false);
  const [showCallHistory, setShowCallHistory] = useState(false);
  const [adminPayOpen, setAdminPayOpen] = useState(false);
  const [expandedPayments, setExpandedPayments] = useState(new Set());
  const [expandedCalls, setExpandedCalls] = useState(new Set());
  const pendingRefunds  = refundReqs.filter(r=>r.status==="pending"||r.status==="pending_host");
  const pendingPayments = payments.filter(p=>p.status==="pending" && p.paystack_verified);
  const hostsWithPayout = users.filter(u=>u.role==="host" && u.paystack_recipient_code).length;
  const hostsWithoutPayout = users.filter(u=>u.role==="host" && !u.paystack_recipient_code).length;

  const togglePayment = (id) => {
    setExpandedPayments(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };
  const toggleCall = (id) => {
    setExpandedCalls(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const exportCSV = () => {
    const rows = [
      ["Date","Watcher","Host","Amount","Fee","Status"],
      ...payments.filter(p=>p.paystack_verified).map(p=>{
        const host = users.find(u=>u.id===(p.target_user_id||p.targetUserId));
        return [new Date(p.created_at).toLocaleDateString(), p.watcher_name, host?.name||"—", p.total_charged||p.amount, p.platform_fee||0, p.status];
      })
    ];
    const csv = rows.map(r=>r.map(v=>`"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type:"text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `connectcall-analytics-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const renderCallCard = (conf, isPending) => {
    const pay = payments.find(p=>p.id===conf.payment_id);
    const host = users.find(u=>u.id===pay?.target_user_id);
    const isExpanded = expandedCalls.has(conf.id);
    return (
      <div key={conf.id} style={{ background:c.card, border:`1px solid ${isPending?c.orange+"50":c.green+"30"}`, borderRadius:12, marginBottom:8, overflow:"hidden" }}>
        <div onClick={()=>toggleCall(conf.id)} style={{ padding:"14px 18px", display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer", flexWrap:"wrap", gap:10 }}>
          <div>
            <div style={{ fontWeight:600 }}>{host?.name||"Host"} → {pay?.watcher_name||"Watcher"}</div>
            <div style={{ color:c.sub, fontSize:12 }}>{S}{pay?.amount} · {new Date(conf.created_at).toLocaleString()}</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:12, fontWeight:600, color:isPending?c.orange:c.green }}>
              {isPending?`🟡 Pending — expires ${new Date(conf.expires_at).toLocaleTimeString()}`:conf.status==="auto_confirmed"?"🤖 Auto-confirmed":"✅ Confirmed"}
            </span>
            <span style={{ color:c.sub }}>{isExpanded?"▲":"▼"}</span>
          </div>
        </div>
        {isExpanded && (
          <div style={{ padding:"0 18px 14px", borderTop:`1px solid ${c.border}`, paddingTop:12, fontSize:13, color:c.sub, lineHeight:2 }}>
            <div>Host: <strong style={{ color:c.text }}>{host?.name}</strong></div>
            <div>Watcher: <strong style={{ color:c.text }}>{pay?.watcher_name}</strong></div>
            <div>Amount: <strong style={{ color:c.goldL }}>{S}{pay?.amount}</strong></div>
            {!isPending && <div>Confirmed: <strong style={{ color:c.green }}>{conf.status==="auto_confirmed"?"Automatically":"By watcher"}</strong></div>}
            <div>Ref: <span style={{ fontFamily:"'DM Mono',monospace" }}>{pay?.paystack_ref}</span></div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ minHeight:"calc(100vh - 60px)" }}>
      <div style={{ maxWidth:1100, margin:"0 auto", padding:"32px 24px" }}>
        <div className="glow" style={{ background:`linear-gradient(135deg,${c.card},#1a1a24)`, border:`1px solid ${c.gold}40`, borderRadius:18, padding:28, marginBottom:28, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:16 }}>
          <div>
            <div style={{ color:c.sub, fontSize:11, textTransform:"uppercase", letterSpacing:1 }}>Escrow Balance</div>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:52, color:c.goldL, fontWeight:600 }}>{S}{Number(wallet).toFixed(2)}</div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {[["Users",users.length],["Verified",payments.filter(p=>p.paystack_verified).length],["Calls",callConfirmations?.filter(c=>c.status==="confirmed"||c.status==="auto_confirmed").length||0],["Payout Ready",hostsWithPayout],["No Payout",hostsWithoutPayout],["Refunds",pendingRefunds.length]].map(([l,v])=>(
              <div key={l} style={{ background:c.surface, borderRadius:10, padding:"12px 16px", minWidth:90 }}>
                <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, fontWeight:600, color:l==="Refunds"&&v>0?c.orange:l==="No Payout"&&v>0?c.red:c.text }}>{v}</div>
                <div style={{ color:c.sub, fontSize:11 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {pendingPayments.length > 0 && (
          <div style={{ background:`${c.gold}15`, border:`1px solid ${c.gold}`, borderRadius:12, padding:"12px 18px", marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div><strong style={{ color:c.goldL }}>{pendingPayments.length} payment(s)</strong> <span style={{ color:c.sub, fontSize:13 }}>awaiting confirmation</span></div>
            <Btn small onClick={()=>setTab("payments")}>Review →</Btn>
          </div>
        )}

        <div style={{ display:"flex", gap:2, marginBottom:22, background:c.surface, padding:4, borderRadius:10, width:"fit-content", flexWrap:"wrap" }}>
          {["overview","payments","calls","refunds","reports","users"].map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{ padding:"8px 18px", borderRadius:8, border:"none", cursor:"pointer", background:tab===t?c.card:"transparent", color:tab===t?c.goldL:c.sub, fontSize:12, fontWeight:600, position:"relative" }}>
              {t}
              {t==="refunds" && pendingRefunds.length>0 && <span style={{ position:"absolute", top:4, right:4, width:8, height:8, borderRadius:"50%", background:c.red }} />}
              {t==="payments" && pendingPayments.length>0 && <span style={{ position:"absolute", top:4, right:4, width:8, height:8, borderRadius:"50%", background:c.gold }} />}
              {t==="reports" && reports.filter(r=>r.status==="pending").length>0 && <span style={{ position:"absolute", top:4, right:4, width:8, height:8, borderRadius:"50%", background:c.orange }} />}
            </button>
          ))}
        </div>

        {tab==="overview" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20 }}>Platform Overview</div>
              <Btn small variant="ghost" onClick={exportCSV}>📥 Export CSV</Btn>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:12, marginBottom:24 }}>
              {[
                ["Hosts Online", users.filter(u=>u.online&&u.role==="host").length, c.green],
                ["Total Users", users.length, c.blue],
                ["Payments", payments.filter(p=>p.paystack_verified).length, c.goldL],
                ["Revenue", `${S}${payments.filter(p=>p.paystack_verified).reduce((a,x)=>a+Number(x.platform_fee||0),0).toFixed(0)}`, c.purple],
                ["Refunds", pendingRefunds.length, c.orange],
                ["Payout Ready", hostsWithPayout, c.green],
              ].map(([l,v,col])=>(
                <div key={l} style={{ background:c.card, border:`1px solid ${c.border}`, borderRadius:12, padding:16, textAlign:"center" }}>
                  <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:28, fontWeight:600, color:col }}>{v}</div>
                  <div style={{ color:c.sub, fontSize:11 }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ background:c.card, border:`1px solid ${c.border}`, borderRadius:14, padding:20, marginBottom:16 }}>
              <div style={{ fontWeight:600, marginBottom:14, color:c.goldL }}>🏆 Top Hosts by Earnings</div>
              {(() => {
                const hostEarnings = {};
                payments.filter(p=>p.paystack_verified).forEach(p=>{
                  const hid = p.target_user_id||p.targetUserId;
                  if (!hostEarnings[hid]) hostEarnings[hid] = 0;
                  hostEarnings[hid] += Number(p.amount||0);
                });
                const ranked = Object.entries(hostEarnings)
                  .map(([id,amt])=>({ host:users.find(u=>u.id===id), amount:amt }))
                  .filter(h=>h.host).sort((a,b)=>b.amount-a.amount).slice(0,5);
                if (ranked.length===0) return <div style={{ color:c.sub, fontSize:13 }}>No data yet.</div>;
                return ranked.map((h,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"8px 0", borderBottom:i<ranked.length-1?`1px solid ${c.border}`:"none" }}>
                    <span style={{ fontSize:18, minWidth:24 }}>{["🥇","🥈","🥉","4","5"][i]}</span>
                    <Avatar user={h.host} size={36} />
                    <div style={{ flex:1 }}><div style={{ fontWeight:600, fontSize:13 }}>{h.host.name}</div></div>
                    <div style={{ fontFamily:"'Cormorant Garamond',serif", fontWeight:600, color:c.goldL }}>{S}{h.amount.toFixed(0)}</div>
                  </div>
                ));
              })()}
            </div>
            <div style={{ background:c.card, border:`1px solid ${c.border}`, borderRadius:14, padding:20 }}>
              <div style={{ fontWeight:600, marginBottom:14, color:c.goldL }}>📊 Revenue (Last 7 Days)</div>
              {(() => {
                const days = [];
                for (let i=6; i>=0; i--) { const d=new Date(); d.setDate(d.getDate()-i); days.push(d.toLocaleDateString("en-US",{weekday:"short"})); }
                const dayRevenue = days.map(day=>payments.filter(p=>p.paystack_verified).reduce((sum,p)=>{
                  const pDate = new Date(p.created_at||p.ts).toLocaleDateString("en-US",{weekday:"short"});
                  return pDate===day ? sum+Number(p.platform_fee||0) : sum;
                },0));
                const maxRev = Math.max(...dayRevenue, 1);
                return days.map((day,i)=>(
                  <div key={day} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
                    <span style={{ minWidth:35, fontSize:11, color:c.sub }}>{day}</span>
                    <div style={{ flex:1, height:22, background:c.surface, borderRadius:4, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${(dayRevenue[i]/maxRev)*100}%`, background:`linear-gradient(90deg,${c.gold},${c.goldL})`, borderRadius:4, minWidth:2 }} />
                    </div>
                    <span style={{ fontSize:12, fontWeight:600, minWidth:40, textAlign:"right" }}>{S}{dayRevenue[i].toFixed(0)}</span>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {tab==="payments" && (() => {
          const visiblePays = payments.filter(p=>p.status!=="poke"&&p.status!=="pending_init"&&p.status!=="failed");
          const pendingPays = visiblePays.filter(p=>p.status==="pending" && p.paystack_verified);
          const historyPays = visiblePays.filter(p=>p.status!=="pending" || !p.paystack_verified);
          return (
            <div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, marginBottom:18 }}>Payment Ledger</div>
              {pendingPays.length > 0 && (
                <div style={{ marginBottom:20 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                    <span style={{ width:8, height:8, borderRadius:"50%", background:c.gold, display:"inline-block" }} />
                    <div style={{ fontWeight:600, color:c.goldL }}>Awaiting Confirmation ({pendingPays.length})</div>
                  </div>
                  {pendingPays.map(pay => {
                    const host = users.find(u=>u.id===(pay.target_user_id||pay.targetUserId));
                    const isExp = expandedPayments.has(pay.id);
                    return (
                      <div key={pay.id} style={{ background:c.card, border:`1px solid ${c.gold}`, borderRadius:12, marginBottom:8, overflow:"hidden" }}>
                        <div onClick={()=>togglePayment(pay.id)} style={{ padding:"14px 18px", display:"flex", gap:14, alignItems:"center", flexWrap:"wrap", cursor:"pointer" }}>
                          <div style={{ flex:1 }}>
                            <div style={{ fontWeight:600 }}>{pay.watcher_name} → {host?.name||"—"}</div>
                            <div style={{ color:c.sub, fontSize:12 }}>{new Date(pay.created_at||pay.ts).toLocaleString()}</div>
                          </div>
                          <div style={{ fontWeight:600 }}>{S}{pay.total_charged||pay.amount}</div>
                          <Btn small onClick={e=>{e.stopPropagation();confirmPayment(pay.id);}}>✓ Confirm</Btn>
                          <span style={{ color:c.sub }}>{isExp?"▲":"▼"}</span>
                        </div>
                        {isExp && (
                          <div style={{ padding:"0 18px 14px", borderTop:`1px solid ${c.border}`, paddingTop:12, fontSize:13, color:c.sub, lineHeight:2 }}>
                            <div>Ref: <span style={{ fontFamily:"'DM Mono',monospace", color:c.text }}>{pay.paystack_ref}</span></div>
                            <div>Fee: {S}{pay.platform_fee||0}</div>
                            {pay.watcher_contact && <div>Watcher: {pay.watcher_contact}</div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {historyPays.length > 0 && (
                <div style={{ background:c.card, border:`1px solid ${c.border}`, borderRadius:14, overflow:"hidden" }}>
                  <div onClick={()=>setAdminPayOpen(o=>!o)} style={{ padding:"14px 18px", display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}
                    onMouseEnter={e=>e.currentTarget.style.background=c.surface}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <span style={{ fontSize:18 }}>📁</span>
                      <div>
                        <div style={{ fontWeight:600, fontSize:14 }}>Payment History</div>
                        <div style={{ color:c.sub, fontSize:12 }}>{historyPays.length} transaction{historyPays.length!==1?"s":""}</div>
                      </div>
                    </div>
                    <span style={{ color:c.sub, fontSize:18 }}>{adminPayOpen?"▲":"▼"}</span>
                  </div>
                  {adminPayOpen && (
                    <div style={{ padding:"0 12px 12px" }}>
                      {historyPays.map(pay => {
                        const host = users.find(u=>u.id===(pay.target_user_id||pay.targetUserId));
                        const isExp = expandedPayments.has(pay.id);
                        return (
                          <div key={pay.id} style={{ background:c.surface, border:`1px solid ${pay.status==="refunded"?c.red:pay.status==="completed"?`${c.green}40`:c.border}`, borderRadius:10, marginBottom:8, overflow:"hidden" }}>
                            <div onClick={()=>togglePayment(pay.id)} style={{ padding:"12px 16px", display:"flex", gap:12, alignItems:"center", cursor:"pointer" }}>
                              <div style={{ flex:1 }}>
                                <div style={{ fontWeight:600, fontSize:13 }}>{pay.watcher_name} → {host?.name||"—"}</div>
                                <div style={{ color:c.sub, fontSize:11 }}>{new Date(pay.created_at||pay.ts).toLocaleString()}</div>
                              </div>
                              <div style={{ fontWeight:600, fontSize:13 }}>{S}{pay.total_charged||pay.amount}</div>
                              <div style={{ fontSize:11, fontWeight:600, color:pay.status==="completed"?c.green:pay.status==="refunded"?c.red:c.sub }}>{pay.status.toUpperCase()}</div>
                              <span style={{ color:c.sub, fontSize:14 }}>{isExp?"▲":"▼"}</span>
                            </div>
                            {isExp && (
                              <div style={{ padding:"0 16px 12px", borderTop:`1px solid ${c.border}`, paddingTop:10, fontSize:12, color:c.sub, lineHeight:2 }}>
                                <div>Ref: <span style={{ fontFamily:"'DM Mono',monospace", color:c.text, fontSize:11 }}>{pay.paystack_ref}</span></div>
                                <div>Fee collected: {S}{pay.platform_fee||0}</div>
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

        {tab==="calls" && (
          <div>
            {(() => {
              const pendingConfs = (callConfirmations||[]).filter(c=>c.status==="pending");
              const doneConfs    = (callConfirmations||[]).filter(c=>c.status==="confirmed"||c.status==="auto_confirmed");
              return (
                <>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                    <div style={{ width:10, height:10, borderRadius:"50%", background:pendingConfs.length>0?c.orange:c.dim, animation:pendingConfs.length>0?"pulse 2s infinite":"none" }} />
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22 }}>Live Calls</div>
                    <span style={{ fontSize:12, color:c.sub }}>awaiting watcher confirmation</span>
                    {pendingConfs.length===0 && <span style={{ fontSize:12, color:c.dim }}>— none</span>}
                  </div>
                  {pendingConfs.length===0 ? (
                    <div style={{ background:c.card, border:`1px dashed ${c.border}`, borderRadius:14, padding:"24px 20px", textAlign:"center", color:c.sub, fontSize:13, marginBottom:20 }}>No calls awaiting confirmation.</div>
                  ) : (
                    <div style={{ marginBottom:20 }}>{pendingConfs.map(conf=>renderCallCard(conf,true))}</div>
                  )}
                  {doneConfs.length > 0 && (
                    <>
                      <button
                        onClick={()=>setShowCallHistory(h=>!h)}
                        style={{ width:"100%", background:c.card, border:`1px solid ${c.border}`, borderRadius:14, padding:"14px 20px", display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer", fontFamily:"'Plus Jakarta Sans',sans-serif", marginBottom:showCallHistory?10:0 }}
                        onMouseEnter={e=>e.currentTarget.style.borderColor=c.gold}
                        onMouseLeave={e=>e.currentTarget.style.borderColor=c.border}
                      >
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <span style={{ fontSize:18 }}>📂</span>
                          <div style={{ textAlign:"left" }}>
                            <div style={{ fontWeight:600, color:c.text, fontSize:14 }}>Completed Calls</div>
                            <div style={{ fontSize:11, color:c.sub }}>{doneConfs.length} call{doneConfs.length!==1?"s":""}</div>
                          </div>
                        </div>
                        <span style={{ color:c.sub, fontSize:16 }}>{showCallHistory?"▲":"▼"}</span>
                      </button>
                      {showCallHistory && <div className="fu">{doneConfs.map(conf=>renderCallCard(conf,false))}</div>}
                    </>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {tab==="refunds" && (
          <div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, marginBottom:18 }}>Refund Requests</div>
            {refundReqs.length===0 && (
              <div style={{ color:c.sub, textAlign:"center", padding:"40px 0" }}>No refund requests.</div>
            )}
            {refundReqs.map(r=>{
              const pay = payments.find(p=>p.id===r.payment_id);
              const host = users.find(u=>u.id===pay?.target_user_id);
              const isDispute = r.reason?.toLowerCase().includes("call did not") || r.reason?.toLowerCase().includes("dispute") || r.refund_type==="dispute";
              const isPending = r.status==="pending" || r.status==="pending_host";
              const isApproved = r.status==="approved";
              const isDenied = r.status==="denied";
              return (
                <div key={r.id} style={{
                  background:c.card,
                  border:`1px solid ${isDispute?c.red:isPending?c.orange:isApproved?c.green:c.border}`,
                  borderRadius:14, padding:20, marginBottom:12
                }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:10, marginBottom:10 }}>
                    <div>
                      {isDispute && (
                        <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:`${c.red}15`, border:`1px solid ${c.red}40`, borderRadius:20, padding:"3px 10px", marginBottom:8 }}>
                          <span style={{ fontSize:12 }}>⚠️</span>
                          <span style={{ fontSize:11, fontWeight:700, color:c.red, letterSpacing:.5 }}>DISPUTED CALL</span>
                        </div>
                      )}
                      <div style={{ fontWeight:600, fontSize:15 }}>
                        {r.watcher_name} → {host?.name||"Host"}
                      </div>
                      <div style={{ fontSize:12, color:c.sub, marginTop:2 }}>
                        {r.refund_type||"Manual"} · {new Date(r.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24, color:c.goldL, fontWeight:600 }}>
                        {S}{r.refund_amount||pay?.total_charged||0}
                      </div>
                      <div style={{ fontSize:11, fontWeight:700, marginTop:4, color:isPending?c.orange:isApproved?c.green:isDenied?c.red:c.sub }}>
                        {isPending?"⏳ Awaiting Review":isApproved?"✅ Refund Approved":isDenied?"❌ Denied":"—"}
                      </div>
                    </div>
                  </div>
                  <div style={{ padding:"10px 14px", background:isDispute?`${c.red}10`:c.surface, border:`1px solid ${isDispute?c.red+"30":c.border}`, borderRadius:8, marginBottom:12, fontSize:13, color:isDispute?c.text:c.sub }}>
                    {isDispute && <span style={{ fontWeight:600, color:c.red }}>Watcher says: </span>}
                    {r.reason}
                  </div>
                  {pay && (
                    <div style={{ display:"flex", gap:16, flexWrap:"wrap", fontSize:12, color:c.sub, marginBottom:12, padding:"8px 12px", background:c.surface, borderRadius:8 }}>
                      <span>Payment: <strong style={{ color:c.text }}>{S}{pay.total_charged||pay.amount}</strong></span>
                      <span>Status: <strong style={{ color:c.text }}>{pay.status}</strong></span>
                      <span>Ref: <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11 }}>{pay.paystack_ref}</span></span>
                    </div>
                  )}
                  {isPending && (
                    <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                      <Btn small variant="green" onClick={()=>onApproveRefund(r.id)}>✅ Approve & Refund</Btn>
                      <Btn small variant="red" onClick={()=>onDenyRefund(r.id)}>❌ Deny Refund</Btn>
                    </div>
                  )}
                  {isApproved && <div style={{ fontSize:12, color:c.green, fontWeight:600 }}>💸 Refund processed — funds returned to watcher</div>}
                  {isDenied && <div style={{ fontSize:12, color:c.red }}>❌ Refund denied — payment remains with host</div>}
                </div>
              );
            })}
          </div>
        )}

        {tab==="reports" && (
          <div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, marginBottom:18 }}>User Reports</div>
            {reports.length===0 && (
              <div style={{ color:c.sub, textAlign:"center", padding:"40px 0" }}>
                No reports yet.<br/>
                <span style={{ fontSize:12, color:c.dim }}>Reports submitted by users will appear here.</span>
              </div>
            )}
            {reports.map(r=>{
              const reported = users.find(u=>u.id===r.reported_user_id);
              const reporter = users.find(u=>u.id===r.reporter_id);
              const reportedName = reported?.name || r.reported_username || "Unknown user";
              const reporterName = reporter?.name || "Anonymous";
              return (
                <div key={r.id} style={{ background:c.card, border:`1px solid ${r.status==="pending"?c.orange:c.border}`, borderRadius:14, padding:20, marginBottom:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:10, marginBottom:12 }}>
                    <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                      <Avatar user={reported||{avatar:reportedName[0]}} size={44} />
                      <div>
                        <div style={{ fontWeight:600 }}>Reported: <span style={{ color:c.goldL }}>{reportedName}</span> <span style={{ color:c.sub, fontSize:12 }}>({reported?.role||"user"})</span></div>
                        <div style={{ fontSize:12, color:c.sub, display:"flex", alignItems:"center", gap:6, marginTop:2 }}>
                          <Avatar user={reporter||{avatar:reporterName[0]}} size={18} />
                          By: {reporterName}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <Chip label={r.reason} color={c.orange} />
                      <div style={{ fontSize:11, color:c.dim, marginTop:4 }}>{new Date(r.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                  {r.details && (
                    <div style={{ padding:"10px 14px", background:c.surface, borderRadius:8, marginBottom:12, fontSize:13, color:c.sub }}>{r.details}</div>
                  )}
                  <div style={{ fontSize:12, fontWeight:600 }}>
                    {r.refund_type==="dispute" || r.reason?.toLowerCase().includes("dispute") || r.reason?.toLowerCase().includes("call did not")
                      ? <span style={{ color:c.red }}>⚠️ Disputed — watcher says call didn't happen</span>
                      : null}
                    <span style={{ color:r.status==="pending"||r.status==="pending_host"?c.orange:r.status==="approved"?c.green:c.red, marginLeft:4 }}>
                      {r.status==="pending"||r.status==="pending_host"?"⏳ Awaiting review":r.status==="approved"?"✅ Approved":"❌ Denied"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab==="users" && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:14 }}>
            {users.map(u=>(
              <div key={u.id} style={{ background:c.card, border:`1px solid ${c.border}`, borderRadius:14, padding:20 }}>
                <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:12 }}>
                  <Avatar user={u} size={44} />
                  <div><div style={{ fontWeight:600 }}>{u.name}</div><div style={{ color:c.sub, fontSize:11 }}>{u.role}</div></div>
                  <OnlineDot on={u.online} />
                </div>
                <div style={{ color:c.sub, fontSize:12 }}>Rate: {S}{u.rate||0} | Payout: {u.paystackRecipientCode?"✓":"⚠"}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TermsView({ onAccept, onDecline, setView }) {
  return (
    <Modal title="Terms & Conditions" wide onClose={() => onDecline()}>
      <div style={{ maxHeight: "60vh", overflowY: "auto", paddingRight: 8, fontSize: 13, color: c.sub, lineHeight: 1.8 }}>
        <p style={{ color: c.text, fontWeight: 600, marginBottom: 12 }}>Last updated: 2026-05-03</p>
        <h4 style={{ color: c.goldL, marginBottom: 8 }}>1. Acceptance of Terms</h4>
        <p style={{ marginBottom: 16 }}>By creating an account on ConnectCall, you agree to be bound by these Terms & Conditions. If you do not agree, do not use the platform.</p>
        <h4 style={{ color: c.goldL, marginBottom: 8 }}>2. Platform Role</h4>
        <p style={{ marginBottom: 16 }}>ConnectCall is an escrow and connection platform only. We facilitate payments between watchers (clients) and hosts (consultants). We are not responsible for the content, quality, or outcome of any consultation or call.</p>
        <h4 style={{ color: c.goldL, marginBottom: 8 }}>3. Payments & Escrow</h4>
        <p style={{ marginBottom: 16 }}>All payments are processed securely through Paystack. Funds are held in escrow until the call is confirmed complete by the watcher. Platform fees (20%) are added to the host's rate and displayed before payment. Hosts receive their full stated rate after call confirmation.</p>
        <h4 style={{ color: c.goldL, marginBottom: 8 }}>4. Refunds</h4>
        <p style={{ marginBottom: 8 }}><strong>Before host contact is revealed:</strong> Watchers receive a 70% automatic refund upon cancellation. 30% is retained as a cancellation fee.</p>
        <p style={{ marginBottom: 16 }}><strong>After host contact is revealed:</strong> Refunds require host approval or admin review. Full refunds are issued if the host fails to provide the service.</p>
        <h4 style={{ color: c.goldL, marginBottom: 8 }}>5. Host Responsibilities</h4>
        <p style={{ marginBottom: 16 }}>Hosts must: (a) Provide accurate profile information, (b) Be available for scheduled calls, (c) Conduct themselves professionally, (d) Have a valid MoMo number for payouts. Hosts who repeatedly fail to appear will be removed.</p>
        <h4 style={{ color: c.goldL, marginBottom: 8 }}>6. Watcher Responsibilities</h4>
        <p style={{ marginBottom: 16 }}>Watchers must: (a) Provide accurate contact information, (b) Confirm call completion honestly, (c) Not misuse the refund system. False disputes may result in account suspension.</p>
        <h4 style={{ color: c.goldL, marginBottom: 8 }}>7. Prohibited Conduct</h4>
        <p style={{ marginBottom: 16 }}>Illegal activities, harassment, hate speech, fraud, sharing others' contact info without consent, and any violation of Ghanaian law are strictly prohibited and will result in immediate account termination.</p>
        <h4 style={{ color: c.goldL, marginBottom: 8 }}>8. Privacy</h4>
        <p style={{ marginBottom: 16 }}>Host contact information is only revealed to watchers after payment is verified. Payout details (MoMo numbers) are NEVER shared with watchers. We do not sell or share your data with third parties except as required for payment processing via Paystack.</p>
        <h4 style={{ color: c.goldL, marginBottom: 8 }}>9. Limitation of Liability</h4>
        <p style={{ marginBottom: 16 }}>ConnectCall is not liable for disputes between users, quality of consultations, technical issues during calls, or Paystack processing delays. Our maximum liability is limited to the platform fee charged on the disputed transaction.</p>
        <h4 style={{ color: c.goldL, marginBottom: 8 }}>10. Account Termination</h4>
        <p style={{ marginBottom: 16 }}>We reserve the right to suspend or terminate accounts for violation of these terms, with or without notice. Users may delete their accounts at any time through their dashboard.</p>
        <h4 style={{ color: c.goldL, marginBottom: 8 }}>11. Changes to Terms</h4>
        <p style={{ marginBottom: 16 }}>We may update these terms at any time. Continued use of the platform after changes constitutes acceptance of the new terms.</p>
        <h4 style={{ color: c.goldL, marginBottom: 8 }}>12. Contact</h4>
        <p style={{ marginBottom: 20 }}>For questions or disputes, contact us through the report feature on the platform.</p>
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 20, paddingTop: 16, borderTop: `1px solid ${c.border}` }}>
        <Btn variant="red" onClick={() => onDecline()} small>Decline</Btn>
        <Btn onClick={() => onAccept()} full>I Accept</Btn>
      </div>
    </Modal>
  );
}

function ProfileView({ host, setView, currentUser, onInitiatePayment, toast }) {
  const [watcherContact, setWatcherContact] = useState('');
  const [watcherPlatform, setWatcherPlatform] = useState('WhatsApp');
  const [paying, setPaying] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const allPhotos = [host.profilePhoto, ...safeArr(host.photos)].filter(Boolean);
  const [idx, setIdx] = useState(0);
  const isBlurred = !currentUser;
  const FEE_PCT = 20;
  const feePreview = parseFloat((host.rate * FEE_PCT / 100).toFixed(2));
  const totalPreview = host.rate + feePreview;
  const shareLink = `${window.location.origin}/?host=${encodeURIComponent(host.name)}`;
  const copyLink = () => { navigator.clipboard.writeText(shareLink); toast('Link copied! 📋'); };
  const handlePay = async () => {
    if (!currentUser) { toast('Please sign in first', 'error'); setView('login'); return; }
    if (!watcherContact || watcherContact.length !== 10) { toast('Enter valid 10-digit number', 'error'); return; }
    setPaying(true);
    await onInitiatePayment(host, { watcherName: currentUser.name, watcherContact, watcherPlatform });
    setPaying(false);
  };
  return (
    <div style={{ minHeight:'calc(100vh - 60px)', maxWidth:600, margin:'0 auto', padding:'32px 24px' }}>
      <button onClick={()=>setView('browse')} style={{ background:'none', border:'none', color:c.gold, cursor:'pointer', marginBottom:20, fontSize:13 }}>← Back to Browse</button>
      <div style={{ position:'relative', width:'100%', aspectRatio:'4/3', borderRadius:16, overflow:'hidden', marginBottom:20, background:c.surface }}>
        {allPhotos.length > 0
          ? <img src={allPhotos[idx]} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', filter:isBlurred?"blur(12px) brightness(0.6)":"none", transform:isBlurred?"scale(1.05)":"none" }} />
          : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Cormorant Garamond',serif", fontSize:72, color:c.gold, opacity:.3 }}>{host.avatar}</div>
        }
        {isBlurred && (
          <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, zIndex:3 }}>
            <div style={{ fontSize:36 }}>🔐</div>
            <div style={{ color:'#fff', fontWeight:600, fontSize:15, textAlign:'center', lineHeight:1.5 }}>Sign up to view<br/>full profile</div>
            <Btn small onClick={()=>setView('signup')} style={{ marginTop:4 }}>Sign Up Free →</Btn>
          </div>
        )}
        <div style={{ position:'absolute', bottom:0, left:0, right:0, height:80, background:'linear-gradient(to top,#000000cc,transparent)' }} />
        <div style={{ position:'absolute', top:12, right:12, display:'flex', alignItems:'center', gap:5, background:'#0a0a0f99', padding:'4px 10px', borderRadius:20 }}>
          <OnlineDot on={host.online} />
          <span style={{ fontSize:11, color:host.online?c.green:c.dim }}>{host.online?'Live':'Offline'}</span>
        </div>
        {!isBlurred && allPhotos.length > 1 && (
          <>
            <button onClick={()=>setIdx(p=>(p-1+allPhotos.length)%allPhotos.length)} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', background:'#0a0a0faa', border:'none', color:c.text, width:32, height:32, borderRadius:'50%', cursor:'pointer', fontSize:18 }}>‹</button>
            <button onClick={()=>setIdx(p=>(p+1)%allPhotos.length)} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'#0a0a0faa', border:'none', color:c.text, width:32, height:32, borderRadius:'50%', cursor:'pointer', fontSize:18 }}>›</button>
          </>
        )}
      </div>
      <div style={{ marginBottom:24 }}>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:32, fontWeight:600, marginBottom:4 }}>{host.name}</div>
        <div style={{ color:c.sub, fontSize:14, marginBottom:12 }}>{isBlurred ? "Sign up to read full bio" : host.bio}</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
          {isBlurred ? [1,2,3].map(i=><Chip key={i} label="••••" />) : safeArr(host.tags).map(t=><Chip key={t} label={t}/>)}
        </div>
        <div style={{ color:c.sub, fontSize:13 }}>via {host.platform}</div>
      </div>
      <div style={{ background:c.card, border:`1px solid ${c.border}`, borderRadius:14, padding:20, marginBottom:20, textAlign:'center' }}>
        <div style={{ color:c.sub, fontSize:12, marginBottom:4 }}>Consultation Fee</div>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:42, color:isBlurred?c.sub:c.goldL, fontWeight:600 }}>
          {isBlurred ? "₵ ••" : `${S}${host.rate}`}
        </div>
        <div style={{ color:c.dim, fontSize:11, marginTop:2 }}>per call via {host.platform}</div>
      </div>
      {isBlurred ? (
        <div style={{ display:'flex', gap:10, marginBottom:20, flexDirection:'column' }}>
          <Btn onClick={()=>setView('signup')} full>Sign Up to Connect →</Btn>
          <Btn variant="ghost" onClick={()=>setView('login')} full>Already have an account? Sign In</Btn>
        </div>
      ) : (
        <>
          <div style={{ display:'flex', gap:10, marginBottom:20 }}>
            <Btn onClick={()=>setShowPay(!showPay)} style={{ flex:1 }}>{showPay ? 'Cancel' : 'Connect Now ✦'}</Btn>
            <Btn variant="ghost" onClick={copyLink} small style={{ flex:0 }}>📋 Share</Btn>
          </div>
          {showPay && (
            <div className="fu" style={{ background:c.card, border:`1px solid ${c.border}`, borderRadius:14, padding:20, marginBottom:20 }}>
              <div style={{ fontWeight:600, marginBottom:14 }}>Enter Your Details</div>
              <div style={{ background:`${c.gold}12`, borderRadius:10, padding:12, marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ color:c.sub, fontSize:13 }}>Total ({FEE_PCT}% platform fee included)</span>
                <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24, color:c.goldL, fontWeight:600 }}>{S}{totalPreview.toFixed(2)}</span>
              </div>
              <Field label="Your Contact Number" value={watcherContact} onChange={setWatcherContact} type="tel" maxLength={10} placeholder="10-digit number" />
              <Field label="Platform" value={watcherPlatform} onChange={setWatcherPlatform} options={['WhatsApp','Telegram']} />
              {!paying
                ? <Btn onClick={handlePay} full>Pay {S}{totalPreview.toFixed(2)} Securely →</Btn>
                : <div style={{ textAlign:'center', padding:16 }}><Spinner /></div>
              }
            </div>
          )}
        </>
      )}
    </div>
  );
}