// pages/api/auth/verify.js
import { logger } from '../../../lib/logger';
import { getMagicToken, deleteMagicToken } from '../../../utils/database';
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

    setSessionCookie(res, { user_id: tokenData.user_id, email: tokenData.email });

    res.redirect(302, `/${tokenData.user_id}`);
  } catch (err) {
    logger.error('Verify error:', err.message);
    res.redirect(302, '/?error=login-failed');
  }
}
