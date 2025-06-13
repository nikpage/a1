// pages/api/generate-documents.ts
import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '../../lib/supabase'
import { callDeepSeek } from '../../lib/deepseek'
import { extractTextFromPDF } from '../../lib/pdf-parser'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { sessionToken, analysis, jobAd } = req.body

    // Get CV data
    const { data: cvData, error: cvError } = await supabaseAdmin
      .from('cv_data')
      .select('cv_file_url')
      .eq('session_token', sessionToken)
      .single()

    if (cvError || !cvData) {
      return res.status(400).json({ error: 'CV data not found' })
    }

    // Download and extract text from PDF
    const cvResponse = await fetch(cvData.cv_file_url)
    const cvBuffer = Buffer.from(await cvResponse.arrayBuffer())
    const originalCvText = await extractTextFromPDF(cvBuffer)

    // Generate optimized CV
    const cvSystemPrompt = `You are a professional CV writer. Based on the original CV content and analysis recommendations, create an optimized version that:
1. Maintains all factual information from the original CV
2. Improves formatting and structure
3. Incorporates ATS-friendly keywords
4. Addresses identified gaps where possible
5. Enhances impact statements with quantifiable results where available

Return only the optimized CV content, properly formatted and ready to use.`

    const cvUserPrompt = `Original CV:\n${originalCvText}\n\nAnalysis Recommendations:\n${JSON.stringify(analysis, null, 2)}\n\n${jobAd ? `Target Job:\n${jobAd}` : ''}`

    const optimizedCv = await callDeepSeek([
      { role: 'system', content: cvSystemPrompt },
      { role: 'user', content: cvUserPrompt }
    ])

    // Generate cover letter
    const clSystemPrompt = `You are a professional cover letter writer. Create a compelling cover letter that:
1. Addresses the specific role and company (if job ad provided)
2. Highlights key strengths from the CV analysis
3. Shows enthusiasm and fit for the position
4. Maintains a professional yet personable tone
5. Is concise and impactful (3-4 paragraphs)

Return only the cover letter content, properly formatted.`

    const clUserPrompt = `CV Analysis:\n${JSON.stringify(analysis, null, 2)}\n\nOriginal CV Context:\n${originalCvText}\n\n${jobAd ? `Target Job:\n${jobAd}` : 'Generic cover letter - no specific job provided.'}`

    const coverLetter = await callDeepSeek([
      { role: 'system', content: clSystemPrompt },
      { role: 'user', content: clUserPrompt }
    ])

    res.status(200).json({
      documents: {
        optimized_cv: optimizedCv,
        cover_letter: coverLetter
      }
    })
  } catch (error) {
    console.error('Document generation error:', error)
    res.status(500).json({ error: 'Document generation failed' })
  }
}
