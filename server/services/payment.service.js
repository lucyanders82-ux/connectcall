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
  
  if (cleaned.length !== 10) {
    return { valid: false, error: 'Number must be 10 digits' };
  }
  
  const prefixes = {
    'MTN': ['024', '054', '055', '059', '025'],
    'VOD': ['020', '050'],
    'ATL': ['027', '057', '026', '056']
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