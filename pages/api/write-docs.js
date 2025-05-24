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
    let prompt;
    if (outputType === 'cv') {
      prompt = buildCVPrompt(tone, metadata);
    } else if (outputType === 'cover') {
      prompt = buildCoverLetterPrompt(tone, metadata);
    } else {
      return res.status(400).json({ error: 'Invalid outputType. Must be "cv" or "cover".' });
    }

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
