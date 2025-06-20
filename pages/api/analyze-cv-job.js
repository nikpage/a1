// pages/api/analyze-cv-job.js
import { getCvData, saveGeneratedDoc } from '../../utils/database'
import { analyzeCvJob } from '../../utils/openai'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { user_id, jobText } = req.body
  const fileName = req.body.file_name || 'Unnamed file'

  if (!user_id) {
    return res.status(400).json({ error: 'Missing user_id in request body' })
  }

  try {
    const cv_data = await getCvData(user_id)
    if (!cv_data) {
      return res.status(404).json({ error: 'CV not found for user' })
    }

    const result = await analyzeCvJob(cv_data, jobText, fileName)

    const content =
      result?.choices?.[0]?.message?.content ||
      result?.output ||
      null

    if (!content) {
      return res.status(500).json({ error: 'No analysis content returned by DeepSeek', raw: result })
    }

    // hash logic for lookup compatibility
    const encoder = new TextEncoder()
    const hash = (text) =>
      [...new Uint8Array(encoder.encode(text))].reduce((acc, b) => acc + b, 0)

    const cv_text_hash = hash(cv_data)
    const job_text_hash = jobText ? hash(jobText) : null

    await saveGeneratedDoc({
      user_id,
      source_cv_id: user_id,
      type: 'analysis',
      tone: null,
      company: null,
      job_title: null,
      file_name: null,
      content,
      cv_text_hash,
      job_text_hash
    })

    return res.status(200).json({ analysis: content })
  } catch (e) {
    console.error('ANALYSIS ROUTE ERROR:', e)
    return res.status(500).json({ error: 'Analysis failed', details: e.message || 'unknown' })
  }
}
