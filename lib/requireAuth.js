// lib/requireAuth.js

import jwt from 'jsonwebtoken';

export default async function requireAuth(req, res) {
  // Force HTTPS in production
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
    res.status(403).json({ error: 'HTTPS required' });
    return null;
  }

  // ONLY accept cookies - no other token sources
  const token = req.cookies?.['auth-token'];

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }

  // Check if token is blacklisted
  try {
    const key = `blacklist:${token}`;
    const response = await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}/get/${key}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      }
    );
    const data = await response.json();

    if (data.result) {
      res.status(401).json({ error: 'Token invalidated' });
      return null;
    }
  } catch (error) {
    console.error('Blacklist check failed:', error);
    res.status(500).json({ error: 'Security check failed' });
    return null;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Update last activity in Redis
    const activityKey = `activity:${payload.user_id}`;
    await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}/setex/${activityKey}/3600/${Date.now()}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      }
    );

    return payload;
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
    return null;
  }
}
