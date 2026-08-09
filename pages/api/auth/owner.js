// pages/api/auth/owner.js
//
// Owner door — a shared-secret login for the site owner, bypassing the magic-link
// email round-trip entirely:
//
//   POST /api/auth/owner  { key, email }   → { ok: true }, session cookie set
//
// POST with the key in the BODY, never the query string: URLs are written to
// browser history and to every proxy/CDN/host access log, so a GET door leaked
// the secret on every single login. The form at /owner-login posts here.
//
// The key is compared in constant time against API_SHARED_SECRET. On success it
// resolves the address to its canonical account (oldest wins — the same rule as
// pages/api/auth/verify.js) and mints the ordinary session cookie via
// setSessionCookie, so from that point on every requireAuth route, the master
// record and the generators behave exactly as they do after a normal login. No
// route gets a bypass; only the way the session is obtained changes.
//
// Anyone holding API_SHARED_SECRET can open any account, so this is a
// server-secret door, not a user feature: it is never linked from the UI, and
// the secret must never be shared or committed.

import crypto from 'crypto';
import { logger } from '../../../lib/logger';
import { getUserByEmail } from '../../../utils/database';
import { setSessionCookie } from '../../../lib/session';

// Constant-time compare that never leaks length through an early return.
function secretMatches(given, expected) {
  if (typeof given !== 'string' || typeof expected !== 'string' || !expected) return false;
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { key, email } = req.body || {};

  // An unset secret would make every key wrong and look identical to a typo.
  // Say so plainly — it names the missing variable and leaks no value.
  if (!process.env.API_SHARED_SECRET) {
    return res.status(503).json({ error: 'API_SHARED_SECRET is not set in this environment' });
  }

  if (!secretMatches(key, process.env.API_SHARED_SECRET)) {
    // Same answer for a wrong key and a missing one — nothing to probe.
    return res.status(404).json({ error: 'Not found' });
  }

  const address = (typeof email === 'string' && email.trim()) || process.env.OWNER_EMAIL || '';
  if (!address) {
    return res.status(400).json({ error: 'Pass ?email= or set OWNER_EMAIL' });
  }

  try {
    const user = await getUserByEmail(address.trim().toLowerCase());
    if (!user?.user_id) {
      return res.status(404).json({ error: `No account for ${address}` });
    }

    setSessionCookie(res, { user_id: user.user_id, email: address.trim().toLowerCase() });
    // The form navigates on success; answering with JSON keeps the key out of
    // any redirect URL the host might echo it into.
    return res.status(200).json({ ok: true });
  } catch (err) {
    logger.error('Owner login error:', err.message);
    return res.status(500).json({ error: 'Login failed' });
  }
}
