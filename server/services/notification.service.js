import AfricasTalking from 'africastalking';

const AT = AfricasTalking({
  username: process.env.AT_USERNAME,
  apiKey: process.env.AT_API_KEY,
});

const sms = AT.SMS;

function formatGhanaNumber(number) {
  const digits = number.replace(/\D/g, '');
  if (digits.startsWith('0')) return '+233' + digits.slice(1);
  if (digits.startsWith('233')) return '+' + digits;
  return '+233' + digits;
}

export async function notifyWatcherCallMarkedDone(watcherContact, hostName) {
  try {
    const to = formatGhanaNumber(watcherContact);
    await sms.send({
      to: [to],
      message: `ConnectCall: ${hostName} has marked your call as done. You have 10 minutes to confirm or dispute. Log in now at connectcall.vercel.app`,
      from: process.env.AT_SENDER_ID || undefined,
    });
    console.log(`[SMS] Watcher notified — ${to}`);
  } catch (err) {
    console.error('[SMS] Watcher notification failed:', err.message);
  }
}

export async function notifyHostBookingCancelled(hostContact, watcherName) {
  try {
    const to = formatGhanaNumber(hostContact);
    await sms.send({
      to: [to],
      message: `ConnectCall: ${watcherName} reported no contact. Their booking has been cancelled and a 70% refund issued. Log in for details: connectcall.vercel.app`,
      from: process.env.AT_SENDER_ID || undefined,
    });
    console.log(`[SMS] Host cancellation notified — ${to}`);
  } catch (err) {
    console.error('[SMS] Host cancellation notification failed:', err.message);
  }
}

export async function notifyHostNewBooking(hostContact, watcherName, platform) {
  try {
    const to = formatGhanaNumber(hostContact);
    await sms.send({
      to: [to],
      message: `ConnectCall: New booking from ${watcherName} via ${platform}! Log in now to see their contact and make the call: connectcall.vercel.app`,
      from: process.env.AT_SENDER_ID || undefined,
    });
    console.log(`[SMS] Host notified — ${to}`);
  } catch (err) {
    console.error('[SMS] Host notification failed:', err.message);
  }
}

export async function notifyPasswordReset(contactNumber, otp, name) {
  try {
    const to = formatGhanaNumber(contactNumber);
    await sms.send({
      to: [to],
      message: `ConnectCall: Hi ${name}, your password reset code is ${otp}. It expires in 15 minutes. Do not share this code with anyone.`,
      from: process.env.AT_SENDER_ID || undefined,
    });
    console.log(`[SMS] Password reset OTP sent — ${to}`);
  } catch (err) {
    console.error('[SMS] Password reset notification failed:', err.message);
  }
}

// ─────────────────────────────────────────────────────
// NEW: Dispute & Follow-up Notifications
// ─────────────────────────────────────────────────────

export async function notifyHostDisputeOpened(hostContact, watcherName, evidenceDeadline) {
  try {
    const to = formatGhanaNumber(hostContact);
    const deadlineMinutes = Math.round((new Date(evidenceDeadline) - new Date()) / 60000);
    await sms.send({
      to: [to],
      message: `ConnectCall: ${watcherName} disputes your marked call. You have ${deadlineMinutes} mins to submit call log evidence at connectcall.vercel.app or the refund will be processed.`,
      from: process.env.AT_SENDER_ID || undefined,
    });
    console.log(`[SMS] Host dispute opened — ${to}`);
  } catch (err) {
    console.error('[SMS] Host dispute notification failed:', err.message);
  }
}

export async function notifyWatcherCounterEvidence(watcherContact) {
  try {
    const to = formatGhanaNumber(watcherContact);
    await sms.send({
      to: [to],
      message: `ConnectCall: The host has submitted call evidence. You have 20 mins to upload your counter-evidence (call log screenshot) at connectcall.vercel.app.`,
      from: process.env.AT_SENDER_ID || undefined,
    });
    console.log(`[SMS] Watcher counter-evidence notified — ${to}`);
  } catch (err) {
    console.error('[SMS] Watcher counter-evidence notification failed:', err.message);
  }
}

export async function notifyFollowupRequest(watcherContact, hostName) {
  try {
    const to = formatGhanaNumber(watcherContact);
    await sms.send({
      to: [to],
      message: `ConnectCall: ${hostName} wants to retry your cancelled call. You have 10 mins to accept at connectcall.vercel.app — if you decline, your 70% refund is final.`,
      from: process.env.AT_SENDER_ID || undefined,
    });
    console.log(`[SMS] Follow-up request notified — ${to}`);
  } catch (err) {
    console.error('[SMS] Follow-up notification failed:', err.message);
  }
}
export async function notifyWatcherCallInitiated(watcherContact, watcherName) {
  try {
    const to = formatGhanaNumber(watcherContact);
    await sms.send({
      to: [to],
      message: `ConnectCall: Your host has initiated contact. Expect their call now on WhatsApp/Telegram.`,
      from: process.env.AT_SENDER_ID || undefined,
    });
    console.log(`[SMS] Watcher call initiated notified — ${to}`);
  } catch (err) {
    console.error('[SMS] Watcher call initiated notification failed:', err.message);
  }
}

export async function notifyHostFinalWarning(hostContact, watcherName) {
  try {
    const to = formatGhanaNumber(hostContact);
    await sms.send({
      to: [to],
      message: `ConnectCall: ${watcherName} is waiting for your call. You have 10 minutes to initiate contact or the booking will be cancelled and refunded. Log in now: connectcall.vercel.app`,
      from: process.env.AT_SENDER_ID || undefined,
    });
    console.log(`[SMS] Host final warning — ${to}`);
  } catch (err) {
    console.error('[SMS] Host final warning failed:', err.message);
  }
}

export async function notifyBothAIReviewing(hostContact, watcherContact) {
  try {
    const hostTo = formatGhanaNumber(hostContact);
    const watcherTo = formatGhanaNumber(watcherContact);
    await sms.send({
      to: [hostTo, watcherTo],
      message: `ConnectCall: Both sides have submitted evidence. AI is now reviewing your dispute. This usually takes under 2 minutes. You will be notified of the verdict.`,
      from: process.env.AT_SENDER_ID || undefined,
    });
    console.log(`[SMS] AI reviewing notified — ${hostTo}, ${watcherTo}`);
  } catch (err) {
    console.error('[SMS] AI reviewing notification failed:', err.message);
  }
}

export async function notifyBothAIVerdict(hostContact, watcherContact, verdict, confidence) {
  try {
    const hostTo = formatGhanaNumber(hostContact);
    const watcherTo = formatGhanaNumber(watcherContact);
    const resultText = verdict === 'host'
      ? 'Resolved in HOST favor — payment released to host.'
      : verdict === 'watcher'
        ? 'Resolved in WATCHER favor — 70% refund processed.'
        : 'AI could not reach a verdict — escalated to admin.';
    await sms.send({
      to: [hostTo, watcherTo],
      message: `ConnectCall: Dispute verdict — ${resultText} AI confidence: ${confidence}%. Log in for details: connectcall.vercel.app`,
      from: process.env.AT_SENDER_ID || undefined,
    });
    console.log(`[SMS] AI verdict notified — ${hostTo}, ${watcherTo}`);
  } catch (err) {
    console.error('[SMS] AI verdict notification failed:', err.message);
  }
}

export async function notifyBothEscalated(hostContact, watcherContact) {
  try {
    const hostTo = formatGhanaNumber(hostContact);
    const watcherTo = formatGhanaNumber(watcherContact);
    await sms.send({
      to: [hostTo, watcherTo],
      message: `ConnectCall: Your dispute has been escalated to admin for manual review. Admin has 24 hours to decide. You will be notified of the outcome. connectcall.vercel.app`,
      from: process.env.AT_SENDER_ID || undefined,
    });
    console.log(`[SMS] Escalation notified — ${hostTo}, ${watcherTo}`);
  } catch (err) {
    console.error('[SMS] Escalation notification failed:', err.message);
  }
}

export async function notifyHostCallInitiated(hostContact, watcherName) {
  try {
    const to = formatGhanaNumber(hostContact);
    await sms.send({
      to: [to],
      message: `ConnectCall: You have initiated contact with ${watcherName}. You have 30 minutes to complete the call and click "Mark Done" — or the booking will be auto-cancelled and refunded.`,
      from: process.env.AT_SENDER_ID || undefined,
    });
    console.log(`[SMS] Host call initiated deadline — ${to}`);
  } catch (err) {
    console.error('[SMS] Host call initiated notification failed:', err.message);
  }
}

export async function notifyWatcherHostRejected(watcherContact) {
  try {
    const to = formatGhanaNumber(watcherContact);
    await sms.send({
      to: [to],
      message: `ConnectCall: The host was unable to take your call and has rejected the request. You will receive a 90% refund shortly. We apologise for the inconvenience.`,
      from: process.env.AT_SENDER_ID || undefined,
    });
    console.log(`[SMS] Watcher host rejected notified — ${to}`);
  } catch (err) {
    console.error('[SMS] Watcher host rejected notification failed:', err.message);
  }
}