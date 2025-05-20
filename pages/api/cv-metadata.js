// pages/api/cv-metadata.js
import { extractMetadata } from '../../lib/deepseekClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const { text, userId } = req.body;
  try {
    const metadata = await extractMetadata(text);
    res.status(200).json(metadata);
  } catch (error) {
    console.error('DeepSeek metadata error:', error);
    res.status(500).json({ error: error.message });
  }
}
