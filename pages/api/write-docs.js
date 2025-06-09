// pages/api/write-docs.js

import { buildCVPrompt, buildCoverLetterPrompt, buildToneRewritePrompt } from '../../lib/prompt-builder';
import { generate } from '../../lib/deepseekClient';
import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  try {
    const { userId, coverLetterData, outputType = 'both', tone = 'neutral' } = req.body;

    // LOG step 1
    console.log('[write-docs] userId:', userId);

    const { data: metaRow, error: metaErr } = await supabase
      .from('job_metadata')
      .select('data')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (metaErr || !metaRow?.data) {
      console.error('[write-docs] No metadata found for user:', metaErr);
      return res.status(400).json({ error: 'No metadata found for user' });
    }

    // Fix: Look for data in the correct nested structure
    const summaryRaw = metaRow.data.rewrittenContent?.['Professional Summary'] || metaRow.data['Professional Summary'] || '';
    const coreSkillsRaw = metaRow.data.rewrittenContent?.['Core Skills'] || metaRow.data['Core Skills'] || [];

    if (!summaryRaw || !coreSkillsRaw.length) {
      console.error('[write-docs] Professional Summary or Core Skills missing:', summaryRaw, coreSkillsRaw);
      return res.status(400).json({ error: 'Professional Summary or Core Skills missing.' });
    }

    const combinedText = `Professional Summary: ${summaryRaw}\n\nCore Skills: ${coreSkillsRaw.join(', ')}`;
    const tonePrompt = buildToneRewritePrompt(combinedText, tone);
    console.log('[write-docs] Tone Prompt:', tonePrompt);

    const toneRewriteDS = await generate(tonePrompt);

    const tonedResult = toneRewriteDS?.choices?.[0]?.message?.content?.trim() || '';
    let [tonedSummary, tonedCoreSkills] = tonedResult.split('Core Skills:').map(s => s.trim());

    if (!tonedSummary || !tonedCoreSkills) {
      console.error('[write-docs] Invalid tone rewrite LLM output:', tonedResult);
      return res.status(400).json({ error: 'LLM output missing summary or skills.' });
    }

    const finalTonedSummary = tonedSummary.replace(/^Professional Summary:/i, '').trim();
    const finalTonedSkills = tonedCoreSkills;

    // LOG step 2
    console.log('[write-docs] finalTonedSummary:', finalTonedSummary);
    console.log('[write-docs] finalTonedSkills:', finalTonedSkills);

    const { data: inputDoc, error: fetchErr } = await supabase
      .from('document_inputs')
      .select('raw_text')
      .eq('user_id', userId)
      .eq('type', 'cv')
      .limit(1)
      .single();

    if (fetchErr || !inputDoc?.raw_text) {
      console.error('[write-docs] CV text not found:', fetchErr);
      return res.status(400).json({ error: 'CV text not found' });
    }

    const cvText = inputDoc.raw_text;
    if (!cvText) {
      console.error('[write-docs] Empty CV text.');
      return res.status(400).json({ error: 'CV text is empty.' });
    }

    // LOG step 3
    console.log('[write-docs] cvText length:', cvText.length);

    const jobDetails = {
      title: metaRow.data?.current_role || '',
      company: metaRow.data?.primary_company || '',
      keywords: Array.isArray(metaRow.data?.skills) ? metaRow.data.skills : [],
      description: metaRow.data?.job_description || '',
      summary: finalTonedSummary,
      coreSkills: finalTonedSkills,
    };

    const coverData = {
      title: coverLetterData?.title || '',
      company: coverLetterData?.company || '',
      hiringManager: coverLetterData?.hiringManager || '',
      keywords: Array.isArray(coverLetterData?.keywords) ? coverLetterData.keywords : [],
      description: coverLetterData?.description || '',
    };

    async function buildCvFinal() {
      const cvPrompt = buildCVPrompt(cvText, jobDetails, tone, metaRow.data, null, null, null);
      console.log('[write-docs] CV Prompt:', cvPrompt);

      const cvLLMResult = await generate(cvPrompt);
      const cvTextOutRaw = cvLLMResult?.choices?.[0]?.message?.content?.trim() || '';

      if (!cvTextOutRaw) {
        console.error('[write-docs] LLM failed to generate CV text.');
        throw new Error('LLM failed to generate CV.');
      }

      return cvTextOutRaw
        .replace('<<SUMMARY_PLACEHOLDER>>', finalTonedSummary)
        .replace('<<CORE_SKILLS_PLACEHOLDER>>', finalTonedSkills);
    }

    if (outputType === 'cv') {
      const cvOut = await buildCvFinal();
      return res.status(200).json({ cv: cvOut });
    }

    if (outputType === 'cover-letter') {
      const prompt = buildCoverLetterPrompt(cvText, coverData, tone, metaRow.data);
      console.log('[write-docs] Cover Letter Prompt:', prompt);

      const coverLetterResult = await generate(prompt);
      const coverLetterOut = coverLetterResult?.choices?.[0]?.message?.content?.trim() || '';
      if (!coverLetterOut) {
        console.error('[write-docs] LLM failed to generate cover letter.');
        throw new Error('LLM failed to generate cover letter.');
      }
      return res.status(200).json({ coverLetter: coverLetterOut });
    }

    const [cvOut, coverLetterOut] = await Promise.all([
      buildCvFinal(),
      (async () => {
        const prompt = buildCoverLetterPrompt(cvText, coverData, tone, metaRow.data);
        console.log('[write-docs] Cover Letter Prompt:', prompt);

        const result = await generate(prompt);
        return result?.choices?.[0]?.message?.content?.trim() || '';
      })()
    ]);
    const { data: cvData, error: cvErr } = await supabase
      .from('document_inputs')
      .select('raw_text, content')
      .eq('user_id', userId)
      .eq('type', 'cv')
      .limit(1)
      .single();

    if (!cvErr && cvData) {
      const cvText = cvData.raw_text;
      const metadata = cvData.content?.cv || {};

      const deepSeekResult = await generateForCV(cvText, metadata);
      console.log('DeepSeek response:', deepSeekResult);
    }
    return res.status(200).json({ cv: cvOut, coverLetter: coverLetterOut });
  } catch (error) {
    console.error('Error in write-docs handler:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
