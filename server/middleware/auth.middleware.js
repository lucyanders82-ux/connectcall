// server/middleware/auth.middleware.js
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-in-production';
const loginAttempts = new Map();

export function adminLogin(req, res) {
  const { username, password } = req.body;
  
  const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
  const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin123';
  
  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const token = jwt.sign(
    { role: 'admin', username },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
  
  res.json({ token, expiresIn: '12h' });
}

export function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function rateLimitLogin(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const attempts = loginAttempts.get(ip) || { count: 0, lastAttempt: now };
  
  if (attempts.count > 5 && now - attempts.lastAttempt < 15 * 60 * 1000) {
    return res.status(429).json({ error: 'Too many attempts. Wait 15 minutes.' });
  }
  
  loginAttempts.set(ip, { count: attempts.count + 1, lastAttempt: now });
  next();
}