// pages/api/write-docs.js
import { buildCVPrompt, buildCoverLetterPrompt } from '../../lib/prompt-builder';
import { getDocuments } from '../../lib/deepseekClient'; // you’ll need a helper to send prompts
import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow','POST');
    return res.status(405).end();
  }
  const { metadata, tone, language, output } = req.body;
  const docResults = {};

  try {
    if (output === 'cv' || output === 'both') {
      const cvPrompt = buildCVPrompt(tone.toLowerCase(), metadata);
      docResults.cv = await getDocuments(cvPrompt, language);
    }
    if (output === 'cover' || output === 'both') {
      const coverPrompt = buildCoverLetterPrompt(tone.toLowerCase(), metadata);
      docResults.cover = await getDocuments(coverPrompt, language);
    }
    // Optionally: persist in Supabase here…

    return res.status(200).json(docResults);
  } catch (err) {
    console.error('write-docs error', err);
    return res.status(500).json({ error: err.message });
  }
}
