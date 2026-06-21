import requireAuth from '../../lib/requireAuth';
import { deleteUserData } from '../../utils/database';

async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
  const { user_id } = req.user;
  await deleteUserData(user_id);
  res.setHeader('Set-Cookie', 'auth-token=; Max-Age=0; Path=/; HttpOnly');
  return res.status(200).json({ deleted: true });
}

export default requireAuth(handler);
