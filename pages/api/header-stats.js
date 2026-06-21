// path: /pages/api/header-stats.js
import { getUserStats } from '../../utils/database';
import requireAuth from '../../lib/requireAuth';

async function handler(req, res) {
  const { user_id } = req.user;

  try {
    const user = await getUserStats(user_id);
    return res.status(200).json({
      generations: user.generations_left ?? 0,
      downloads: user.tokens ?? 0,
      email: user.email ?? null,
    });
  } catch {
    return res.status(404).json({ error: 'User not found' });
  }
}

export default requireAuth(handler);
