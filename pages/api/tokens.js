import { getUser } from '../../utils/database'
import requireAuth from '../../lib/requireAuth'

async function handler(req, res) {
  const { user_id } = req.user
  let user
  try { user = await getUser(user_id) } catch { return res.status(404).json({ error: 'User not found' }) }
  res.status(200).json({ tokens: user.tokens, generations_left: user.generations_left })
}

export default requireAuth(handler)
