// lib/auth.js
import jwt from 'jsonwebtoken';

const JWT_TTL = 30 * 24 * 60 * 60; // 30 days in seconds

function getSecret() {
  const secret = process.env.JWT_SECRET || process.env.API_SHARED_SECRET;
  if (!secret) throw new Error('JWT_SECRET or API_SHARED_SECRET must be set');
  return secret;
}

export function getTokenFromReq(req) {
  return req.cookies['auth-token'] || null;
}

export function mintSessionToken(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: JWT_TTL });
}

export async function verifyToken(token) {
  if (!token) return null;
  const secret = getSecret(); // throws if no secret — intentionally outside the jwt catch
  try {
    const decoded = jwt.verify(token, secret);
    return { user_id: decoded.user_id, email: decoded.email };
  } catch {
    return null;
  }
}
