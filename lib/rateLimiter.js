// lib/rateLimiter.js

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 2; // 2 requests per window per IP

// Simple in-memory store: { [ip]: { count, windowStart } }
const ipStore = {};

export default function rateLimiter(req, res) {
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  const now = Date.now();
  if (!ipStore[ip] || now - ipStore[ip].windowStart > RATE_LIMIT_WINDOW_MS) {
    ipStore[ip] = { count: 1, windowStart: now };
  } else {
    ipStore[ip].count += 1;
  }

  if (ipStore[ip].count > RATE_LIMIT_MAX) {
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
    return false;
  }
  return true;
}
