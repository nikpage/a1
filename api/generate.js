// /api/generate.js

export default async function handler(req, res) {
  console.log('Received fileContent:', req.body.fileContent);

import { buildCVPrompt, buildCoverLetterPrompt } from '../../js/prompt-builder.js';
import { DeepSeekClient } from 'deepseek';
import { getUID, requireVerified } from '../../utils/auth.js';
import { logGeneration, deductTokens } from '../../utils/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  try {
    const { fileContent, jobDetails, tone, docType, lang } = req.body;
    const uid = getUID(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    await requireVerified(uid);

    const prompts = [];
    if (docType === 'cv' || docType === 'both') {
      prompts.push({ type: 'cv', prompt: buildCVPrompt(tone, jobDetails) + "\n\n" + fileContent });
    }
    if (docType === 'cover' || docType === 'both') {
      prompts.push({ type: 'cover', prompt: buildCoverLetterPrompt(tone, jobDetails) + "\n\n" + fileContent });
    }

    const client = new DeepSeekClient(process.env.DEEPSEEK_API_KEY);
    const outputs = {};

    for (const { type, prompt } of prompts) {
      const response = await client.chat({ prompt });
      outputs[type] = response.trim();
    }

    const usedTokens = JSON.stringify(outputs).length / 4;
    await deductTokens(uid, usedTokens);
    await logGeneration(uid, jobDetails, docType, tone, lang, usedTokens);

    res.status(200).json(outputs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Generation failed' });
  }
}
