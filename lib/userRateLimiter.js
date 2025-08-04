// lib/userRateLimiter.js

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 5; // 5 requests per window per user

// In-memory store: { [user_id]: { count, windowStart } }
const userStore = {};

export default function userRateLimiter(user_id, res) {
  const now = Date.now();
  if (!userStore[user_id] || now - userStore[user_id].windowStart > RATE_LIMIT_WINDOW_MS) {
    userStore[user_id] = { count: 1, windowStart: now };
  } else {
    userStore[user_id].count += 1;
  }

  if (userStore[user_id].count > RATE_LIMIT_MAX) {
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
    return false;
  }
  return true;
}
