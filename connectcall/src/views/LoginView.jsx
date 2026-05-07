import { useState } from "react";
import { API_BASE, c } from "../constants";
import { Btn, Field } from "../components/UI";

export function LoginView({ onLogin, setView }) {
  const [name, setName]       = useState(() => localStorage.getItem("rememberedName") || "");
  const [pass, setPass]       = useState(() => localStorage.getItem("rememberedPass") || "");
  const [remember, setRemember] = useState(() => !!localStorage.getItem("rememberedName"));
  const [busy, setBusy]       = useState(false);

  const submit = async () => {
    if (remember) {
      localStorage.setItem("rememberedName", name);
      localStorage.setItem("rememberedPass", pass);
    } else {
      localStorage.removeItem("rememberedName");
      localStorage.removeItem("rememberedPass");
    }
    setBusy(true);
    await onLogin(name, pass);
    setBusy(false);
  };

  return (
    <div style={{ minHeight: "calc(100vh - 60px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ maxWidth: 400, width: "100%", background: `linear-gradient(180deg,${c.card},#1a1a24)`, border: `1px solid ${c.border}`, borderRadius: 24, padding: 40, animation: "fadeUp .4s ease", boxShadow: `0 24px 60px #00000044` }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 30, color: c.goldL }}>Welcome Back</div>
        </div>
        <Field label="Your Name" value={name} onChange={setName} placeholder="Exactly as registered" />
        <Field label="Password" value={pass} onChange={setPass} type="password" placeholder="••••••••" />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} style={{ width: 16, height: 16, accentColor: c.gold }} />
          <span style={{ fontSize: 12, color: c.sub }}>Remember me</span>
        </div>
        <Btn onClick={submit} full disabled={busy} style={{ marginTop: 8 }}>{busy ? "Signing in…" : "Sign In →"}</Btn>
        <div style={{ textAlign: "center", marginTop: 14, color: c.sub, fontSize: 13 }}>
          New? <span style={{ color: c.gold, cursor: "pointer" }} onClick={() => setView("signup")}>Create a profile</span>
        </div>
        <div style={{ textAlign: "center", marginTop: 8, color: c.sub, fontSize: 13 }}>
          <span style={{ color: c.gold, cursor: "pointer" }} onClick={() => setView("forgotPassword")}>Forgot password?</span>
        </div>
      </div>
    </div>
  );
}

export function ForgotPasswordView({ setView, toast }) {
  const [step, setStep]               = useState(1);
  const [name, setName]               = useState("");
  const [contact, setContact]         = useState("");
  const [otp, setOtp]                 = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy]               = useState(false);

  const requestReset = async () => {
    if (!name.trim()) { toast("Enter your username", "error"); return; }
    if (!contact.trim() || contact.length !== 10) { toast("Enter your 10-digit contact number", "error"); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/request-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), contactNumber: contact }),
      });
      const data = await res.json();
      if (!data.success) { toast(data.error || "Request failed", "error"); return; }
      toast("OTP sent! Check your SMS ✦");
      setStep(2);
    } catch {
      toast("Network error — try again", "error");
    } finally {
      setBusy(false);
    }
  };

  const confirmReset = async () => {
    if (!otp.trim() || otp.length !== 6) { toast("Enter the 6-digit OTP", "error"); return; }
    if (!newPassword.trim()) { toast("Enter a new password", "error"); return; }
    if (newPassword.length < 6) { toast("Password must be at least 6 characters", "error"); return; }
    if (newPassword !== confirmPassword) { toast("Passwords do not match", "error"); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/confirm-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), otp: otp.trim(), newPassword }),
      });
      const data = await res.json();
      if (!data.success) { toast(data.error || "Reset failed", "error"); return; }
      toast("Password reset! Sign in with your new password ✦");
      setView("login");
    } catch {
      toast("Network error — try again", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "calc(100vh - 60px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ maxWidth: 400, width: "100%", background: `linear-gradient(180deg,${c.card},#1a1a24)`, border: `1px solid ${c.border}`, borderRadius: 24, padding: 40, animation: "fadeUp .4s ease", boxShadow: `0 24px 60px #00000044` }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔑</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, color: c.goldL }}>
            {step === 1 ? "Reset Password" : step === 2 ? "Enter OTP" : "New Password"}
          </div>
          <div style={{ color: c.sub, fontSize: 13, marginTop: 6 }}>
            {step === 1 && "Enter your username and contact number"}
            {step === 2 && "Enter the 6-digit code sent to your phone"}
            {step === 3 && "Choose a new password"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 28, justifyContent: "center" }}>
          {[1, 2, 3].map(n => (
            <div key={n} style={{ width: 28, height: 4, borderRadius: 2, background: step >= n ? c.gold : c.border, transition: "background .3s" }} />
          ))}
        </div>

        {step === 1 && (
          <>
            <Field label="Username *" value={name} onChange={setName} placeholder="Exactly as registered" />
            <Field label="Contact Number *" value={contact} onChange={setContact} type="tel" maxLength={10} hint="The number on your account" />
            <Btn onClick={requestReset} full disabled={busy} style={{ marginTop: 8 }}>
              {busy ? "Sending OTP…" : "Send Reset Code →"}
            </Btn>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ background: `${c.gold}10`, border: `1px solid ${c.gold}30`, borderRadius: 10, padding: "12px 14px", marginBottom: 18, fontSize: 12, color: c.sub, lineHeight: 1.7 }}>
              A 6-digit code was sent to <strong style={{ color: c.text }}>{contact}</strong>. It expires in 15 minutes.
            </div>
            <Field label="OTP Code *" value={otp} onChange={v => setOtp(v.replace(/\D/g, "").slice(0, 6))} placeholder="e.g. 482910" hint="6-digit code from SMS" />
            <div style={{ display: "flex", gap: 10 }}>
              <Btn variant="surface" onClick={() => setStep(1)} small>← Back</Btn>
              <Btn onClick={() => { if (otp.length === 6) { setStep(3); } else { toast("Enter the full 6-digit code", "error"); } }} full disabled={busy}>
                Verify Code →
              </Btn>
            </div>
            <div style={{ textAlign: "center", marginTop: 14 }}>
              <span style={{ color: c.sub, fontSize: 12 }}>Didn't receive it? </span>
              <span style={{ color: c.gold, fontSize: 12, cursor: "pointer" }} onClick={() => { setStep(1); setOtp(""); }}>Resend →</span>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <Field label="New Password *" value={newPassword} onChange={setNewPassword} type="password" placeholder="At least 6 characters" />
            <Field label="Confirm Password *" value={confirmPassword} onChange={setConfirmPassword} type="password" placeholder="Repeat your password" />
            <div style={{ display: "flex", gap: 10 }}>
              <Btn variant="surface" onClick={() => setStep(2)} small>← Back</Btn>
              <Btn onClick={confirmReset} full disabled={busy}>
                {busy ? "Resetting…" : "Reset Password →"}
              </Btn>
            </div>
          </>
        )}

        <div style={{ textAlign: "center", marginTop: 16, color: c.sub, fontSize: 13 }}>
          Remember it? <span style={{ color: c.gold, cursor: "pointer" }} onClick={() => setView("login")}>Sign in</span>
        </div>
      </div>
    </div>
  );
}