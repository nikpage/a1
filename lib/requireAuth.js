// lib/requireAuth.js

import jwt from 'jsonwebtoken';

export default function requireAuth(req, res) {
  // Get JWT from cookie
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/auth-token=([^;]+)/);
  if (!match) {
    res.status(401).json({ error: 'Not authenticated (missing token)' });
    return null;
  }
  const token = match[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload; // { user_id, email, ... }
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return null;
  }
}
