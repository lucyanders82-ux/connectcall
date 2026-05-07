import { useState } from "react";
import { c, PAYOUT_PROVIDERS, CURRENCY, S } from "../constants";
import { safeArr } from "../utils";
import { Btn, Field, PhotoPick, MultiPick, SectionHeader } from "../components/UI";
import { TermsView } from "./TermsView";

export function SignupView({ onSignup, setView, toast }) {
  const [mode, setMode]             = useState("watcher");
  const [step, setStep]             = useState(1);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTerms, setShowTerms]   = useState(false);
  const [busy, setBusy]             = useState(false);
  const [form, setForm]             = useState({
    name: "", bio: "", platform: "WhatsApp", contactNumber: "", rate: "", tags: "", password: "",
    profilePhoto: null, photos: [],
    payoutName: "", payoutNumber: "", payoutProvider: PAYOUT_PROVIDERS[0],
  });
  const set = k => v => setForm(x => ({ ...x, [k]: v }));

  const submitWatcher = async () => {
    if (!form.name.trim())     { toast("Username is required", "error"); return; }
    if (!form.password.trim()) { toast("Password is required", "error"); return; }
    if (!acceptedTerms)        { toast("You must accept the Terms & Conditions", "error"); return; }
    setBusy(true);
    await onSignup({ name: form.name.trim(), password: form.password, role: "watcher", contactNumber: form.contactNumber || "" });
    setBusy(false);
  };

  const submitHost = async () => {
    if (!form.name.trim())          { toast("Name is required", "error"); return; }
    if (!form.contactNumber.trim()) { toast("Contact number is required", "error"); return; }
    if (!form.rate || isNaN(Number(form.rate))) { toast("Enter a valid rate", "error"); return; }
    if (!form.password.trim())      { toast("Set a password", "error"); return; }
    if (!form.payoutNumber.trim())  { toast("Payout number is required", "error"); return; }
    if (!form.payoutProvider)       { toast("Select your payout provider", "error"); return; }
    if (!acceptedTerms)             { toast("You must accept the Terms & Conditions", "error"); return; }
    setBusy(true);
    await onSignup({ ...form, rate: parseFloat(form.rate), tags: form.tags.split(",").map(t => t.trim()).filter(Boolean), role: "host" });
    setBusy(false);
  };

  return (
    <div style={{ minHeight: "calc(100vh - 60px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ maxWidth: 500, width: "100%", background: `linear-gradient(180deg,${c.card},#1a1a24)`, border: `1px solid ${c.border}`, borderRadius: 24, padding: 40, animation: "fadeUp .4s ease", boxShadow: `0 24px 60px #00000044` }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <Btn small variant={mode === "watcher" ? "gold" : "ghost"} onClick={() => { setMode("watcher"); setStep(1); }}>I want to book</Btn>
          <Btn small variant={mode === "host" ? "gold" : "ghost"}    onClick={() => { setMode("host");    setStep(1); }}>I want to host</Btn>
        </div>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 30, color: c.goldL }}>
            {mode === "watcher" ? "Create Account" : step === 1 ? "Public Call Profile" : "Private Payout Setup"}
          </div>
          <div style={{ color: c.sub, fontSize: 13, marginTop: 5 }}>
            {mode === "watcher" ? "Sign up to book calls" : step === 1 ? "Shown to watchers after payment" : "NEVER shared with watchers"}
          </div>
        </div>

        {/* ── Watcher signup ── */}
        {mode === "watcher" && (
          <>
            <Field label="Username *" value={form.name} onChange={set("name")} placeholder="e.g. Lucy" />
            <Field label="Contact Number" value={form.contactNumber} onChange={set("contactNumber")} type="tel" maxLength={10} hint="Optional — needed for password recovery" />
            <Field label="Password *" value={form.password} onChange={set("password")} type="password" placeholder="Enter password" />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, marginTop: 8 }}>
              <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} style={{ width: 18, height: 18, accentColor: c.gold }} />
              <span style={{ fontSize: 12, color: c.sub }}>
                I accept the <span style={{ color: c.gold, cursor: "pointer", textDecoration: "underline" }} onClick={() => setShowTerms(true)}>Terms & Conditions</span>
              </span>
            </div>
            <Btn onClick={submitWatcher} full disabled={busy || !acceptedTerms} style={{ marginTop: 10 }}>{busy ? "Creating…" : "Create Account →"}</Btn>
          </>
        )}

        {/* ── Host step 1 ── */}
        {mode === "host" && step === 1 && (
          <>
            <SectionHeader icon="📞" title="Public Call Information" subtitle="This is what watchers see after payment." />
            <PhotoPick label="Profile Photo" value={form.profilePhoto} onChange={set("profilePhoto")} circle />
            <Field label="Name *" value={form.name} onChange={set("name")} />
            <Field label="Bio" value={form.bio} onChange={set("bio")} rows={3} placeholder="Describe your expertise…" />
            <Field label="Video Platform *" value={form.platform} onChange={set("platform")} options={["WhatsApp", "Telegram"]} />
            <Field label="Contact Number / ID *" value={form.contactNumber} onChange={set("contactNumber")} maxLength={10} type="tel" hint="10-digit number. Shown to watchers after payment." />
            <Field label={`Rate per Call (${CURRENCY}) *`} value={form.rate} onChange={set("rate")} type="number" hint="You receive this full amount. Platform adds 20% on top for watchers." />
            <Field label="Tags" value={form.tags} onChange={set("tags")} placeholder="tarot, career, love, wellness" />
            <Field label="Password *" value={form.password} onChange={set("password")} type="password" />
            <MultiPick label="Gallery Photos" value={form.photos} onChange={set("photos")} max={4} />
            <Btn onClick={() => setStep(2)} full style={{ marginTop: 10 }}>Next: Payout Setup →</Btn>
          </>
        )}

        {/* ── Host step 2 ── */}
        {mode === "host" && step === 2 && (
          <>
            <SectionHeader icon="🔒" title="Private Payout Information" subtitle="NEVER shown to watchers. Used only for Paystack payouts." />
            <div style={{ background: `${c.purple}15`, border: `1px solid ${c.purple}40`, borderRadius: 10, padding: "12px 14px", marginBottom: 20, fontSize: 12, color: c.sub, lineHeight: 1.7 }}>
              <div style={{ fontWeight: 600, color: c.purple, marginBottom: 4 }}>🔐 Why we need this:</div>
              <div>• Earnings sent automatically via <strong style={{ color: c.text }}>Paystack Transfers</strong> to your MoMo</div>
              <div>• <strong style={{ color: c.orange }}>Watchers NEVER see this</strong></div>
            </div>
            <Field label="Payout Name *" value={form.payoutName} onChange={set("payoutName")} placeholder={form.name || "Your full name"} />
            <Field label="Payout Number *" value={form.payoutNumber} onChange={set("payoutNumber")} type="tel" maxLength={10} placeholder="MoMo number" />
            <Field label="Payout Provider *" value={form.payoutProvider} onChange={set("payoutProvider")} options={PAYOUT_PROVIDERS} />
            <div style={{ background: `${c.gold}10`, border: `1px solid ${c.gold}30`, borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: c.sub, fontSize: 13 }}>Your rate</span>
                <span style={{ fontWeight: 600, color: c.goldL }}>{S}{form.rate || 0}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: c.sub, fontSize: 13 }}>You receive</span>
                <span style={{ fontWeight: 700, color: c.green }}>{S}{form.rate || 0}</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} style={{ width: 18, height: 18, accentColor: c.gold }} />
              <span style={{ fontSize: 12, color: c.sub }}>
                I accept the <span style={{ color: c.gold, cursor: "pointer", textDecoration: "underline" }} onClick={() => setShowTerms(true)}>Terms & Conditions</span>
              </span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn variant="surface" onClick={() => setStep(1)} style={{ flex: 1 }}>← Back</Btn>
              <Btn onClick={submitHost} full disabled={busy || !acceptedTerms} style={{ flex: 2 }}>{busy ? "Creating…" : "Launch Profile →"}</Btn>
            </div>
          </>
        )}

        <div style={{ textAlign: "center", marginTop: 16, color: c.sub, fontSize: 13 }}>
          Already registered? <span style={{ color: c.gold, cursor: "pointer" }} onClick={() => setView("login")}>Sign in</span>
        </div>

        {showTerms && <TermsView onAccept={() => { setAcceptedTerms(true); setShowTerms(false); }} onDecline={() => setShowTerms(false)} />}
      </div>
    </div>
  );
}