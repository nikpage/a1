// lib/requireAuth.js

import { getTokenFromReq, verifyToken } from './auth';

export default function requireAuth(handler) {
  return async (req, res) => {
    const token = getTokenFromReq(req);

    if (!token) {
      return res.status(401).json({ error: 'Authentication token missing.' });
    }

    const sessionData = await verifyToken(token);

    if (!sessionData || !sessionData.user_id) {
      return res.status(401).json({ error: 'Invalid or expired session.' });
    }

    req.user = sessionData;

    return handler(req, res);
  };
}
