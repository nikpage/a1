// lib/auth.js
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || process.env.API_SHARED_SECRET || 'fallback-dev-secret-change-in-prod';
const JWT_TTL = 30 * 24 * 60 * 60; // 30 days in seconds

export function getTokenFromReq(req) {
  return req.cookies['auth-token'] || null;
}

export function mintSessionToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_TTL });
}

export async function verifyToken(token) {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { user_id: decoded.user_id, email: decoded.email };
  } catch {
    return null;
  }
}
