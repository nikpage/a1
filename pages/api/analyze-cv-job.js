// pages/api/analyze-cv-job.js
import { getCVData } from '../../utils/database'
import { analyzeCV } from '../../utils/openai'

export default async function handler(req, res) {
  try {
    console.log('---- API REQUEST BODY ----', req.body)
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    const { user_id, jobText } = req.body
    if (!user_id) return res.status(400).json({ error: 'Missing user_id' })
    let cv
    try {
      cv = await getCVData(user_id)
    } catch (e) {
      console.error('CV NOT FOUND ERROR:', e)
      return res.status(404).json({ error: 'CV not found', details: String(e) })
    }
    let result
    try {
      result = await analyzeCV(cv.cv_data, jobText || '')
    } catch (e) {
      console.error('DEEPSEEK ERROR:', e)
      return res.status(500).json({ error: 'DeepSeek error', details: String(e) })
    }
    res.status(200).json({ analysis: result })
  } catch (e) {
    console.error('UNEXPECTED ERROR:', e)
    res.status(500).json({ error: 'Unexpected error', details: String(e) })
  }
}

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err)
})
