// pages/api/analyze-cv.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { callDeepSeek } from '../../lib/deepseek'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Build messages array for DeepSeek
    const { sessionToken, jobAd } = req.body
    if (!sessionToken) {
      return res.status(400).json({ error: 'Missing sessionToken' })
    }
    const messages = [
      { role: 'system', content: 'You are an expert CV reviewer. Reply ONLY with a valid JSON object for analysis. No text, markdown, or comments.' },
      { role: 'user', content: `SessionToken: ${sessionToken}. JobAd: ${jobAd || ''}` }
    ]


    const dsRaw = await callDeepSeek(messages)
    console.error('[DeepSeek RAW]', dsRaw.body)
    const ds = JSON.parse(dsRaw.body)
    const rawContent = ds.choices[0].message.content
    const clean = rawContent.replace(/```json|```/g, '').trim()
    try {
      const analysis = JSON.parse(clean)
      return res.status(200).json(analysis)
    } catch (e) {
      console.error('Returned text is not valid JSON:', clean)
      return res.status(500).json({ error: 'AI did not return valid JSON' })
    }

  } catch (error: any) {
    console.error('[AnalyzeCV] Error:', error)
    return res.status(500).json({ error: 'Analysis failed' })
  }
}
