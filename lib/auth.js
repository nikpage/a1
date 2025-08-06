// lib/auth.js
import redis from './redis';

export function getTokenFromReq(req) {
  return req.cookies['auth-token'] || null;
}

export async function verifyToken(token) {
  if (!token) return null;

  try {
    console.log('🔍 Verifying token:', token);
    const sessionData = await redis.get(`session:${token}`);
    if (!sessionData) {
      console.log('❌ No session data found for token');
      return null;
    }

    console.log('✅ Session data retrieved:', sessionData);
    return JSON.parse(sessionData);
  } catch (error) {
    console.error('❌ Token verification error:', error);
    return null;
  }
}
