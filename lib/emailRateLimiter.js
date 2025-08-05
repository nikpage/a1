// lib/emailRateLimiter.js

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 1; // 1 request per minute per email

export default async function emailRateLimiter(email, res) {
  try {
    const now = Date.now();
    const emailKey = email.toLowerCase();
    const key = `email_rate:${emailKey}`;

    const response = await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}/get/${key}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      }
    );

    const data = await response.json();
    let emailData = null;

    if (data.result) {
      emailData = JSON.parse(data.result);
    }

    if (!emailData || now - emailData.windowStart > RATE_LIMIT_WINDOW_MS) {
      emailData = { count: 1, windowStart: now };
    } else {
      emailData.count += 1;
    }

    // Store with expiration
    await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}/setex/${key}/${Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)}/${encodeURIComponent(JSON.stringify(emailData))}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      }
    );

    if (emailData.count > RATE_LIMIT_MAX) {
      res.status(429).json({ error: 'Email rate limit exceeded' });
      return false;
    }

    return true;
  } catch (error) {
    console.error('Email rate limiter error:', error);
    res.status(500).json({ error: 'Security system error' });
    return false;
  }
}
