// path: pages/api/get-cvs.js
import { getCvList } from '../../utils/database';
import requireAuth from '../../lib/requireAuth';

async function handler(req, res) {
  const { user_id } = req.user;

  try {
    const data = await getCvList(user_id);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export default requireAuth(handler);
