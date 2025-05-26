// pages/api/write-docs.js

import { buildCVPrompt, buildCoverLetterPrompt } from '../../lib/prompt-builder';
import { generate } from '../../lib/deepseekClient';
import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  try {
    const { userId, metadata, coverLetterData, outputType = 'both', tone = 'neutral' } = req.body;

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

    // prepare job details
    const jobDetails = {
      title: metadata.current_role || '',
      company: metadata.primary_company || '',
      keywords: Array.isArray(metadata.skills) ? metadata.skills : [],
    };

    // prepare cover letter details
    const coverData = {
      title: coverLetterData?.title || '',
      company: coverLetterData?.company || '',
      hiringManager: coverLetterData?.hiringManager || '',
      keywords: Array.isArray(coverLetterData?.keywords) ? coverLetterData.keywords : [],
    };

    // CV only
    if (outputType === 'cv') {
      const prompt = buildCVPrompt(tone, jobDetails, cvText);
      const cvResult = await generate(prompt);
      return res.status(200).json({ cv: cvResult });
    }

    // Cover letter only
    if (outputType === 'cover') {
      const prompt = buildCoverLetterPrompt(tone, coverData, cvText);
      const coverResult = await generate(prompt);
      return res.status(200).json({ coverLetter: coverResult });
    }

    // Both CV and Cover letter
    const [cvResult, coverResult] = await Promise.all([
      generate(buildCVPrompt(tone, jobDetails, cvText)),
      generate(buildCoverLetterPrompt(tone, coverData, cvText)),
    ]);

    return res.status(200).json({
      cv: cvResult,
      coverLetter: coverResult,
    });
  } catch (err) {
    console.error('🚨 WRITE-DOCS ERROR:', err);
    return res.status(500).json({ error: err.message });
  }
}
