// lib/rateLimiter.js

const RATE_LIMIT_WINDOW_MS = 10 * 1000; // 10 seconds
const RATE_LIMIT_MAX = 1; // 1 request per 10 seconds per IP

export default async function rateLimiter(req, res) {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
               req.socket?.remoteAddress ||
               'unknown';

    const now = Date.now();
    const key = `ip_rate:${ip}`;

    const response = await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}/get/${key}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      }
    );

    const data = await response.json();
    let ipData = null;

    if (data.result) {
      ipData = JSON.parse(data.result);
    }

    if (!ipData || now - ipData.windowStart > RATE_LIMIT_WINDOW_MS) {
      ipData = { count: 1, windowStart: now };
    } else {
      ipData.count += 1;
    }

    // Store with expiration
    await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}/setex/${key}/${Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)}/${encodeURIComponent(JSON.stringify(ipData))}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      }
    );

    if (ipData.count > RATE_LIMIT_MAX) {
      res.status(429).json({ error: 'IP rate limit exceeded' });
      return false;
    }

    return true;
  } catch (error) {
    console.error('IP rate limiter error:', error);
    res.status(500).json({ error: 'Security system error' });
    return false;
  }
}
