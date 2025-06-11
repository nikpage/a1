// pages/api/generate-documents.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';
import axios from 'axios';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sessionToken, jobAdText } = req.body as {
    sessionToken: string;
    jobAdText?: string;
  };

  if (!sessionToken) {
    return res.status(400).json({ error: 'Missing session token' });
  }

  try {
    // Fetch parsed CV text from DB
    const { data: cvData, error: cvError } = await supabase
      .from('cv_data')
      .select('cv_data')
      .eq('session_token', sessionToken)
      .single();

    if (cvError || !cvData) {
      console.error(cvError);
      return res.status(404).json({ error: 'CV data not found' });
    }

    const parsedCVText = cvData.cv_data;

    // Compose prompt for document generation
    const prompt = jobAdText
      ? `
You will create two professional documents based on the provided CV text and job ad text:

1️⃣ A fully rewritten CV (resume) that:
- Uses clear, concise language
- Follows modern resume formatting best practices
- Integrates relevant skills and experience from the CV
- Incorporates ATS-friendly keywords based on the job ad
- Highlights relevant career level and scenario

2️⃣ A personalized cover letter that:
- Addresses the job ad specifically
- Showcases alignment with the role and company
- Is engaging, concise, and highlights the applicant's fit

CV text:
${parsedCVText}

Job ad text:
${jobAdText}
`
      : `
You will create two professional documents based on the provided CV text:

1️⃣ A fully rewritten CV (resume) that:
- Uses clear, concise language
- Follows modern resume formatting best practices
- Integrates relevant skills and experience from the CV
- Highlights relevant career level and scenario

2️⃣ A general-purpose cover letter that:
- Highlights strengths and adaptability
- Is engaging, concise, and job-ready

CV text:
${parsedCVText}
`;

    // Call DeepSeek (or your chosen LLM)
    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are a professional CV and cover letter writer.' },
          { role: 'user', content: prompt },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
      }
    );

    const generatedContent = response.data.choices[0].message.content;

    // Final success response
    return res.status(200).json({
      message: 'Generated documents successfully',
      generatedContent,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
}
