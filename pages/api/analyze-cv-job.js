// pages/api/analyze-cv-job.js


console.log('ENV VARS CHECK:', {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
})


import { getCVData } from '../../utils/database'
import { analyzeCV } from '../../utils/openai'

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const { user_id, jobText } = req.body
    if (!user_id) return res.status(400).json({ error: 'Missing user_id' })

    let cv
    try {
      cv = await getCVData(user_id)
    } catch (e) {
      return res.status(404).json({ error: 'CV not found', details: String(e) })
    }

    let result
    try {
      result = await analyzeCV(cv.cv_data, jobText || '')
    } catch (e) {
      return res.status(500).json({ error: 'DeepSeek error', details: String(e) })
    }

    console.log('DS RAW RESPONSE:', result)
    const choices = result.choices || result.data?.choices
    const content = choices?.[0]?.messaconsole.log('ENV VARS CHECK:', {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
})
ge?.content || result.output || JSON.stringify(result)
    if (!content) {
      return res.status(500).json({ error: 'No analysis content returned by DeepSeek', raw: result })
    }

    res.status(200).json({ analysis: content })
  } catch (e) {
    res.status(500).json({ error: 'Unexpected error', details: String(e) })
  }
}
