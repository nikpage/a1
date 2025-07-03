import { getUser } from '../../utils/database'

export default async function handler(req, res) {
  const { user_id } = req.query
  if (!user_id) return res.status(400).json({ error: 'Missing user_id' })
  let user
  try { user = await getUser(user_id) } catch { return res.status(404).json({ error: 'User not found' }) }
  res.status(200).json({ tokens: user.tokens, generations_left: user.generations_left })
}
