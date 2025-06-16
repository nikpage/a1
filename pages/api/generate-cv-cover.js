// pages/api/generate-cv-cover.js
import { getCVData, getUser, decrementToken } from '../../utils/database'
import { generateCVAndCover } from '../../utils/openai'

export default async function handler(req, res) {
  console.log('---- API REQUEST BODY ----', req.body)
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { user_id, jobText } = req.body
  if (!user_id || !jobText) return res.status(400).json({ error: 'Missing fields' })
  let user
  try { user = await getUser(user_id) } catch { return res.status(404).json({ error: 'User not found' }) }
  if (user.tokens < 1) return res.status(403).json({ error: 'No tokens' })
  let cv
  try { cv = await getCVData(user_id) } catch { return res.status(404).json({ error: 'CV not found' }) }
  let docs
  try { docs = await generateCVAndCover(cv.cv_data, jobText) } catch (err) {
    console.error('DeepSeek error:', err)
    return res.status(500).json({ error: 'DeepSeek error' })
  }
  try { await decrementToken(user_id) } catch { return res.status(500).json({ error: 'Token error' }) }
  res.status(200).json({ docs })
}

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err)
})
