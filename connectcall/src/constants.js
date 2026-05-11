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

// ── Badoo-inspired design system ─────────────────────────────────────────────
// Dark app surfaces + Badoo's bold red/gradient palette + Montserrat typography
export const c = {
  // Surfaces — slightly warmer dark than before
  bg:      "#0d0b10",
  surface: "#131118",
  card:    "#1a1720",
  border:  "#ffffff10",

  // Badoo primary — bold red
  gold:    "#D70005",       // replaces gold — now Badoo red (primary CTA)
  goldL:   "#ff3b40",       // lighter red for text on dark
  goldD:   "#D7000520",     // red tint background

  // Text
  text:    "#f5f4f8",
  sub:     "#9896a4",
  dim:     "#4a4758",

  // Badoo accent gradients (use as background on pills/buttons)
  gradMatch:   "linear-gradient(90deg, #B4005A 0%, #F07800 59.9%, #FAB900 96.35%)",
  gradPremium: "linear-gradient(90deg, #00AAFF 0%, #00C882 100%)",

  // Semantic colors — Badoo palette
  green:   "#00C882",       // Badoo online/success green
  red:     "#D70005",       // Badoo primary red
  blue:    "#00AAFF",       // Badoo cyan-blue
  orange:  "#F07800",       // Badoo secondary orange
  purple:  "#8C2C94",       // Badoo purple
  pink:    "#B4005A",       // Badoo pink
  rose:    "#FF96C3",       // Badoo light pink decoration
};

export const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&family=DM+Mono:wght@400&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

  body{
    background:${c.bg};
    color:${c.text};
    font-family:'Montserrat',sans-serif;
    min-height:100vh;
    overflow-x:hidden;
    -webkit-font-smoothing:antialiased;
  }

  /* Scrollbar */
  ::-webkit-scrollbar{width:4px}
  ::-webkit-scrollbar-track{background:${c.bg}}
  ::-webkit-scrollbar-thumb{background:${c.gold};border-radius:2px}

  /* Animations */
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes fadeOut{to{opacity:0;transform:translateY(-8px)}}
  @keyframes pulse{0%,100%{box-shadow:0 0 0 0 ${c.green}44}70%{box-shadow:0 0 8px transparent}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes glow{0%,100%{box-shadow:0 0 20px ${c.gold}25}50%{box-shadow:0 0 40px ${c.gold}55}}
  @keyframes slideIn{from{transform:translateX(110%);opacity:0}to{transform:translateX(0);opacity:1}}
  @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
  @keyframes petalFall{0%{transform:translateY(-10vh) rotate(0deg);opacity:1}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}
  @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
  @keyframes borderGlow{0%,100%{border-color:${c.gold}40}50%{border-color:${c.gold}}}
  @keyframes gradShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}

  /* Utility classes */
  .fu{animation:fadeUp .4s ease forwards}
  .fi{animation:fadeIn .6s ease forwards}
  .glow{animation:glow 3s ease-in-out infinite}
  .float{animation:float 4s ease-in-out infinite}
  .shimmer{background:linear-gradient(90deg,transparent,${c.gold}20,transparent);background-size:200% 100%;animation:shimmer 2s infinite}

  /* Focus ring — Badoo cyan */
  input:focus,select:focus,textarea:focus{
    border-color:${c.blue}!important;
    outline:none;
    box-shadow:0 0 0 3px ${c.blue}25
  }

  /* Buttons — Montserrat pill style matching Badoo */
  button{
    font-family:'Montserrat',sans-serif;
    font-weight:600;
    letter-spacing:0.01em;
  }
  button:hover{opacity:.88}

  /* Headings — Montserrat heavy */
  h1,h2,h3,h4{
    font-family:'Montserrat',sans-serif;
    letter-spacing:-0.02em;
    font-weight:700;
  }

  /* Gradient text utility */
  .grad-match{
    background:${c.gradMatch};
    -webkit-background-clip:text;
    -webkit-text-fill-color:transparent;
    background-clip:text;
  }
  .grad-premium{
    background:${c.gradPremium};
    -webkit-background-clip:text;
    -webkit-text-fill-color:transparent;
    background-clip:text;
  }
`;