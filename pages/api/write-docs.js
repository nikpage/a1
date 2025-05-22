// pages/api/write-docs.js
import { buildCVPrompt, buildCoverLetterPrompt } from '../../lib/prompt-builder';
import { generate } from '../../lib/deepseekClient';
import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const { metadata, cv, tone, language, outputType } = req.body;
  const docResults = {};

  try {
    if (outputType === 'cv' || outputType === 'both') {
      const jobDetails = {
        ...metadata,
        ...cv?.data,
        keywords: Array.isArray(metadata.keywords) ? metadata.keywords : [],
      };
      const cvPrompt = buildCVPrompt(tone.toLowerCase(), jobDetails);
      docResults.cv = await generate(cvPrompt);
    }

    if (outputType === 'cover' || outputType === 'both') {
      const jobDetails = {
        ...metadata,
        ...cv?.data,
        keywords: Array.isArray(metadata.keywords) ? metadata.keywords : [],
      };
      const coverPrompt = buildCoverLetterPrompt(tone.toLowerCase(), jobDetails);
      docResults.cover = await generate(coverPrompt);
    }

    return res.status(200).json(docResults);
  } catch (err) {
    console.error('write-docs error', err);
    return res.status(500).json({ error: err.message });
  }
}
