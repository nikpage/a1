// lib/session.js
import { mintSessionToken } from './auth';

const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export function setSessionCookie(res, { user_id, email = null }) {
  const token = mintSessionToken({ user_id, email });
  const isProd = process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie', [
    `auth-token=${token}; HttpOnly; Path=/; Max-Age=${COOKIE_MAX_AGE}; ${
      isProd ? 'SameSite=None; Secure' : 'SameSite=Lax'
    }`,
  ]);
}
