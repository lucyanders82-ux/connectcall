import { c, S } from "../constants";
import { safeArr } from "../utils";
import { Btn, Chip, OnlineDot } from "../components/UI";
import { HostRating, HostResponseRate } from "../components/HostRating";

export function HomeView({ setView, users, favorites, toggleFavorite, currentUser }) {
  const allHosts = users.filter(u => u.role === "host");
  const online = allHosts.filter(u => u.online);
  return (
    <div style={{ minHeight: "100vh", position: "relative" }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "10%", left: "15%", width: 500, height: 500, borderRadius: "50%", background: `radial-gradient(circle,${c.gold}08 0%,transparent 70%)` }} />
        <div style={{ position: "absolute", bottom: "10%", right: "10%", width: 400, height: 400, borderRadius: "50%", background: `radial-gradient(circle,${c.pink}08 0%,transparent 70%)` }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", width: 600, height: 600, borderRadius: "50%", background: `radial-gradient(circle,${c.purple}05 0%,transparent 70%)`, transform: "translate(-50%,-50%)" }} />
      </div>
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", padding: "70px 40px 60px" }}>
        <div className="fu" style={{ textAlign: "center", marginBottom: 80 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(40px,7vw,72px)", fontWeight: 600, lineHeight: 1.1, marginBottom: 20, background: `linear-gradient(135deg,${c.goldL},${c.gold},${c.rose})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Guaranteed Payment.<br />Guaranteed Pleasure.<br />No Trust Issues.
          </div>
          <p style={{ color: c.sub, fontSize: 18, maxWidth: 520, margin: "0 auto 40px", lineHeight: 1.8, fontWeight: 300 }}>
            Curated consultants. Private. Secure Payment.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Btn onClick={() => setView("browse")} style={{ fontSize: 15, padding: "14px 34px" }}>Browse Consultants ✦</Btn>
            <Btn variant="ghost" onClick={() => setView("signup")} style={{ fontSize: 15, padding: "14px 34px" }}>Become a Host</Btn>
          </div>
        </div>

        <div className="fu" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, marginBottom: 70, background: c.border, borderRadius: 20, overflow: "hidden" }}>
          {[
            [`${online.length}+`, "Online Now", c.green],
            [`${allHosts.length}+`, "Consultants", c.goldL],
            ["3,000+", "Calls Completed", c.blue],
          ].map(([n, l, col]) => (
            <div key={l} style={{ background: `linear-gradient(180deg,${c.card},#1a1a24)`, padding: "20px 8px", textAlign: "center", border: `1px solid ${c.border}` }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(18px,4vw,38px)", fontWeight: 700, color: col, marginBottom: 4 }}>{n}</div>
              <div style={{ color: c.sub, fontSize: "clamp(8px,1.8vw,12px)", letterSpacing: 1 }}>{l}</div>
            </div>
          ))}
        </div>

        {online.length > 0 && (
          <div className="fu">
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 34, marginBottom: 8, color: c.goldL }}>Featured Consultants</div>
              <div style={{ color: c.sub, fontSize: 14 }}>Available now</div>
              {!currentUser && (
                <div style={{ marginTop: 10, fontSize: 13, color: c.sub }}>
                  <span style={{ color: c.gold, cursor: "pointer", textDecoration: "underline" }} onClick={() => setView("signup")}>Sign up</span> or <span style={{ color: c.gold, cursor: "pointer", textDecoration: "underline" }} onClick={() => setView("login")}>sign in</span> to see full profiles
                </div>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 20 }}>
              {online.slice(0, 9).map((u, i) => (
                <HomeHostCard key={u.id} u={u} i={i} setView={setView} favorites={favorites} toggleFavorite={toggleFavorite} currentUser={currentUser} />
              ))}
            </div>
          </div>
        )}

        <div className="fu" style={{ marginTop: 60 }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 34, marginBottom: 8, color: c.goldL }}>All Consultants</div>
            <div style={{ color: c.sub, fontSize: 14 }}>Browse our full collection</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 20 }}>
            {allHosts.map((u, i) => (
              <HomeHostCard key={u.id} u={u} i={i} setView={setView} favorites={favorites} toggleFavorite={toggleFavorite} currentUser={currentUser} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── HomeHostCard ─────────────────────────────────────────────────────────────
export function HomeHostCard({ u, i, setView, favorites, toggleFavorite, currentUser }) {
  const isFav = favorites.some(f => f.host_id === u.id && f.watcher_id === currentUser?.id);
  const isBlurred = !currentUser;
 
  return (
    <div className="fi" style={{
      animationDelay: `${i * 0.04}s`,
      background: c.card,
      border: `1px solid ${c.border}`,
      borderRadius: 20,
      overflow: "hidden",
      cursor: "pointer",
      transition: "all .35s cubic-bezier(.4,0,.2,1)",
      position: "relative",
    }}
      onClick={() => isBlurred ? setView("signup") : setView("browse")}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = `${c.gold}55`;
        e.currentTarget.style.transform = "translateY(-6px)";
        e.currentTarget.style.boxShadow = `0 24px 60px ${c.gold}10, 0 8px 24px #00000055`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = c.border;
        e.currentTarget.style.transform = "";
        e.currentTarget.style.boxShadow = "";
      }}>
 
      {/* Favorite */}
      {currentUser && (
        <button onClick={e => { e.stopPropagation(); toggleFavorite(u.id); }}
          style={{
            position: "absolute", top: 12, right: 12, zIndex: 10,
            background: "rgba(13,10,18,0.7)", backdropFilter: "blur(8px)",
            border: `1px solid ${isFav ? c.gold + "50" : "#ffffff15"}`,
            borderRadius: "50%", width: 32, height: 32,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", fontSize: 14,
            color: isFav ? c.gold : "#ffffff60",
            transition: "all .2s",
          }}>
          {isFav ? "❤️" : "♡"}
        </button>
      )}
 
      {/* Photo */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "3/4", overflow: "hidden" }}>
        {u.profilePhoto
          ? <img src={u.profilePhoto} alt="" style={{
              width: "100%", height: "100%", objectFit: "cover",
              filter: isBlurred ? "blur(6px) brightness(0.6)" : "none",
              transform: isBlurred ? "scale(1.08)" : "scale(1.02)",
              transition: "all .4s ease",
            }} />
          : <div style={{
              width: "100%", height: "100%",
              background: `linear-gradient(160deg, ${c.surface}, ${c.card})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Cormorant Garamond', serif", fontSize: 56,
              color: c.gold, opacity: .2,
            }}>{u.avatar}</div>
        }
 
        {isBlurred && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 3,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <div style={{ fontSize: 28 }}>🔐</div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 12, textAlign: "center", lineHeight: 1.5 }}>
              Sign up to view
            </div>
          </div>
        )}
 
        {/* Gradient overlay */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 130,
          background: "linear-gradient(to top, rgba(13,10,18,0.96) 0%, transparent 100%)",
        }} />
 
        {/* Online badge */}
        <div style={{
          position: "absolute", top: 12, left: 12, zIndex: 2,
          display: "flex", alignItems: "center", gap: 5,
          background: "rgba(13,10,18,0.7)", backdropFilter: "blur(6px)",
          padding: "4px 10px", borderRadius: 20,
          border: `1px solid ${u.online ? c.green + "40" : "#ffffff10"}`,
        }}>
          <OnlineDot on={u.online} />
          <span style={{ fontSize: 10, color: u.online ? c.green : "#ffffff40", fontWeight: 600 }}>
            {u.online ? "Live" : "Offline"}
          </span>
        </div>
 
        {/* Name + rate on photo */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "14px 16px", zIndex: 2 }}>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 20, fontWeight: 600, color: "#fff",
            marginBottom: 2, lineHeight: 1.1,
          }}>{u.name}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 11, color: "#ffffff50" }}>
              {`${(u.bio || "").slice(0, 28)}${(u.bio || "").length > 28 ? "…" : ""}`}
            </div>
            <div style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 20, fontWeight: 600, color: c.goldL,
            }}>
              {u.country === "Nigeria" ? "₦" : S}{u.rate}
            </div>
          </div>
        </div>
      </div>
 
      {/* Body */}
      <div style={{ padding: "12px 16px 16px" }}>
 
        {!isBlurred && (
          <div style={{ marginBottom: 10 }}>
            <HostRating hostId={u.id} />
          </div>
        )}
 
        {/* Tags */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 14 }}>
          {isBlurred
            ? [1,2].map(i => <Chip key={i} label="••••" />)
            : safeArr(u.tags).slice(0, 3).map(t => (
                <span key={t} style={{
                  padding: "3px 9px", borderRadius: 20,
                  background: `${c.gold}10`,
                  border: `1px solid ${c.gold}20`,
                  fontSize: 10, color: c.goldL, fontWeight: 500,
                }}>{t}</span>
              ))
          }
        </div>
 
        {/* CTA row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 11, color: c.dim }}>
            via <span style={{ color: c.sub }}>{u.platform || "WhatsApp"}</span>
          </div>
          <div style={{
            width: 34, height: 34, borderRadius: "50%",
            background: isBlurred ? `${c.dim}20` : c.gradWarm,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, color: isBlurred ? c.dim : "#fff",
            boxShadow: isBlurred ? "none" : `0 4px 14px ${c.gold}30`,
            transition: "all .2s",
          }}>
            {isBlurred ? "🔒" : "→"}
          </div>
        </div>
      </div>
    </div>
  );
}