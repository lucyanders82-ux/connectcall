import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";
import { Toast, Petals, Nav, MobileNav, SkeletonCard, FeedbackButton } from "./components/UI";

// ── constants / utils / api ───────────────────────────────────────────────────
import { API_BASE, ADMIN_TOKEN, GLOBAL_CSS } from "./constants";
import { normaliseUser, uploadFile, safeArr } from "./utils";
import {
  apiInitializePayment, apiVerifyPayment, apiConfirmPayment,
  apiReleaseFunds, apiOnboardPayout, apiConfirmCall,
  apiDenyRefund, apiWatcherRefund, apiHostApproveRefund, apiAdminApproveRefund,
  apiSubmitEvidence, apiRequestFollowup, apiAcceptFollowup, apiGetDispute, apiInitiateCall,
} from "./api";

// ── views ─────────────────────────────────────────────────────────────────────
import { HomeView }             from "./views/HomeView";
import { HowItWorksView }       from "./views/HowItWorksView";
import { SignupView }            from "./views/SignupView";
import { LoginView, ForgotPasswordView } from "./views/LoginView";
import { BrowseView }           from "./views/BrowseView";
import { DashboardView }        from "./views/DashboardView";
import { WatcherDashboardView } from "./views/WatcherDashboardView";
import { AdminView }            from "./views/AdminView";
import { ProfileView }          from "./views/ProfileView";

export default function App() {
  const [callConfirmations, setCallConfirmations] = useState([]);
  const [view,          setView]          = useState("home");
  const [currentUser,   setCurrentUser]   = useState(null);
  const [isAdmin,       setIsAdmin]       = useState(false);
  const [users,         setUsers]         = useState([]);
  const [payments,      setPayments]      = useState([]);
  const [calls,         setCalls]         = useState([]);
  const [reports,       setReports]       = useState([]);
  const [verifyPrompts, setVP]            = useState([]);
  const [refundReqs,    setRefundReqs]    = useState([]);
  const [favorites,     setFavorites]     = useState([]);
  const [adminWallet,   setAdminWallet]   = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [toasts,        setToasts]        = useState([]);
  const [pendingHost,   setPendingHost]   = useState(null);
  const [selectedUser,  setSelectedUser]  = useState(null);

  // ── NEW STATE ──────────────────────────────────────────────────────────────
  const [disputes,      setDisputes]      = useState([]);
  const [followupReqs,  setFollowupReqs]  = useState([]);

  // ── boot: restore session ──────────────────────────────────────────────────
  useEffect(() => {
    const savedAdmin = localStorage.getItem("isAdmin");
    const savedUser  = localStorage.getItem("user");
    const savedView  = localStorage.getItem("view");
    const savedHost  = localStorage.getItem("pendingHost");
    if (savedAdmin === "true") { setIsAdmin(true); setView("admin"); return; }
    if (savedHost) {
      try { setPendingHost(JSON.parse(savedHost)); localStorage.removeItem("pendingHost"); } catch {}
    }
    if (savedUser) {
      try {
        const parsed = normaliseUser(JSON.parse(savedUser));
        setCurrentUser(parsed);
        if (savedView) setView(savedView);
      } catch { localStorage.clear(); }
    }
  }, []);

  // ── Paystack callback ──────────────────────────────────────────────────────
  useEffect(() => {
    const url = new URL(window.location.href);
    const ref = url.searchParams.get("ref");
    if (ref && (url.pathname === "/payment-callback" || url.search.includes("ref="))) {
      window.history.replaceState({}, "", "/");
      apiVerifyPayment(ref).then(result => {
        if (result.success) {
          toast("Payment verified! Your request is now pending review ✦");
          try { const saved = JSON.parse(localStorage.getItem("user") || "{}"); setView(saved.role === "watcher" ? "dashboard" : "browse"); } catch { setView("browse"); }
          supabase.from("payments").select("*").order("created_at", { ascending: false }).then(({ data }) => {
            if (data) setPayments(data.map(r => ({ ...r, ts: new Date(r.created_at), targetUserId: r.target_user_id, watcherName: r.watcher_name })));
          });
        } else {
          toast(result.error || "Payment verification failed", "error");
        }
      });
    }
  }, []);

  // ── online heartbeat ───────────────────────────────────────────────────────
  useEffect(() => {
    const handleOffline = async () => {
      const savedUser = localStorage.getItem("user");
      if (savedUser) { try { const p = JSON.parse(savedUser); await supabase.from("users").update({ online: false }).eq("id", p.id); } catch {} }
    };
    window.addEventListener("beforeunload", handleOffline);
    return () => window.removeEventListener("beforeunload", handleOffline);
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;
    supabase.from("users").update({ online: true }).eq("id", currentUser.id);
    const hb = setInterval(() => supabase.from("users").update({ online: true }).eq("id", currentUser.id), 30000);
    return () => { clearInterval(hb); supabase.from("users").update({ online: false }).eq("id", currentUser.id); };
  }, [currentUser?.id]);

  // ── realtime subscriptions ─────────────────────────────────────────────────
  // ── realtime subscriptions ─────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase.channel(`realtime-updates-${currentUser?.id || "guest"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, payload => {
        const newRow = payload.new;
        setPayments(prev => { const exists = prev.find(p => p.id === newRow.id); return exists ? prev.map(p => p.id === newRow.id ? newRow : p) : [newRow, ...prev]; });
        if (payload.eventType === "INSERT" && newRow.status === "confirmed" && newRow.target_user_id === currentUser?.id && currentUser?.role === "host" && Notification.permission === "granted") {
          new Notification("New booking! ✦", { body: `${newRow.watcher_name || "A watcher"} just paid. Check your dashboard.`, icon: "/favicon.ico" });
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "calls" }, payload => {
        const newRow = payload.new;
        setCalls(prev => { const exists = prev.find(cl => cl.id === newRow.id); return exists ? prev.map(cl => cl.id === newRow.id ? newRow : cl) : [newRow, ...prev]; });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, payload => {
        if (payload.eventType === "UPDATE") setUsers(prev => prev.map(u => u.id === payload.new.id ? normaliseUser(payload.new) : u));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "refund_requests" }, payload => {
        const newRow = payload.new;
        setRefundReqs(prev => { const exists = prev.find(r => r.id === newRow.id); return exists ? prev.map(r => r.id === newRow.id ? newRow : r) : [newRow, ...prev]; });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "call_confirmations" }, payload => {
        const newRow = payload.new;
        setCallConfirmations(prev => { const exists = prev.find(c => c.id === newRow.id); return exists ? prev.map(c => c.id === newRow.id ? newRow : c) : [newRow, ...prev]; });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "favorites" }, payload => {
        if (payload.eventType === "INSERT") setFavorites(prev => [...prev, payload.new]);
        if (payload.eventType === "DELETE") setFavorites(prev => prev.filter(f => f.id !== payload.old.id));
      })
      // ── NEW: disputes & follow-up realtime ──
      .on("postgres_changes", { event: "*", schema: "public", table: "disputes" }, payload => {
        const newRow = payload.new;
        if (!newRow) return;
        setDisputes(prev => { const exists = prev.find(d => d.id === newRow.id); return exists ? prev.map(d => d.id === newRow.id ? newRow : d) : [newRow, ...prev]; });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "followup_requests" }, payload => {
        const newRow = payload.new;
        if (!newRow) return;
        setFollowupReqs(prev => { const exists = prev.find(f => f.id === newRow.id); return exists ? prev.map(f => f.id === newRow.id ? newRow : f) : [newRow, ...prev]; });
      })
      // Catch DELETE events on disputes
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "disputes" }, payload => {
        setDisputes(prev => prev.filter(d => d.id !== payload.old.id));
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [currentUser?.id]);

  // ── toast helper ──────────────────────────────────────────────────────────
  const toast = useCallback((msg, type = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 5000);
  }, []);

  // ── logout ─────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    if (currentUser?.id) await supabase.from("users").update({ online: false }).eq("id", currentUser.id);
    setCurrentUser(null); setIsAdmin(false); setView("home");
    localStorage.removeItem("user"); localStorage.removeItem("view"); localStorage.removeItem("isAdmin");
    localStorage.removeItem("rememberedName"); localStorage.removeItem("rememberedPass");
    toast("Logged out");
  };

  // ── URL deep-link to host profile ──────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hostName = params.get("host");
    if (hostName && users.length > 0) {
      const host = users.find(u => u.name.toLowerCase() === hostName.toLowerCase() && u.role === "host");
      if (host) { setSelectedUser(host); setView("profile"); }
    }
  }, [users]);

  // ── periodic auto-confirm / expire ────────────────────────────────────────
  useEffect(() => {
    const run = async () => {
      try {
        await fetch(`${API_BASE}/api/admin/auto-confirm-pending`, { method: "POST", headers: { "x-admin-token": ADMIN_TOKEN } });
      } catch {}
    };
    run();
    const interval = setInterval(run, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  // ── initial data load ──────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [
          { data: uRows }, { data: pRows }, { data: cRows }, { data: vRows },
          { data: favRows }, { data: rRows }, { data: confRows }, { data: repRows },
          { data: dRows }, { data: fRows },  // NEW
        ] = await Promise.all([
          supabase.from("users").select("*").order("created_at", { ascending: false }),
          supabase.from("payments").select("*").order("created_at", { ascending: false }),
          supabase.from("calls").select("*").order("created_at", { ascending: false }),
          supabase.from("verify_prompts").select("*").order("created_at", { ascending: false }),
          supabase.from("favorites").select("*"),
          supabase.from("refund_requests").select("*").order("created_at", { ascending: false }),
          supabase.from("call_confirmations").select("*").order("created_at", { ascending: false }),
          supabase.from("reports").select("*").order("created_at", { ascending: false }),
          supabase.from("disputes").select("*").order("opened_at", { ascending: false }),
          supabase.from("followup_requests").select("*").order("requested_at", { ascending: false }),
        ]);
        if (uRows) {
          const mapped = uRows.map(normaliseUser);
          setUsers(mapped);
          const savedUser = localStorage.getItem("user");
          if (savedUser) {
            try {
              const parsed = JSON.parse(savedUser);
              const freshUser = mapped.find(u => u.id === parsed.id);
              if (freshUser) { setCurrentUser(freshUser); localStorage.setItem("user", JSON.stringify(freshUser)); supabase.from("users").update({ online: true }).eq("id", freshUser.id); }
            } catch {}
          }
        }
        if (confRows) setCallConfirmations(confRows);
        if (pRows) setPayments(pRows.map(r => ({ ...r, ts: new Date(r.created_at), targetUserId: r.target_user_id, watcherName: r.watcher_name })));
        if (cRows) setCalls(cRows.map(r => ({ ...r, ts: new Date(r.created_at), targetUserId: r.target_user_id, paymentId: r.payment_id })));
        if (vRows) setVP(vRows.map(r => ({ ...r, paymentId: r.payment_id })));
        if (favRows) setFavorites(favRows);
        if (rRows) setRefundReqs(rRows);
        if (repRows) setReports(repRows);
        if (dRows) setDisputes(dRows);        // NEW
        if (fRows) setFollowupReqs(fRows);    // NEW
        if (pRows && cRows) {
          const releasedIds = new Set((cRows || []).filter(r => r.released).map(r => r.payment_id));
          const held = (pRows || []).filter(r => !releasedIds.has(r.id) && r.status !== "refunded" && r.status !== "failed" && r.status !== "pending_init").reduce((a, r) => a + Number(r.total_charged || r.amount), 0);
          setAdminWallet(held);
        }
      } catch (e) { console.error("Load error:", e); toast("Failed to load data", "error"); }
      finally { setLoading(false); }
    })();
  }, []);

  // ── handlers ──────────────────────────────────────────────────────────────
  const handleSignup = async formData => {
    const nameExists = users.some(u => u.name.toLowerCase() === formData.name.trim().toLowerCase());
    if (nameExists) { toast("That username is already taken — choose another", "error"); return null; }
    if (formData.role === "host" && formData.contactNumber) {
      const contactExists = users.some(u => u.contactNumber === formData.contactNumber.trim());
      if (contactExists) { toast("That contact number is already registered", "error"); return null; }
    }
    let profilePhotoUrl = null;
    if (formData.profilePhoto instanceof File) { profilePhotoUrl = await uploadFile("avatars", formData.profilePhoto); if (!profilePhotoUrl) { toast("Profile photo upload failed", "error"); return null; } }
    let photoUrls = [];
    for (const photo of (formData.photos || [])) {
      if (photo instanceof File) { const url = await uploadFile("gallery", photo); if (url) photoUrls.push(url); }
      else if (typeof photo === "string") photoUrls.push(photo);
    }
    const res = await fetch(`${API_BASE}/api/auth/signup`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: formData.name.trim(), password: formData.password, role: formData.role || "host", bio: formData.bio || "", platform: formData.platform || null, contact_number: formData.contactNumber || null, rate: formData.rate ? parseFloat(formData.rate) : 0, tags: safeArr(formData.tags), profile_photo: profilePhotoUrl, photos: photoUrls, email: formData.email || "", payout_name: "", payout_number: "", payout_provider: "", paystack_recipient_code: "", accepted_terms: true, accepted_terms_at: new Date().toISOString() }),
    });
    const result = await res.json();
    if (!result.success) { toast(result.error || "Signup failed", "error"); return null; }
    const newUser = normaliseUser(result.user);
    setUsers(x => [newUser, ...x]);
    setCurrentUser(newUser);
    if (formData.role === "host" && formData.payoutNumber && formData.payoutProvider) {
      const onboardResult = await apiOnboardPayout(newUser.id, formData.payoutName || formData.name, formData.payoutNumber, formData.payoutProvider);
      if (onboardResult.success) {
        newUser.paystackRecipientCode = onboardResult.recipientCode;
        newUser.payoutName = formData.payoutName || formData.name;
        newUser.payoutNumber = formData.payoutNumber;
        newUser.payoutProvider = formData.payoutProvider;
        setCurrentUser({ ...newUser });
        localStorage.setItem("user", JSON.stringify(newUser));
        toast("Payout setup complete! You'll receive payments automatically ✦");
      } else {
        toast("Profile created but payout setup failed: " + (onboardResult.error || "Unknown error"), "warning");
      }
    }
    const dest = "dashboard";
    setView(dest);
    localStorage.setItem("user", JSON.stringify(newUser));
    localStorage.setItem("view", dest);
    localStorage.setItem("isAdmin", "false");
    if (newUser.role === "host" && Notification.permission === "default") Notification.requestPermission();
    if (newUser.role === "watcher") toast("Account created! Browse consultants ✦");
    else toast("Profile created! You're live ✦");
    if (newUser.role === "watcher" && pendingHost) setTimeout(() => setView("browse"), 500);
    return newUser;
  };

  const handleLogin = async (name, password) => {
    if (!name || !password) { toast("Enter login details", "error"); return; }
    const inputName = name.trim().toLowerCase();
    const ADMIN_USER = import.meta.env.VITE_ADMIN_USER || "admin";
    const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASS || "admin123";
    if (inputName === ADMIN_USER.toLowerCase() && password === ADMIN_PASS) {
      setIsAdmin(true); setView("admin"); localStorage.setItem("isAdmin", "true"); localStorage.setItem("view", "admin"); toast("Admin access granted"); return;
    }
    const res = await fetch(`${API_BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, password }) });
    const result = await res.json();
    if (!result.success) { toast(result.error || "Login failed", "error"); return; }
    const user = normaliseUser(result.user);
    setCurrentUser(user);
    const dest = "dashboard";
    setView(dest);
    localStorage.setItem("user", JSON.stringify(user)); localStorage.setItem("view", dest); localStorage.setItem("isAdmin", "false");
    await supabase.from("users").update({ online: true }).eq("id", user.id);
    toast(`Welcome back, ${user.name.split(" ")[0]} ✦`);
    if (user.role === "host" && Notification.permission === "default") Notification.requestPermission();
  };

  const handleUpdateUser = async formData => {
    const id = formData.id;
    let profilePhotoUrl = formData.profilePhoto;
    if (formData.profilePhoto instanceof File) { profilePhotoUrl = await uploadFile("avatars", formData.profilePhoto); if (!profilePhotoUrl) { toast("Photo upload failed", "error"); return; } }
    let photoUrls = [];
    for (const photo of safeArr(formData.photos)) {
      if (photo instanceof File) { const url = await uploadFile("gallery", photo); if (url) photoUrls.push(url); }
      else if (typeof photo === "string") photoUrls.push(photo);
    }
    const { data, error } = await supabase.from("users").update({ name: formData.name, bio: formData.bio, platform: formData.platform, contact_number: formData.contactNumber, rate: Number(formData.rate), tags: safeArr(formData.tags), profile_photo: profilePhotoUrl, photos: photoUrls }).eq("id", id).select();
    if (error) { toast("Update failed: " + error.message, "error"); return; }
    if (!data || data.length === 0) { toast("Update failed", "error"); return; }
    if (formData.payoutNumber && formData.payoutProvider) {
      const onboardResult = await apiOnboardPayout(id, formData.payoutName || formData.name, formData.payoutNumber, formData.payoutProvider);
      if (!onboardResult.success) toast("Profile updated but payout setup failed: " + onboardResult.error, "warning");
    }
    const u = normaliseUser(data[0]);
    setUsers(x => x.map(xu => xu.id === id ? u : xu));
    if (currentUser?.id === id) { setCurrentUser(u); localStorage.setItem("user", JSON.stringify(u)); }
    toast("Profile updated ✦");
  };

  const handleInitiatePayment = async (targetUser, watcherData) => {
    const result = await apiInitializePayment({ hostId: targetUser.id, watcherId: currentUser?.id || null, watcherName: watcherData.watcherName, watcherContact: watcherData.watcherContact, watcherPlatform: watcherData.watcherPlatform || "WhatsApp" });
    if (result.error) { toast(result.error, "error"); return null; }
    window.location.href = result.authorizationUrl;
    return result;
  };

  const handleMarkDone = async (paymentId, targetUser) => {
    const res = await fetch(`${API_BASE}/api/call/mark-done`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentId, hostId: currentUser?.id }) });
    const result = await res.json();
    if (result.error) { toast(result.error, "error"); return result; }
    if (result.alreadyMarked) { toast("Already marked — awaiting watcher confirmation"); return result; }
    toast("Call marked done! Waiting for watcher to confirm…");
    return result;
  };

  const handleConfirmCall = async (confirmationId, response) => {
    const result = await apiConfirmCall(confirmationId, currentUser?.id, response);
    if (result.error) { toast(result.error, "error"); return; }
    if (response === "yes") {
      toast("Call confirmed! Host has been paid ✦", "success");
    } else {
      toast("Dispute opened — host has 20 minutes to submit evidence of the call", "warning");
    }

    // Full refresh of all affected tables
    const [
      { data: pRows },
      { data: dRows },
      { data: rRows },
      { data: confRows },
    ] = await Promise.all([
      supabase.from("payments").select("*").order("created_at", { ascending: false }),
      supabase.from("disputes").select("*").order("created_at", { ascending: false }),
      supabase.from("refund_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("call_confirmations").select("*").order("created_at", { ascending: false }),
    ]);

    if (pRows) setPayments(pRows.map(r => ({ ...r, ts: new Date(r.created_at), targetUserId: r.target_user_id, watcherName: r.watcher_name })));
    if (dRows) setDisputes(dRows);
    if (rRows) setRefundReqs(rRows);
    if (confRows) setCallConfirmations(confRows);
  };

  const confirmPayment = async paymentId => {
    const result = await apiConfirmPayment(paymentId);
    if (result.error) { toast("Failed: " + result.error, "error"); return; }
    const { data: refreshed } = await supabase.from("payments").select("*").eq("id", paymentId).single();
    if (refreshed) setPayments(prev => prev.map(p => p.id === paymentId ? refreshed : p));
    toast(result.transferCode ? "Payment confirmed ✓ — Contact revealed & payout sent" : `Payment confirmed ✓ (${result.transferMessage})`);
  };

  const handleRelease = async (callId, paymentId) => {
    const result = await apiReleaseFunds(callId, paymentId);
    if (result.error) { toast("Error: " + result.error, "error"); return; }
    setCalls(x => x.map(cl => cl.id === callId ? { ...cl, released: true } : cl));
    setPayments(x => x.map(p => p.id === paymentId ? { ...p, status: "completed" } : p));
    const amount = payments.find(p => p.id === paymentId)?.amount || 0;
    setAdminWallet(w => w - Number(amount));
    toast("Funds released");
  };

  const handlePushVerify = async paymentId => {
    const { data, error } = await supabase.from("verify_prompts").insert([{ payment_id: paymentId, answered: false }]).select().single();
    if (error) { toast("Error: " + error.message, "error"); return; }
    setVP(x => [{ ...data, paymentId: data.payment_id }, ...x]);
    toast("Verification prompt sent");
  };

  const handleAnswerVerify = async (vpId, confirmed) => {
    await supabase.from("verify_prompts").update({ answered: true }).eq("id", vpId);
    setVP(x => x.map(v => v.id === vpId ? { ...v, answered: true } : v));
    toast(confirmed ? "Call confirmed ✓" : "Dispute noted", confirmed ? "success" : "error");
  };

  const handleRefundRequest = async (paymentId, reason) => {
    const result = await apiWatcherRefund(paymentId, reason, currentUser?.id);
    if (result.error) { toast(result.error, "error"); return; }
    // Refresh related tables
    const { data: rRows } = await supabase.from("refund_requests").select("*").order("created_at", { ascending: false });
    if (rRows) setRefundReqs(rRows);
    const { data: pRows } = await supabase.from("payments").select("*").order("created_at", { ascending: false });
    if (pRows) setPayments(pRows.map(r => ({ ...r, ts: new Date(r.created_at), targetUserId: r.target_user_id, watcherName: r.watcher_name })));
    // If dispute was opened, refresh disputes too
    if (result.disputeOpened) {
      const { data: dRows } = await supabase.from("disputes").select("*").order("opened_at", { ascending: false });
      if (dRows) setDisputes(dRows);
    }
    toast(result.message, result.autoRefunded ? "success" : result.disputeOpened ? "warning" : "info");
    return result;
  };

  // ── NEW HANDLERS ──────────────────────────────────────────────────────────
  const handleSubmitEvidence = async (disputeId, userId, role, evidenceUrl) => {
    const result = await apiSubmitEvidence(disputeId, userId, role, evidenceUrl);
    if (result.error) { toast(result.error, "error"); return; }
    // Refresh disputes
    const { data: dRows } = await supabase.from("disputes").select("*").order("opened_at", { ascending: false });
    if (dRows) setDisputes(dRows);
    toast(result.message || "Evidence submitted", "success");
    return result;
  };

  const handleAcceptFollowup = async (followupId, watcherId, accepted) => {
    const result = await apiAcceptFollowup(followupId, watcherId, accepted);
    if (result.error) { toast(result.error, "error"); return; }
    // Refresh follow-ups and payments
    const { data: fRows } = await supabase.from("followup_requests").select("*").order("requested_at", { ascending: false });
    if (fRows) setFollowupReqs(fRows);
    const { data: pRows } = await supabase.from("payments").select("*").order("created_at", { ascending: false });
    if (pRows) setPayments(pRows.map(r => ({ ...r, ts: new Date(r.created_at), targetUserId: r.target_user_id, watcherName: r.watcher_name })));
    toast(result.message || (accepted ? "Follow-up accepted" : "Follow-up declined"), accepted ? "success" : "info");
  };

  const handleHostApproveRefund = async refundId => {
    const result = await apiHostApproveRefund(refundId, currentUser?.id);
    if (result.error) { toast("Error: " + result.error, "error"); return; }
    const { data: rRows } = await supabase.from("refund_requests").select("*").order("created_at", { ascending: false });
    if (rRows) setRefundReqs(rRows);
    const { data: pRows } = await supabase.from("payments").select("*").order("created_at", { ascending: false });
    if (pRows) setPayments(pRows.map(r => ({ ...r, ts: new Date(r.created_at), targetUserId: r.target_user_id, watcherName: r.watcher_name })));
    toast("Refund approved — funds returned to watcher ✅");
  };

  const handleApproveRefund = async refundId => {
    const result = await apiAdminApproveRefund(refundId);
    if (result.error) { toast("Error: " + result.error, "error"); return; }
    const { data: rRows } = await supabase.from("refund_requests").select("*").order("created_at", { ascending: false });
    if (rRows) setRefundReqs(rRows);
    const { data: pRows } = await supabase.from("payments").select("*").order("created_at", { ascending: false });
    if (pRows) setPayments(pRows.map(r => ({ ...r, ts: new Date(r.created_at), targetUserId: r.target_user_id, watcherName: r.watcher_name })));
    toast("Refund approved ✅");
  };

  const handleDenyRefund = async refundId => {
    const result = await apiDenyRefund(refundId);
    if (result.error) { toast("Error: " + result.error, "error"); return; }
    const { data: rRows } = await supabase.from("refund_requests").select("*").order("created_at", { ascending: false });
    if (rRows) setRefundReqs(rRows);
    const { data: pRows } = await supabase.from("payments").select("*").order("created_at", { ascending: false });
    if (pRows) setPayments(pRows.map(r => ({ ...r, ts: new Date(r.created_at), targetUserId: r.target_user_id, watcherName: r.watcher_name })));
    toast("Refund denied — host payout triggered", "error");
  };

  const toggleFavorite = async hostId => {
    if (!currentUser) return toast("Sign in to save favorites", "error");
    const exists = favorites.find(f => f.host_id === hostId && f.watcher_id === currentUser.id);
    if (exists) {
      await supabase.from("favorites").delete().eq("id", exists.id);
      setFavorites(prev => prev.filter(f => f.id !== exists.id));
      toast("Removed from favorites");
    } else {
      const { data } = await supabase.from("favorites").insert([{ watcher_id: currentUser.id, host_id: hostId }]).select().single();
      if (data) setFavorites(prev => [...prev, data]);
      toast("Saved to favorites ❤️");
    }
  };

  // ── loading skeleton ───────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div className="shimmer" style={{ height: 40, width: 300, borderRadius: 8, marginBottom: 30 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 18 }}>
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    </div>
  );

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <Petals />
      <Toast toasts={toasts} />
      <Nav setView={setView} currentUser={currentUser} isAdmin={isAdmin} handleLogout={handleLogout} />
      <MobileNav setView={setView} currentUser={currentUser} isAdmin={isAdmin} handleLogout={handleLogout} />
      <FeedbackButton />

      {view === "home" && <HomeView setView={setView} users={users} favorites={favorites} toggleFavorite={toggleFavorite} currentUser={currentUser} />}
      {view === "howItWorks" && <HowItWorksView setView={setView} />}
      {view === "profile" && selectedUser && <ProfileView host={selectedUser} setView={setView} currentUser={currentUser} onInitiatePayment={handleInitiatePayment} toast={toast} />}
      {view === "signup" && <SignupView onSignup={handleSignup} setView={setView} toast={toast} />}
      {view === "login" && <LoginView onLogin={handleLogin} setView={setView} />}
      {view === "forgotPassword" && <ForgotPasswordView setView={setView} toast={toast} />}
      {view === "browse" && (
        <BrowseView
          users={users} payments={payments} onInitiatePayment={handleInitiatePayment}
          currentUser={currentUser} toast={toast} verifyPrompts={verifyPrompts}
          onAnswerVerify={handleAnswerVerify} setView={setView} refundReqs={refundReqs}
          onRefundRequest={handleRefundRequest} onHostApproveRefund={handleHostApproveRefund}
          pendingHost={pendingHost} setPendingHost={setPendingHost}
          callConfirmations={callConfirmations} onConfirmCall={handleConfirmCall}
          favorites={favorites} toggleFavorite={toggleFavorite}
        />
      )}
      {view === "dashboard" && currentUser && currentUser.role === "host" && (
        <DashboardView
          user={currentUser} users={users} payments={payments} calls={calls}
          verifyPrompts={verifyPrompts} onMarkDone={handleMarkDone} onUpdate={handleUpdateUser}
          onAnswerVerify={handleAnswerVerify} toast={toast} setView={setView}
          refundReqs={refundReqs} onHostApproveRefund={handleHostApproveRefund}
          callConfirmations={callConfirmations}
          disputes={disputes}
          followupReqs={followupReqs}
          onSubmitEvidence={handleSubmitEvidence}
          onRequestFollowup={async (paymentId) => {
            const result = await apiRequestFollowup(paymentId, currentUser?.id);
            if (result.error) { toast(result.error, "error"); return; }
            const { data: fRows } = await supabase.from("followup_requests").select("*").order("requested_at", { ascending: false });
            if (fRows) setFollowupReqs(fRows);
            toast(result.message, "success");
          }}
        />
      )}
      {view === "dashboard" && currentUser && currentUser.role === "watcher" && (
        <WatcherDashboardView
          user={currentUser} users={users} payments={payments} refundReqs={refundReqs}
          onRefundRequest={handleRefundRequest} toast={toast} setView={setView}
          callConfirmations={callConfirmations} onConfirmCall={handleConfirmCall}
          favorites={favorites} toggleFavorite={toggleFavorite}
          disputes={disputes}
          followupReqs={followupReqs}
          onSubmitEvidence={handleSubmitEvidence}
          onAcceptFollowup={handleAcceptFollowup}
        />
      )}
      {view === "admin" && isAdmin && (
        <AdminView
          users={users} payments={payments} calls={calls} wallet={adminWallet}
          verifyPrompts={verifyPrompts} onRelease={handleRelease} reports={reports}
          onPushVerify={handlePushVerify} setView={setView} confirmPayment={confirmPayment}
          refundReqs={refundReqs} callConfirmations={callConfirmations}
          onApproveRefund={handleApproveRefund} onDenyRefund={handleDenyRefund} toast={toast}
          disputes={disputes}
        />
      )}

      {/* ── Feedback Button — always visible in bottom-right corner ── */}
      <FeedbackButton />
    </>
  );
}