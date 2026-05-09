export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";
export const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN;
export const PAYOUT_PROVIDERS = ["MTN", "VOD", "ATL"];
export const CURRENCY = "GHS";
export const S = "₵";

export const ALL_TAGS = [
  "tarot", "career", "love", "wellness", "spiritual",
  "meditation", "coaching", "finance", "fitness", "yoga",
  "astrology", "therapy",
];

export const c = {
  bg:      "#0a0a0f",
  surface: "#111118",
  card:    "#16161f",
  border:  "#ffffff12",
  gold:    "#c9a84c",
  goldL:   "#e8c97a",
  goldD:   "#c9a84c22",
  text:    "#f0ede8",
  sub:     "#8a8799",
  dim:     "#45435a",
  green:   "#3ecf8e",
  red:     "#f04444",
  blue:    "#4a9eff",
  orange:  "#f97316",
  purple:  "#a855f7",
  pink:    "#ec4899",
  rose:    "#f43f5e",
};

export const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300&family=DM+Mono:wght@400&family=Plus+Jakarta+Sans:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:${c.bg};color:${c.text};font-family:'Plus Jakarta Sans',sans-serif;min-height:100vh;overflow-x:hidden}
  ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:${c.bg}}::-webkit-scrollbar-thumb{background:${c.gold};border-radius:2px}
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes fadeOut { to { opacity: 0; transform: translateY(-8px); } }
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