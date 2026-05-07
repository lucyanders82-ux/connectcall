import { c } from "../constants";
import { Btn } from "../components/UI";

export function HowItWorksView({ setView }) {
  const steps = [
    { n: "1", t: "Browse",             d: "Find a consultant that matches your needs. Browse profiles, view galleries, and check availability." },
    { n: "2", t: "Connect & Pay",      d: "Click Connect, enter your contact number, and pay securely via Paystack. Funds are held in escrow." },
    { n: "3", t: "Contact Revealed",   d: "Once Paystack verifies your payment, the host's contact is revealed automatically within seconds." },
    { n: "4", t: "Call Happens",       d: "Connect with your consultant on WhatsApp or Telegram. Have your private session." },
    { n: "5", t: "Confirm & Pay Host", d: "After the call, confirm it happened and the host gets paid instantly to their MoMo via Paystack." },
  ];
  return (
    <div style={{ minHeight: "100vh", position: "relative" }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "20%", right: "20%", width: 400, height: 400, borderRadius: "50%", background: `radial-gradient(circle,${c.gold}06 0%,transparent 70%)` }} />
      </div>
      <div style={{ position: "relative", zIndex: 1, maxWidth: 800, margin: "0 auto", padding: "60px 24px" }}>
        <div className="fu" style={{ textAlign: "center", marginBottom: 50 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 42, fontWeight: 600, color: c.goldL, marginBottom: 10 }}>How It Works</div>
          <div style={{ color: c.sub, fontSize: 15, maxWidth: 500, margin: "0 auto", lineHeight: 1.7 }}>
            A secure, admin-controlled escrow flow that protects both consultants and clients.
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {steps.map((s, i) => (
            <div key={s.n} className="fu" style={{ animationDelay: `${i * 0.1}s`, background: `linear-gradient(135deg,${c.card},#1a1a24)`, border: `1px solid ${c.border}`, borderRadius: 18, padding: 28, display: "flex", gap: 20, alignItems: "flex-start" }}>
              <div style={{ minWidth: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg,${c.gold},${c.goldL})`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 700, color: "#0a0a0f", flexShrink: 0 }}>{s.n}</div>
              <div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 600, marginBottom: 6, color: c.goldL }}>{s.t}</div>
                <div style={{ color: c.sub, fontSize: 13, lineHeight: 1.7 }}>{s.d}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="fu" style={{ textAlign: "center", marginTop: 40 }}>
          <Btn onClick={() => setView("browse")}>Start Browsing →</Btn>
        </div>
      </div>
    </div>
  );
}