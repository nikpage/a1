// pages/api/write-docs.js
import { generate } from '../../lib/deepseekClient';
import {
  buildCVPrompt,
  buildCoverLetterPrompt
} from '../../lib/prompt-builder';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { metadata, tone = 'neutral', outputType = 'cv', language = 'en' } = req.body;

  if (!metadata || !tone || !outputType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    console.log('📩 INPUT:', { metadata, tone, outputType, language });

    const jobDetails = {
      title: metadata?.title || metadata?.current_role || '',
      company: metadata?.company || metadata?.primary_company || '',
      keywords: Array.isArray(metadata?.skills) ? metadata.skills.slice(0, 8) : []
    };

    let prompt;
    if (outputType === 'cv') {
      prompt = buildCVPrompt(tone, jobDetails);
    } else if (outputType === 'cover') {
      prompt = buildCoverLetterPrompt(tone, jobDetails);
    } else {
      return res.status(400).json({ error: 'Invalid outputType. Must be "cv" or "cover".' });
    }

    console.log('🧠 Prompt to DeepSeek:', prompt);

    const result = await generate(prompt);

    res.status(200).json({
      [outputType]: result.choices?.[0]?.message?.content || result,
      _usedKey: result._usedKey,
      _keyIndex: result._keyIndex
    });
  } catch (err) {
    console.error('write-docs error:', err);
    res.status(500).json({
      error: 'Failed to generate content',
      details: err.message
    });
  }
}
