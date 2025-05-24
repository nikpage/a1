// pages/api/write-docs.js
import { supabase } from '../../lib/supabase';
import { generate } from '../../lib/deepseekClient';
import {
  buildCVPrompt,
  buildCoverLetterPrompt,
} from '../../lib/prompt-builder';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { metadata, tone = 'neutral', language = 'en', outputType = 'both' } = req.body;

  if (!metadata) {
    return res.status(400).json({ error: 'Missing metadata' });
  }

  try {
    const promptOptions = { metadata, tone, language };
    const response = {};

    if (outputType === 'cv' || outputType === 'both') {
      const cvPrompt = buildCVPrompt(promptOptions);
      response.cv = await generate(cvPrompt);
    }

    if (outputType === 'cover' || outputType === 'both') {
      const coverPrompt = buildCoverLetterPrompt(promptOptions);
      response.cover = await generate(coverPrompt);
    }

    // Save feedback to DB
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('secret', metadata.secret)
      .single();

    if (user) {
      const { data: cvMeta } = await supabase
        .from('cv_metadata')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cvMeta) {
        await supabase.from('cv_feedback').insert({
          cv_metadata_id: cvMeta.id,
          feedback: response,
        });
      }
    }

    return res.status(200).json(response);
  } catch (err) {
    console.error('Error in write-docs:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
