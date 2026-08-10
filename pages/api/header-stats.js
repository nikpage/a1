// path: /pages/api/header-stats.js
import { getUserStats } from '../../utils/database';
import requireAuth from '../../lib/requireAuth';

async function handler(req, res) {
  const { user_id } = req.user;

  try {
    const user = await getUserStats(user_id);
    return res.status(200).json({
      generations: user.generations_left ?? 0,
      // A download is paid for with a free credit first, then a token
      // (consume_download_credit RPC), so the header's "downloads available"
      // is the sum — showing tokens alone hides every free credit.
      downloads: (user.free_downloads_left ?? 0) + (user.tokens ?? 0),
      email: user.email ?? null,
    });
  } catch {
    return res.status(404).json({ error: 'User not found' });
  }
}

export default requireAuth(handler);
