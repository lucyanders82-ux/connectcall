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
      message: `ConnectCall: ${hostName} has marked your call as done. You have 3 minutes to confirm or dispute. Log in now at connectcall.vercel.app`,
      from: process.env.AT_SENDER_ID || undefined,
    });
    console.log(`[SMS] Watcher notified — ${to}`);
  } catch (err) {
    console.error('[SMS] Watcher notification failed:', err.message);
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