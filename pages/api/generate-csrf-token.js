//pages/api/generate-csrf-token.js
import crypto from 'crypto';

const tokens = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + 5000; // 5 seconds

  tokens.set(token, expires);

  // Clean expired tokens
  for (const [key, expiry] of tokens.entries()) {
    if (Date.now() > expiry) tokens.delete(key);
  }

  return res.status(200).json({ token });
}

export function validateCSRFToken(token) {
  if (!token || !tokens.has(token)) return false;

  const expires = tokens.get(token);
  tokens.delete(token); // Single use

  return Date.now() <= expires;
}
