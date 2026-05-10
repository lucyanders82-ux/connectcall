// server/services/payment.service.js
import crypto from 'crypto';

const FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT || '20');

export function calculatePaymentAmounts(hostRate) {
  const rate = parseFloat(hostRate);
  const platformFee = parseFloat((rate * FEE_PERCENT / 100).toFixed(2));
  const totalAmount = parseFloat((rate + platformFee).toFixed(2));
  
  return {
    hostRate: rate,
    platformFee,
    totalAmount,
    amountPesewas: Math.round(totalAmount * 100),
    hostPayout: rate,
    platformRevenue: platformFee
  };
}

export function generatePaymentReference() {
  return `CC_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

export function validateMoMoNumber(number, provider) {
  const cleaned = number.replace(/\D/g, '');

  // Nigerian OPay — 11 digits starting with 07x/08x/09x
  if (provider === 'OPay') {
    if (cleaned.length !== 11) {
      return { valid: false, error: 'Nigerian number must be 11 digits' };
    }
    const nigerianPrefixes = ['070','071','080','081','090','091','081'];
    if (!nigerianPrefixes.some(p => cleaned.startsWith(p))) {
      return { valid: false, error: 'Number does not look like a valid Nigerian mobile number' };
    }
    return { valid: true, formatted: cleaned };
  }

  // Ghana MoMo — 10 digits
  if (cleaned.length !== 10) {
    return { valid: false, error: 'Number must be 10 digits' };
  }

  const prefixes = {
    'MTN':        ['024', '054', '055', '059', '025'],
    'Vodafone':   ['020', '050'],
    'AirtelTigo': ['027', '057', '026', '056'],
    // legacy keys
    'VOD': ['020', '050'],
    'ATL': ['027', '057', '026', '056'],
  };

  const validPrefixes = prefixes[provider];
  if (!validPrefixes) {
    return { valid: false, error: 'Invalid provider' };
  }

  if (!validPrefixes.includes(cleaned.substring(0, 3))) {
    return { valid: false, error: `Number doesn't match ${provider}` };
  }

  return { valid: true, formatted: cleaned };
}