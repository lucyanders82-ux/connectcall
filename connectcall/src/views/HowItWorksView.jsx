import { useState } from "react";
import { c } from "../constants";
import { Btn } from "../components/UI";

function RuleCard({ rule: r }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: `linear-gradient(135deg,${c.card},#1a1a24)`, border: `1px solid ${c.border}`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => setOpen(o => !o)}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>{r.icon}</span>
        <span style={{ fontWeight: 600, fontSize: 14, color: c.text, flex: 1 }}>{r.title}</span>
        <span style={{ fontSize: 11, color: c.sub, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: c.surface, border: `1px solid ${c.border}` }}>
          {open ? "▲ less" : "learn more ▼"}
        </span>
      </div>
      {open && (
        <div style={{ padding: "0 18px 16px", fontSize: 13, color: c.sub, lineHeight: 1.8, borderTop: `1px solid ${c.border}20` }}>
          {r.desc}
        </div>
      )}
    </div>
  );
}

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
      desc: "Once a host's contact is revealed, they have 3 minutes to reach out to you. If the host doesn't contact you within this window and never clicks the call link, you can claim a 95% refund.",
    },
    {
      icon: "↩",
      title: "If the Host Doesn't Call",
      desc: "If the host never clicks the call link within 15 minutes, you get an automatic 95% refund. If the host clicks the link but never marks the call done within 30 minutes, you get an 80% refund automatically.",
    },
    {
      icon: "✕",
      title: "If the Host Rejects Your Request",
      desc: "If the host is unable to take your call, they can reject the request directly from their dashboard. You will receive a 90% refund immediately and be notified by SMS.",
    },
    {
      icon: "⚡",
      title: "If the Host Claims They Called (Dispute)",
      desc: "If the host marks the call complete but you never received a call, a dispute is opened. Both sides upload screenshots of their call logs. Our AI reviews the evidence and resolves automatically — if confidence is high. Otherwise an admin reviews within 24 hours. Dispute refund is 85%.",
    },
    {
      icon: "📱",
      title: "Evidence You'll Need",
      desc: "Take a screenshot of your WhatsApp or Telegram call log. Hosts must show an outgoing call with duration of at least 2 minutes. Watchers must show no incoming call from the host's number. Edited or cropped screenshots will be rejected by our AI.",
    },
    {
      icon: "🔄",
      title: "Follow-Up Calls",
      desc: "If a host misses the contact window, they can request a follow-up. You'll be notified by SMS and have 10 minutes to accept — which reveals their contact again — or decline to finalize your refund.",
    },
    {
      icon: "🛡",
      title: "Refund Policy",
      desc: "Host ghosted (no link click) → 95% refund. Host clicked but no call → 80% refund. Host rejected → 90% refund. Dispute ruled your way → 85% refund. Our platform fee covers escrow protection, AI review, and secure payments.",
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
            Here's exactly what happens if something goes wrong.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rules.map((r, i) => (
            <RuleCard key={i} rule={r} />
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