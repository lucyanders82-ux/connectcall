export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";
export const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN;
export const PAYOUT_PROVIDERS = ['MTN', 'Vodafone', 'AirtelTigo', 'OPay'];
export const CURRENCY = "GHS";
export const S = "₵";

export const ALL_TAGS = [
  "tarot", "career", "love", "wellness", "spiritual",
  "meditation", "coaching", "finance", "fitness", "yoga",
  "astrology", "therapy",
];

// ── ConnectCall design system — premium dark, warm, romantic ─────────────────
export const c = {
  // Surfaces — deep plum-black, warm not cold
  bg:      "#0d0a12",
  surface: "#141020",
  card:    "#1c1728",
  border:  "#ffffff0e",

  // Primary accent — amber-rose (warm, intimate, not aggressive)
  gold:    "#e8856a",
  goldL:   "#f4a088",
  goldD:   "#e8856a18",

  // Text — cream white, warm grey
  text:    "#f2ede8",
  sub:     "#8a8090",
  dim:     "#4a4258",

  // Semantic
  green:   "#5dbf8a",       // warm sage — success, online, confirmed
  red:     "#d95f6b",       // muted rose-red — errors, refunds
  blue:    "#7eb8d4",       // soft steel blue — info, links
  orange:  "#e8956a",       // warm amber — warnings, pending
  purple:  "#a393c8",       // dusty lavender — secondary accent
  pink:    "#c97fa8",       // muted mauve — tags, decorative
  rose:    "#f4a088",       // soft coral — hover states

  // Gradients
  gradWarm:  "linear-gradient(135deg, #e8856a 0%, #c97fa8 100%)",
  gradCool:  "linear-gradient(135deg, #a393c8 0%, #7eb8d4 100%)",
  gradDeep:  "linear-gradient(180deg, #1c1728 0%, #0d0a12 100%)",
};

export const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Montserrat:wght@400;500;600;700&family=DM+Mono:wght@400&display=swap');

  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

  body{
    background:${c.bg};
    color:${c.text};
    font-family:'Montserrat',sans-serif;
    min-height:100vh;
    overflow-x:hidden;
    -webkit-font-smoothing:antialiased;
  }

  /* Scrollbar — subtle warm accent */
  ::-webkit-scrollbar{width:4px}
  ::-webkit-scrollbar-track{background:${c.bg}}
  ::-webkit-scrollbar-thumb{background:${c.gold};border-radius:2px}

  /* Headings — Cormorant for romance, weight for presence */
  h1,h2,h3{
    font-family:'Cormorant Garamond',serif;
    letter-spacing:-0.01em;
    font-weight:600;
    color:${c.text};
  }

  /* UI labels, buttons, nav — Montserrat */
  button,input,select,textarea,label{
    font-family:'Montserrat',sans-serif;
  }

  button{font-weight:600;letter-spacing:0.01em}
  button:hover{opacity:.88}

  /* Focus ring — warm accent */
  input:focus,select:focus,textarea:focus{
    border-color:${c.gold}!important;
    outline:none;
    box-shadow:0 0 0 3px ${c.gold}22
  }

  /* Animations */
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes fadeOut{to{opacity:0;transform:translateY(-8px)}}
  @keyframes pulse{0%,100%{box-shadow:0 0 0 0 ${c.green}44}70%{box-shadow:0 0 8px transparent}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes glow{0%,100%{box-shadow:0 0 24px ${c.gold}20}50%{box-shadow:0 0 48px ${c.gold}45}}
  @keyframes slideIn{from{transform:translateX(110%);opacity:0}to{transform:translateX(0);opacity:1}}
  @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
  @keyframes petalFall{0%{transform:translateY(-10vh) rotate(0deg);opacity:1}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}
  @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
  @keyframes borderGlow{0%,100%{border-color:${c.gold}30}50%{border-color:${c.gold}90}}
  @keyframes warmPulse{0%,100%{opacity:.7}50%{opacity:1}}

  /* Utility classes */
  .fu{animation:fadeUp .4s ease forwards}
  .fi{animation:fadeIn .6s ease forwards}
  .glow{animation:glow 4s ease-in-out infinite}
  .float{animation:float 5s ease-in-out infinite}
  .shimmer{
    background:linear-gradient(90deg,transparent,${c.gold}18,transparent);
    background-size:200% 100%;
    animation:shimmer 2.4s infinite
  }

  /* Gradient text utilities */
  .grad-warm{
    background:${c.gradWarm};
    -webkit-background-clip:text;
    -webkit-text-fill-color:transparent;
    background-clip:text;
  }
  .grad-cool{
    background:${c.gradCool};
    -webkit-background-clip:text;
    -webkit-text-fill-color:transparent;
    background-clip:text;
  }

  /* Card base — warm dark surface */
  .card-base{
    background:${c.card};
    border:1px solid ${c.border};
    border-radius:16px;
  }

  /* Pill / tag base */
  .pill-base{
    display:inline-block;
    padding:3px 12px;
    border-radius:20px;
    font-size:11px;
    font-weight:600;
    font-family:'Montserrat',sans-serif;
    letter-spacing:0.02em;
  }
`;