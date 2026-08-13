// path: pages/api/get-docs.js
//
// The user's generated CVs and cover letters, restored into the viewer on load.
// Returns the FULL run of versions (oldest first), not just the latest: the
// viewer keeps a version history with prev/next, and returning only the newest
// meant a reload silently threw away every earlier version the user had not
// downloaded yet.
//
// The query itself lives in utils/database.js — no DB access in route files.
// user_id comes from the verified session cookie, never the body.
import { getGeneratedDocs } from '../../utils/database';
import { logger } from '../../lib/logger';
import requireAuth from '../../lib/requireAuth';

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const docs = await getGeneratedDocs(req.user.user_id);
    return res.status(200).json({
      cv: docs.filter((d) => d.type === 'cv').map((d) => d.content),
      cover: docs.filter((d) => d.type === 'cover').map((d) => d.content),
    });
  } catch (err) {
    logger.error('[get-docs] read error:', err.message);
    return res.status(500).json({ error: 'Database query failed' });
  }
}

export default requireAuth(handler);
