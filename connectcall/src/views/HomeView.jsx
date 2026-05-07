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

export function HomeHostCard({ u, i, setView, favorites, toggleFavorite, currentUser }) {
  const isFav = favorites.some(f => f.host_id === u.id && f.watcher_id === currentUser?.id);
  const isBlurred = !currentUser;
  return (
    <div className="fu" style={{ animationDelay: `${i * 0.05}s`, background: `linear-gradient(180deg,${c.card},#1a1a24)`, border: `1px solid ${c.border}`, borderRadius: 18, overflow: "hidden", cursor: "pointer", transition: "all .3s", position: "relative" }}
      onClick={() => isBlurred ? setView("signup") : setView("browse")}
      onMouseEnter={e => { e.currentTarget.style.borderColor = c.gold; e.currentTarget.style.transform = "translateY(-4px)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.transform = ""; }}>
      {currentUser && (
        <button onClick={e => { e.stopPropagation(); toggleFavorite(u.id); }}
          style={{ position: "absolute", top: 12, right: 12, zIndex: 10, background: "#0a0a0fcc", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16, color: isFav ? c.gold : c.sub }}>
          {isFav ? "❤️" : "♡"}
        </button>
      )}
      <div style={{ position: "relative", width: "100%", aspectRatio: "1/1", overflow: "hidden" }}>
        {u.profilePhoto ? (
          <img src={u.profilePhoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: isBlurred ? "blur(4px) brightness(0.7)" : "none", transform: isBlurred ? "scale(1.05)" : "none", transition: "filter .3s" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg,${c.goldD},#1a1a2e)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cormorant Garamond',serif", fontSize: 48, color: c.gold, opacity: .3 }}>{u.avatar}</div>
        )}
        {isBlurred && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, zIndex: 3 }}>
            <div style={{ fontSize: 28 }}>🔐</div>
            <div style={{ color: "#fff", fontWeight: 600, fontSize: 13, textAlign: "center", lineHeight: 1.4 }}>Sign up to<br />view profile</div>
          </div>
        )}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 40, background: "linear-gradient(to top,#0a0a0fcc,transparent)" }} />
        <div style={{ position: "absolute", top: 10, right: 12, display: "flex", alignItems: "center", gap: 5, background: "#0a0a0f99", padding: "3px 8px", borderRadius: 20, zIndex: 2 }}>
          <OnlineDot on={u.online} />
          <span style={{ fontSize: 10, color: u.online ? c.green : c.dim }}>{u.online ? "Live" : "Offline"}</span>
        </div>
      </div>
      <div style={{ padding: "14px 16px 16px" }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{u.name}</div>
        {!isBlurred && <HostRating hostId={u.id} />}
        {!isBlurred && <HostResponseRate hostId={u.id} />}
        <div style={{ color: c.sub, fontSize: 11, marginBottom: 8 }}>
          {`${(u.bio || "").slice(0, 45)}${(u.bio || "").length > 45 ? "…" : ""}`}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
          {isBlurred
            ? [1, 2].map(i => <Chip key={i} label="••••" />)
            : safeArr(u.tags).slice(0, 3).map(t => <Chip key={t} label={t} />)
          }
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, color: c.goldL, fontWeight: 600 }}>{S}{u.rate}</div>
            <div style={{ color: c.dim, fontSize: 10 }}>via {u.platform}</div>
          </div>
          <div style={{ width: 30, height: 30, borderRadius: "50%", border: `1px solid ${isBlurred ? c.sub + "50" : c.gold + "50"}`, display: "flex", alignItems: "center", justifyContent: "center", color: isBlurred ? c.sub : c.gold, fontSize: 13 }}>
            {isBlurred ? "🔒" : "→"}
          </div>
        </div>
      </div>
    </div>
  );
}