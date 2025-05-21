// pages/api/cv-metadata.js
import { extractMetadata } from '../../lib/deepseekClient';

export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Only POST allowed' });

  const { textChunks, userId } = req.body;
  if (!Array.isArray(textChunks)) {
    return res.status(400).json({ error: 'No textChunks array provided' });
  }
  try {
    // join chunks for one prompt
    const metadata = await extractMetadata(textChunks.join('\n\n'));
    res.status(200).json(metadata);
  } catch (e) {
    console.error('DeepSeek metadata error', e);
    res.status(500).json({ error: e.message });
  }
}
