// pages/api/auth/verify.js
import { logger } from '../../../lib/logger';
import { getMagicToken, deleteMagicToken, getUserByEmail, updateUserEmail } from '../../../utils/database';
import { setSessionCookie } from '../../../lib/session';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'missing-token' });
  }

  try {
    const tokenData = await getMagicToken(token);

    if (!tokenData) {
      res.redirect(302, '/?error=login-failed');
      return;
    }

    await deleteMagicToken(token);

    // The token row's user_id is a snapshot from when the link was minted, and
    // it can be stale by the time the link is clicked — the account may since
    // have been consolidated, or its email retired as a duplicate. Logging that
    // id in lands the user in an orphan row with none of their history. The
    // EMAIL is the durable identity, so resolve it to the canonical account
    // (oldest wins, same rule as everywhere else) and fall back to the token's
    // id only when the address has no account at all — in which case make sure
    // the row genuinely exists rather than issuing a session for a phantom.
    const canonical = await getUserByEmail(tokenData.email);
    let user_id = canonical?.user_id;
    if (!user_id) {
      const row = await updateUserEmail(tokenData.user_id, tokenData.email);
      user_id = row?.user_id || tokenData.user_id;
    }

    setSessionCookie(res, { user_id, email: tokenData.email });

    res.redirect(302, `/${user_id}`);
  } catch (err) {
    logger.error('Verify error:', err.message);
    res.redirect(302, '/?error=login-failed');
  }
}
