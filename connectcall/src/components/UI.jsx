import { useState, useRef } from "react";
import { c } from "../constants";
import { safeArr } from "../utils";

// ─── Spinner ────────────────────────────────────────────────────────────────
export function Spinner({ size = 36 }) {
  return (
    <div style={{
      width: size, height: size,
      border: `3px solid ${c.gold}30`,
      borderTopColor: c.gold,
      borderRadius: "50%",
      animation: "spin 1s linear infinite",
      flexShrink: 0,
    }} />
  );
}

// ─── SkeletonCard ────────────────────────────────────────────────────────────
export function SkeletonCard() {
  return (
    <div style={{
      background: `linear-gradient(160deg,${c.card},#1a1a24)`,
      border: `1px solid ${c.border}`,
      borderRadius: 20, overflow: "hidden",
    }}>
      <div className="shimmer" style={{ width: "100%", aspectRatio: "1/1", background: c.surface }} />
      <div style={{ padding: "16px 18px 18px" }}>
        <div className="shimmer" style={{ height: 18, width: "65%", borderRadius: 6, marginBottom: 10 }} />
        <div className="shimmer" style={{ height: 12, width: "90%", borderRadius: 4, marginBottom: 6 }} />
        <div className="shimmer" style={{ height: 12, width: "55%", borderRadius: 4, marginBottom: 14 }} />
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <div className="shimmer" style={{ height: 22, width: 56, borderRadius: 20 }} />
          <div className="shimmer" style={{ height: 22, width: 56, borderRadius: 20 }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="shimmer" style={{ height: 26, width: 64, borderRadius: 6 }} />
          <div className="shimmer" style={{ width: 32, height: 32, borderRadius: "50%" }} />
        </div>
      </div>
    </div>
  );
}

// ─── Btn ─────────────────────────────────────────────────────────────────────
export function Btn({ children, onClick, variant = "gold", small = false, disabled = false, full = false, style: s = {} }) {
  const styles = {
    gold:    { background: `linear-gradient(135deg,${c.gold},${c.goldL})`, color: "#0a0a0f", border: "none", boxShadow: `0 2px 12px ${c.gold}30` },
    ghost:   { background: "transparent", color: c.gold, border: `1px solid ${c.gold}50` },
    surface: { background: c.card, color: c.text, border: `1px solid ${c.border}` },
    green:   { background: `linear-gradient(135deg,${c.green},#2ecc71)`, color: "#0a0a0f", border: "none", boxShadow: `0 2px 10px ${c.green}30` },
    red:     { background: `linear-gradient(135deg,${c.red},#e53e3e)`, color: "#fff", border: "none", boxShadow: `0 2px 10px ${c.red}25` },
    orange:  { background: `linear-gradient(135deg,${c.orange},#ea580c)`, color: "#fff", border: "none", boxShadow: `0 2px 10px ${c.orange}25` },
    purple:  { background: `linear-gradient(135deg,${c.purple},#9333ea)`, color: "#fff", border: "none" },
    pink:    { background: `linear-gradient(135deg,${c.pink},${c.rose})`, color: "#fff", border: "none" },
    blue:    { background: `linear-gradient(135deg,${c.blue},#3b82f6)`, color: "#fff", border: "none", boxShadow: `0 2px 10px ${c.blue}25` },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
      padding: small ? "7px 15px" : "11px 26px",
      borderRadius: small ? 8 : 10,
      cursor: disabled ? "not-allowed" : "pointer",
      fontSize: small ? 12 : 14, fontWeight: 600, letterSpacing: .3,
      fontFamily: "'Plus Jakarta Sans',sans-serif",
      opacity: disabled ? .45 : 1,
      transition: "all .18s ease",
      width: full ? "100%" : "auto",
      ...styles[variant], ...s,
    }}>
      {children}
    </button>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function Modal({ children, onClose, title, wide = false, noPadding = false }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "#000000cc", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 20, backdropFilter: "blur(16px)", animation: "fadeIn .25s ease" }}
      onClick={e => e.target === e.currentTarget && onClose?.()}
    >
      <div style={{
        background: `linear-gradient(160deg,${c.card},#13131e)`,
        border: `1px solid ${c.border}`,
        borderRadius: 22, padding: noPadding ? 0 : 32,
        maxWidth: wide ? 680 : 460, width: "100%",
        animation: "fadeUp .3s ease",
        maxHeight: "92vh", overflowY: "auto",
        boxShadow: "0 40px 100px #000000bb, 0 0 0 1px #ffffff06",
      }}>
        {title && (
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 600, color: c.goldL, marginBottom: 22, padding: noPadding ? "24px 32px 0" : 0 }}>{title}</div>
        )}
        <div style={{ padding: noPadding ? "0 32px 32px" : 0 }}>{children}</div>
      </div>
    </div>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────
export function Field({ label, value, onChange, type = "text", options, placeholder, rows, hint, disabled = false, maxLength }) {
  const base = {
    width: "100%", padding: "10px 14px",
    background: `${c.surface}cc`,
    border: `1px solid ${c.border}`,
    borderRadius: 9, color: c.text, fontSize: 14,
    fontFamily: "'Plus Jakarta Sans',sans-serif",
    transition: "all .18s",
  };
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 11, letterSpacing: .8, color: c.sub, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>{label}</label>
      {options
        ? <select value={value} onChange={e => onChange(e.target.value)} style={base} disabled={disabled}>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        : rows
          ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{ ...base, resize: "vertical" }} disabled={disabled} maxLength={maxLength} />
          : <input
              type={type} value={value}
              onChange={e => {
                if (maxLength && e.target.value.length > maxLength) return;
                if (type === "tel") { const v = e.target.value.replace(/\D/g, ""); onChange(v.slice(0, maxLength || 11)); return; }
                onChange(e.target.value);
              }}
              placeholder={placeholder} style={base} disabled={disabled} maxLength={maxLength}
            />
      }
      {hint && <div style={{ fontSize: 11, color: c.dim, marginTop: 5 }}>{hint}</div>}
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
export function Toast({ toasts }) {
  return (
    <div style={{ position: "fixed", top: 18, right: 18, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none" }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: t.type === "error" ? `linear-gradient(135deg,${c.red},#dc2626)` : t.type === "info" ? `linear-gradient(135deg,${c.blue},#2563eb)` : t.type === "warning" ? `linear-gradient(135deg,${c.orange},#ea580c)` : `linear-gradient(135deg,${c.green},#16a34a)`,
          color: "#fff", padding: "11px 18px", borderRadius: 12, fontWeight: 600, fontSize: 13,
          animation: "slideIn .3s ease, fadeOut .4s ease 3.8s forwards",
          boxShadow: "0 8px 24px #00000066", maxWidth: 320,
          border: "1px solid #ffffff15",
        }}>{t.msg}</div>
      ))}
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
export function Avatar({ user, size = 48, ring = false }) {
  if (user?.profilePhoto) {
    return <img src={user.profilePhoto} alt="" style={{
      width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0,
      border: ring ? `2px solid ${c.gold}` : `1.5px solid ${c.border}`,
      boxShadow: ring ? `0 0 0 3px ${c.gold}20` : "none",
    }} />;
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: ring
        ? `linear-gradient(135deg,${c.gold},${c.goldL})`
        : `linear-gradient(135deg,#252535,#353545)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Cormorant Garamond',serif", fontSize: size * .38, fontWeight: 600,
      color: ring ? "#0a0a0f" : c.text,
      border: ring ? `2px solid ${c.gold}` : `1.5px solid ${c.border}`,
      boxShadow: ring ? `0 0 0 3px ${c.gold}15` : "none",
    }}>
      {user?.avatar || "?"}
    </div>
  );
}

// ─── Chip ─────────────────────────────────────────────────────────────────────
export function Chip({ label, color }) {
  const col = color || c.sub;
  return (
    <span style={{
      padding: "3px 11px", borderRadius: 20,
      background: `${col}12`,
      border: `1px solid ${col}30`,
      fontSize: 11, color: col, letterSpacing: .3, fontWeight: 500,
    }}>{label}</span>
  );
}

// ─── OnlineDot ────────────────────────────────────────────────────────────────
export function OnlineDot({ on }) {
  return (
    <span style={{
      display: "inline-block", width: 9, height: 9, borderRadius: "50%",
      background: on ? c.green : c.dim,
      boxShadow: on ? `0 0 6px ${c.green}80` : "none",
      animation: on ? "pulse 2s infinite" : "none",
      flexShrink: 0,
    }} />
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────
export function SectionHeader({ icon, title, subtitle }) {
  return (
    <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${c.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 19, color: c.goldL, fontWeight: 600 }}>{title}</div>
      </div>
      {subtitle && <div style={{ color: c.sub, fontSize: 12, marginLeft: 30 }}>{subtitle}</div>}
    </div>
  );
}

// ─── FolderCard — modern collapsible folder ───────────────────────────────────
export function FolderCard({ icon, title, subtitle, count, defaultOpen = false, children, accentColor }) {
  const [open, setOpen] = useState(defaultOpen);
  const col = accentColor || c.gold;
  return (
    <div style={{
      background: `linear-gradient(160deg,${c.card},#13131e)`,
      border: `1px solid ${open ? col + "30" : c.border}`,
      borderRadius: 16, overflow: "hidden",
      transition: "border-color .2s",
    }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          padding: "16px 20px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          cursor: "pointer", userSelect: "none",
          background: open ? `${col}08` : "transparent",
          transition: "background .2s",
        }}
        onMouseEnter={e => e.currentTarget.style.background = `${col}10`}
        onMouseLeave={e => e.currentTarget.style.background = open ? `${col}08` : "transparent"}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `${col}18`, border: `1px solid ${col}30`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
          }}>
            {icon}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: c.text }}>{title}</div>
            {subtitle && <div style={{ color: c.sub, fontSize: 12, marginTop: 1 }}>{subtitle}</div>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {count !== undefined && (
            <span style={{ padding: "2px 9px", borderRadius: 20, background: `${col}20`, color: col, fontSize: 11, fontWeight: 700 }}>
              {count}
            </span>
          )}
          <div style={{
            width: 26, height: 26, borderRadius: 8, border: `1px solid ${c.border}`,
            background: c.surface, display: "flex", alignItems: "center", justifyContent: "center",
            color: c.sub, fontSize: 11, transition: "transform .2s",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}>▼</div>
        </div>
      </div>
      {open && (
        <div style={{ padding: "0 14px 14px", animation: "fadeIn .2s ease" }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────
export function StatusBadge({ status }) {
  const map = {
    completed:        { label: "✅ Done",       color: c.green },
    confirmed:        { label: "🟢 Active",     color: c.gold },
    pending:          { label: "⏳ Pending",    color: "#facc15" },
    refunded:         { label: "↩ Refunded",   color: c.red },
    refunded_partial: { label: "↩ Partial",    color: c.red },
    cancelled:        { label: "⊘ Cancelled",  color: c.red },
    disputed:         { label: "⚡ Disputed",   color: c.orange },
  };
  const s = map[status] || { label: status, color: c.sub };
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
      background: `${s.color}18`, color: s.color, border: `1px solid ${s.color}30`,
    }}>
      {s.label}
    </span>
  );
}

// ─── Petals ───────────────────────────────────────────────────────────────────
export function Petals() {
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
      {[...Array(15)].map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          left: `${Math.random() * 100}%`,
          top: `-${Math.random() * 20}px`,
          fontSize: 8 + Math.random() * 16,
          opacity: 0.06 + Math.random() * 0.1,
          animation: `petalFall ${8 + Math.random() * 12}s linear infinite`,
          animationDelay: `${Math.random() * 10}s`,
          color: i % 3 === 0 ? c.goldL : i % 3 === 1 ? c.pink : c.rose,
        }}>✦</div>
      ))}
    </div>
  );
}

// ─── PhotoPick ───────────────────────────────────────────────────────────────
export function PhotoPick({ label, value, onChange, circle = false }) {
  const ref = useRef();
  const sz = circle ? 84 : 96;
  const preview = value instanceof File ? URL.createObjectURL(value) : value;
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: "block", fontSize: 11, letterSpacing: .8, color: c.sub, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>{label}</label>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        {preview && (
          <div style={{ position: "relative" }}>
            <img src={preview} alt="" style={{ width: sz, height: sz, borderRadius: circle ? "50%" : 12, objectFit: "cover", border: `2px solid ${c.gold}` }} />
            <button onClick={() => onChange(null)} style={{ position: "absolute", top: -7, right: -7, width: 22, height: 22, borderRadius: "50%", background: c.red, color: "#fff", border: "none", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px #00000044" }}>✕</button>
          </div>
        )}
        <div
          onClick={() => ref.current.click()}
          style={{ width: sz, height: sz, borderRadius: circle ? "50%" : 12, border: `2px dashed ${c.border}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", color: c.sub, fontSize: 11, gap: 5, transition: "all .18s" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = c.gold; e.currentTarget.style.color = c.goldL; e.currentTarget.style.background = `${c.gold}08`; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.color = c.sub; e.currentTarget.style.background = "transparent"; }}
        >
          <span style={{ fontSize: 24, lineHeight: 1 }}>+</span><span>Upload</span>
        </div>
        <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files[0]; if (f) onChange(f); e.target.value = ""; }} />
      </div>
    </div>
  );
}

// ─── MultiPick ───────────────────────────────────────────────────────────────
export function MultiPick({ label, value = [], onChange, max = 4 }) {
  const ref = useRef();
  const safeValue = safeArr(value);
  const previews = safeValue.map(v => v instanceof File ? URL.createObjectURL(v) : v);
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: "block", fontSize: 11, letterSpacing: .8, color: c.sub, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>{label} (up to {max})</label>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {previews.map((src, i) => (
          <div key={i} style={{ position: "relative" }}>
            <img src={src} alt="" style={{ width: 88, height: 88, borderRadius: 12, objectFit: "cover", border: `2px solid ${c.gold}40` }} />
            <button onClick={() => onChange(safeValue.filter((_, j) => j !== i))} style={{ position: "absolute", top: -7, right: -7, width: 22, height: 22, borderRadius: "50%", background: c.red, color: "#fff", border: "none", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px #00000044" }}>✕</button>
          </div>
        ))}
        {safeValue.length < max && (
          <div
            onClick={() => ref.current.click()}
            style={{ width: 88, height: 88, borderRadius: 12, border: `2px dashed ${c.border}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", color: c.sub, fontSize: 11, gap: 5, transition: "all .18s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = c.gold; e.currentTarget.style.color = c.goldL; e.currentTarget.style.background = `${c.gold}08`; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.color = c.sub; e.currentTarget.style.background = "transparent"; }}
          >
            <span style={{ fontSize: 24, lineHeight: 1 }}>+</span><span>Add</span>
          </div>
        )}
        <input ref={ref} type="file" accept="image/*" multiple style={{ display: "none" }}
          onChange={e => { const files = Array.from(e.target.files).slice(0, max - safeValue.length); onChange([...safeValue, ...files].slice(0, max)); e.target.value = ""; }} />
      </div>
    </div>
  );
}

// ─── NavBtn ───────────────────────────────────────────────────────────────────
export function NavBtn({ icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{ background: "none", border: "none", color: c.sub, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "4px 10px", fontSize: 10, fontFamily: "'Plus Jakarta Sans',sans-serif", transition: "color .18s", borderRadius: 8 }}
      onMouseEnter={e => e.currentTarget.style.color = c.goldL}
      onMouseLeave={e => e.currentTarget.style.color = c.sub}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ─── MobileMenuItem ───────────────────────────────────────────────────────────
export function MobileMenuItem({ icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{ width: "100%", padding: "12px 16px", background: "none", border: "none", color: c.text, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontSize: 14, borderRadius: 10, fontFamily: "'Plus Jakarta Sans',sans-serif", transition: "background .18s" }}
      onMouseEnter={e => e.currentTarget.style.background = c.surface}
      onMouseLeave={e => e.currentTarget.style.background = "none"}>
      {icon} {label}
    </button>
  );
}

// ─── Nav ─────────────────────────────────────────────────────────────────────
export function Nav({ setView, currentUser, isAdmin, handleLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <nav style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "14px 32px",
      borderBottom: `1px solid ${c.border}`,
      background: "#0a0a0ff0",
      position: "sticky", top: 0, zIndex: 100,
      backdropFilter: "blur(24px)",
    }}>
      <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 600, letterSpacing: 2, color: c.goldL, cursor: "pointer" }} onClick={() => setView("home")}>◈ CONNECTCALL</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }} className="desktop-nav">
        <Btn variant="ghost" small onClick={() => setView("home")}>Home</Btn>
        <Btn variant="ghost" small onClick={() => setView("browse")}>Browse</Btn>
        <Btn variant="ghost" small onClick={() => setView("howItWorks")}>How It Works</Btn>
        {currentUser && !isAdmin && (
          <>
            {(currentUser.role === "host" || currentUser.role === "watcher") && (
              <Btn variant="surface" small onClick={() => setView("dashboard")}>{currentUser.name.split(" ")[0]}'s Dashboard</Btn>
            )}
            <Btn variant="ghost" small onClick={handleLogout}>Logout</Btn>
          </>
        )}
        {isAdmin && (
          <>
            <Btn variant="ghost" small onClick={() => setView("admin")} style={{ borderColor: c.red, color: c.red }}>Admin</Btn>
            <Btn variant="ghost" small onClick={handleLogout}>Logout</Btn>
          </>
        )}
        {!currentUser && !isAdmin && (
          <>
            <Btn variant="surface" small onClick={() => setView("login")}>Sign In</Btn>
            <Btn small onClick={() => setView("signup")}>Join</Btn>
          </>
        )}
      </div>
      <button onClick={() => setMenuOpen(!menuOpen)} style={{ display: "none", background: "none", border: "none", color: c.text, fontSize: 24, cursor: "pointer" }} className="mobile-menu-btn">☰</button>
      {menuOpen && (
        <div style={{ position: "absolute", top: 64, right: 16, background: `linear-gradient(160deg,${c.card},#13131e)`, border: `1px solid ${c.border}`, borderRadius: 14, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4, zIndex: 200, minWidth: 190, boxShadow: "0 20px 50px #00000099" }}>
          <Btn variant="ghost" small full onClick={() => { setView("home"); setMenuOpen(false); }}>Home</Btn>
          <Btn variant="ghost" small full onClick={() => { setView("browse"); setMenuOpen(false); }}>Browse</Btn>
          <Btn variant="ghost" small full onClick={() => { setView("howItWorks"); setMenuOpen(false); }}>How It Works</Btn>
          {!currentUser && !isAdmin && (
            <>
              <Btn variant="surface" small full onClick={() => { setView("login"); setMenuOpen(false); }}>Sign In</Btn>
              <Btn small full onClick={() => { setView("signup"); setMenuOpen(false); }}>Join</Btn>
            </>
          )}
          {currentUser && <Btn variant="ghost" small full onClick={() => { handleLogout(); setMenuOpen(false); }}>Logout</Btn>}
        </div>
      )}
    </nav>
  );
}

// ─── MobileNav ────────────────────────────────────────────────────────────────
export function MobileNav({ setView, currentUser, isAdmin, handleLogout }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div style={{ display: "none", position: "fixed", bottom: 0, left: 0, right: 0, background: "#0a0a0ff2", borderTop: `1px solid ${c.border}`, padding: "6px 16px 12px", zIndex: 100, backdropFilter: "blur(24px)", justifyContent: "space-around", alignItems: "center" }} className="mobile-nav">
        <NavBtn icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>} label="Home" onClick={() => setView("home")} />
        <NavBtn icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>} label="Browse" onClick={() => setView("browse")} />
        {currentUser && !isAdmin && <NavBtn icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>} label="Dashboard" onClick={() => setView("dashboard")} />}
        {isAdmin && <NavBtn icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>} label="Admin" onClick={() => setView("admin")} />}
        {!currentUser && !isAdmin && <NavBtn icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>} label="Sign In" onClick={() => setView("login")} />}
        <NavBtn icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>} label="More" onClick={() => setOpen(true)} />
      </div>

      {open && (
        <div style={{ display: "none", position: "fixed", inset: 0, zIndex: 200 }} className="mobile-nav" onClick={() => setOpen(false)}>
          <div style={{ position: "absolute", bottom: 70, left: 16, right: 16, background: `linear-gradient(160deg,${c.card},#13131e)`, border: `1px solid ${c.border}`, borderRadius: 16, padding: 10 }} onClick={e => e.stopPropagation()}>
            <MobileMenuItem icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>} label="How It Works" onClick={() => { setView("howItWorks"); setOpen(false); }} />
            {!currentUser && <MobileMenuItem icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>} label="Join" onClick={() => { setView("signup"); setOpen(false); }} />}
            {currentUser && <MobileMenuItem icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>} label="Logout" onClick={() => { handleLogout(); setOpen(false); }} />}
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

// ─── FeedbackButton ───────────────────────────────────────────────────────────
export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [rating, setRating] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const reset = () => { setStep(1); setRating(null); setText(""); setSending(false); };

  const submit = async () => {
    if (!rating) return;
    setSending(true);
    try {
      await fetch(`${(typeof API_BASE !== "undefined" ? API_BASE : "")||""}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, text, ts: new Date().toISOString() }),
      });
    } catch (_) {}
    setStep(3);
    setSending(false);
    setTimeout(() => { setOpen(false); reset(); }, 2200);
  };

  const emojis = [
    { val: 1, icon: "😞", label: "Bad" },
    { val: 2, icon: "😐", label: "Okay" },
    { val: 3, icon: "🙂", label: "Good" },
    { val: 4, icon: "😊", label: "Great" },
    { val: 5, icon: "🤩", label: "Excellent" },
  ];

  return (
    <>
      <button
        onClick={() => { setOpen(o => !o); if (!open) reset(); }}
        title="Send feedback"
        style={{
          position: "fixed", bottom: 88, right: 18, zIndex: 300,
          width: 46, height: 46, borderRadius: "50%",
          background: `linear-gradient(135deg,${c.gold},${c.goldL})`,
          border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, boxShadow: `0 4px 20px ${c.gold}40, 0 2px 8px #00000044`,
          transition: "transform .2s, box-shadow .2s",
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.1)"; e.currentTarget.style.boxShadow = `0 6px 28px ${c.gold}55, 0 4px 12px #00000055`; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = `0 4px 20px ${c.gold}40, 0 2px 8px #00000044`; }}
      >
        {open ? "✕" : "💬"}
      </button>

      {open && (
        <div style={{
          position: "fixed", bottom: 148, right: 18, zIndex: 300,
          width: 290,
          background: `linear-gradient(160deg,${c.card},#13131e)`,
          border: `1px solid ${c.border}`,
          borderRadius: 18, padding: 22,
          boxShadow: "0 20px 60px #00000099, 0 0 0 1px #ffffff06",
          animation: "fadeUp .22s ease",
        }}>
          {step === 1 && (
            <>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: c.goldL, marginBottom: 4 }}>How's your experience?</div>
              <div style={{ fontSize: 12, color: c.sub, marginBottom: 18 }}>Tap a rating to continue</div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                {emojis.map(e => (
                  <button key={e.val} onClick={() => { setRating(e.val); setStep(2); }}
                    style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "6px 4px", borderRadius: 10, transition: "background .15s" }}
                    onMouseEnter={ev => ev.currentTarget.style.background = `${c.gold}12`}
                    onMouseLeave={ev => ev.currentTarget.style.background = "none"}>
                    <span style={{ fontSize: 28 }}>{e.icon}</span>
                    <span style={{ fontSize: 10, color: c.sub }}>{e.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 24 }}>{emojis.find(e => e.val === rating)?.icon}</span>
                <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, color: c.goldL }}>{emojis.find(e => e.val === rating)?.label}</span>
              </div>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Tell us more (optional)…"
                rows={3}
                style={{ width: "100%", background: `${c.surface}cc`, border: `1px solid ${c.border}`, borderRadius: 10, color: c.text, fontSize: 13, padding: "9px 12px", fontFamily: "'Plus Jakarta Sans',sans-serif", resize: "none", boxSizing: "border-box", marginBottom: 14, outline: "none" }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setStep(1)} style={{ flex: 1, background: c.surface, border: `1px solid ${c.border}`, borderRadius: 9, color: c.sub, fontSize: 12, padding: "9px", cursor: "pointer", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Back</button>
                <button onClick={submit} disabled={sending} style={{ flex: 2, background: `linear-gradient(135deg,${c.gold},${c.goldL})`, border: "none", borderRadius: 9, color: "#0a0a0f", fontSize: 12, fontWeight: 700, padding: "9px", cursor: sending ? "not-allowed" : "pointer", opacity: sending ? 0.6 : 1, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                  {sending ? "Sending…" : "Send Feedback"}
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <div style={{ textAlign: "center", padding: "14px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>✨</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: c.goldL }}>Thank you!</div>
              <div style={{ fontSize: 12, color: c.sub, marginTop: 5 }}>Your feedback helps us improve.</div>
            </div>
          )}
        </div>
      )}
    </>
  );
}