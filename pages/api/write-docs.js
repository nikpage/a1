// pages/api/write-docs.js
import { generate } from '../../lib/deepseekClient';
import * as KeyManager from '../../lib/key-manager';
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
    const { key, index } = KeyManager.getKeyAndIndex();

    let prompt;
    if (outputType === 'cv') {
      prompt = buildCVPrompt(tone, metadata);
    } else if (outputType === 'cover') {
      prompt = buildCoverLetterPrompt(tone, metadata);
    } else {
      return res.status(400).json({ error: 'Invalid outputType. Must be "cv" or "cover".' });
    }

    const raw = await generate(prompt, key);

    res.status(200).json({
      [outputType]: raw,
      _usedKey: key,
      _keyIndex: index
    });
  } catch (err) {
    console.error('write-docs error:', err);
    res.status(500).json({
      error: 'Failed to generate content',
      details: err.message
    });
  }
}
