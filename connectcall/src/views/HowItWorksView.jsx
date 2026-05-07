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

  const rules = [
    {
      icon: "⏱",
      title: "The 3-Minute Contact Window",
      desc: "Once a host's contact is revealed, they have 3 minutes to reach out to you. If the host doesn't contact you within this window, you can claim a refund.",
    },
    {
      icon: "↩",
      title: "If the Host Doesn't Call",
      desc: "If the host never contacts you and never marks the call as done, you get an automatic 70% refund. The host is notified and can request a follow-up call if they missed the window.",
    },
    {
      icon: "⚡",
      title: "If the Host Claims They Called (Dispute)",
      desc: "If the host marks the call as complete but you never received a call, a dispute is opened. Both sides upload screenshots of their call logs as evidence. Our system reviews the evidence and resolves the dispute — if the evidence is clear, it's automatic. If not, an admin reviews it.",
    },
    {
      icon: "📱",
      title: "Evidence You'll Need",
      desc: "Take a screenshot of your phone's call log (WhatsApp or Telegram). Hosts must show an outgoing call with duration. Watchers must show no incoming call from the host's number during the booked window. Edited or cropped screenshots will be rejected.",
    },
    {
      icon: "🔄",
      title: "Follow-Up Calls",
      desc: "If a host misses the 3-minute window, they can request a follow-up. You'll be notified and can accept to reveal their contact again, or decline to finalize your refund.",
    },
    {
      icon: "🛡",
      title: "Refund Policy",
      desc: "Early cancellations (before contact is revealed) and no-contact claims receive a 70% refund. Disputes are resolved based on evidence. Our platform fee covers escrow protection, admin review, and secure payments.",
    },
  ];

  return (
    <div style={{ minHeight: "100vh", position: "relative" }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "20%", right: "20%", width: 400, height: 400, borderRadius: "50%", background: `radial-gradient(circle,${c.gold}06 0%,transparent 70%)` }} />
      </div>
      <div style={{ position: "relative", zIndex: 1, maxWidth: 800, margin: "0 auto", padding: "60px 24px" }}>

        {/* Title */}
        <div className="fu" style={{ textAlign: "center", marginBottom: 50 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 42, fontWeight: 600, color: c.goldL, marginBottom: 10 }}>How It Works</div>
          <div style={{ color: c.sub, fontSize: 15, maxWidth: 500, margin: "0 auto", lineHeight: 1.7 }}>
            A secure, admin-controlled escrow flow that protects both consultants and clients.
          </div>
        </div>

        {/* Steps */}
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

        {/* ── Disputes & Refunds Section ── */}
        <div className="fu" style={{ marginTop: 48, textAlign: "center" }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 32, fontWeight: 600, color: c.goldL, marginBottom: 8 }}>Disputes & Refunds</div>
          <div style={{ color: c.sub, fontSize: 14, maxWidth: 520, margin: "0 auto 32px", lineHeight: 1.7 }}>
            Here's exactly what happens if something goes wrong — so both sides know what to expect.
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {rules.map((r, i) => (
            <div key={i} className="fu" style={{
              animationDelay: `${i * 0.08}s`,
              background: `linear-gradient(135deg,${c.card},#1a1a24)`,
              border: `1px solid ${c.border}`,
              borderRadius: 16,
              padding: 24,
            }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{r.icon}</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 600, color: c.goldL, marginBottom: 8 }}>{r.title}</div>
              <div style={{ color: c.sub, fontSize: 12, lineHeight: 1.8 }}>{r.desc}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="fu" style={{ textAlign: "center", marginTop: 40 }}>
          <Btn onClick={() => setView("browse")}>Start Browsing →</Btn>
        </div>
      </div>
    </div>
  );
}