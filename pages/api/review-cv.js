// pages/api/review-cv.js

import { buildCVFeedbackPrompt } from '../../lib/prompt-builder';
import { generate } from '../../lib/deepseekClient';
import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  try {
    const { userId, tone = 'neutral', targetIndustry = 'general', country = 'cz', language = 'en' } = req.body;

    // fetch raw CV text
    const { data: inputDoc, error: fetchErr } = await supabase
      .from('document_inputs')
      .select('raw_text')
      .eq('user_id', userId)
      .eq('type', 'cv')
      .limit(1)
      .single();
    if (fetchErr || !inputDoc?.raw_text) {
      return res.status(400).json({ error: 'CV text not found' });
    }

    const cvText = inputDoc.raw_text;

    // build feedback prompt using only CV text
    const prompt = `
${buildCVFeedbackPrompt('cv', targetIndustry, country, language)}

Candidate CV:
${cvText}
`.trim();

    const feedbackResult = await generate(prompt);

    return res.status(200).json({ feedback: feedbackResult });
  } catch (err) {
    console.error('🚨 REVIEW-CV ERROR:', err);
    return res.status(500).json({ error: err.message });
  }
}
