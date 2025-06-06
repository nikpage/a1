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
    const { userId, metadata, coverLetterData, outputType = 'both', tone = 'neutral', rewrittenContent = {} } = req.body;

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
      description: metadata.job_description || '',
    };

    // prepare cover letter details
    const coverData = {
      title: coverLetterData?.title || '',
      company: coverLetterData?.company || '',
      hiringManager: coverLetterData?.hiringManager || '',
      keywords: Array.isArray(coverLetterData?.keywords) ? coverLetterData.keywords : [],
      description: coverLetterData?.description || '',
    };

    // Extract rewritten content
    const professionalSummary = metadata?.rewrittenContent?.['Professional Summary'] ||
                               rewrittenContent?.['Professional Summary'] || '';
    const coreSkills = metadata?.rewrittenContent?.['Core Skills'] ||
                      rewrittenContent?.['Core Skills'] || [];

    // CV only
    if (outputType === 'cv') {
      const prompt = buildCVPrompt(
        cvText,
        jobDetails,
        tone,
        metadata,
        null,
        professionalSummary,
        Array.isArray(coreSkills) ? coreSkills : []
      );

      console.log('CV PROMPT:', prompt);
      const cvResult = await generate(prompt);
      return res.status(200).json({ cv: cvResult });
    }

    // Cover letter only
    if (outputType === 'cover-letter') {
      const prompt = buildCoverLetterPrompt(
        cvText,
        coverData,
        tone,
        metadata
      );

      console.log('COVER LETTER PROMPT:', prompt);
      const coverLetterResult = await generate(prompt);
      return res.status(200).json({ coverLetter: coverLetterResult });
    }

    // Both CV and Cover letter (default case)
    const cvPrompt = buildCVPrompt(
      cvText,
      jobDetails,
      tone,
      metadata,
      null,
      professionalSummary,
      Array.isArray(coreSkills) ? coreSkills : []
    );

    const coverLetterPrompt = buildCoverLetterPrompt(
      cvText,
      coverData,
      tone,
      metadata
    );

    console.log('CV PROMPT:', cvPrompt);
    console.log('COVER LETTER PROMPT:', coverLetterPrompt);

    // Generate both documents
    const [cvResult, coverLetterResult] = await Promise.all([
      generate(cvPrompt),
      generate(coverLetterPrompt)
    ]);

    return res.status(200).json({
      cv: cvResult,
      coverLetter: coverLetterResult
    });

  } catch (error) {
    console.error('Error in write-docs handler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
