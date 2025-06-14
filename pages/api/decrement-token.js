// pages/api/decrement-token.js
import { decrementToken, getUser } from '../../utils/database'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { user_id } = req.body
  if (!user_id) return res.status(400).json({ error: 'Missing user_id' })
  try { await decrementToken(user_id) } catch { return res.status(500).json({ error: 'Token error' }) }
  let user
  try { user = await getUser(user_id) } catch { return res.status(404).json({ error: 'User not found' }) }
  res.status(200).json({ tokens: user.tokens })
}
