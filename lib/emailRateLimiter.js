// lib/emailRateLimiter.js
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 3; // 3 requests per email per minute

const emailStore = {};

export default function emailRateLimiter(email, res) {
  const now = Date.now();
  const emailKey = email.toLowerCase();

  if (!emailStore[emailKey] || now - emailStore[emailKey].windowStart > RATE_LIMIT_WINDOW_MS) {
    emailStore[emailKey] = { count: 1, windowStart: now };
  } else {
    emailStore[emailKey].count += 1;
  }

  if (emailStore[emailKey].count > RATE_LIMIT_MAX) {
    res.status(429).json({ error: 'Too many requests. Please try again in a minute.' });
    return false;
  }
  return true;
}
