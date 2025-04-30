// /api/extract.js

import { buildExtractionPrompt } from '../../js/prompt-builder.js';
import { DeepSeekClient } from 'deepseek'; // assumes installed + configured
import { getUID } from '../../utils/auth.js'; // custom util for user ID auth

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  try {
    const { input } = req.body;
    const uid = getUID(req);
    if (!uid || !input) return res.status(400).json({ error: 'Missing uid or input' });

    const prompt = buildExtractionPrompt() + "\n\n" + input;

    const client = new DeepSeekClient(process.env.DEEPSEEK_API_KEY);
    const result = await client.chat({ prompt });

    const match = result.match(/\{.*\}/s);
    if (!match) return res.status(500).json({ error: 'Invalid JSON output' });

    const jobDetails = JSON.parse(match[0]);
    res.status(200).json(jobDetails);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Extraction failed' });
  }
}
