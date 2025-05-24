// pages/api/write-docs.js
import { generate } from '../../lib/deepseekClient';
import { getKeyAndIndex } from '../../lib/key-manager';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { metadata, tone, outputType = 'cv', language = 'en' } = req.body;

  if (!metadata || !tone || !outputType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const { key, index } = getKeyAndIndex(); // 💡 grab the DeepSeek key like other routes

    const prompt = `Generate a ${tone} ${outputType === 'cv' ? 'CV' : 'cover letter'} in ${language} based on:\n${JSON.stringify(metadata, null, 2)}`;

    const raw = await generate(prompt, key);

    let response = {};
    if (outputType === 'cv') response.cv = raw;
    if (outputType === 'cover') response.cover = raw;

    res.status(200).json({ ...response, _usedKey: key, _keyIndex: index });
  } catch (err) {
    console.error('write-docs error:', err);
    res.status(500).json({ error: 'Failed to generate content', details: err.message });
  }
}
