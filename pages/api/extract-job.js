import requireAuth from '../../lib/requireAuth';
import { analyzeJobOnly } from '../../utils/openai';

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobText } = req.body || {};
  if (!jobText || !String(jobText).trim()) {
    return res.status(400).json({ error: 'Missing jobText' });
  }

  try {
    const { output, gemini_usage } = await analyzeJobOnly(String(jobText));
    return res.status(200).json({ extraction: output, gemini_usage });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Extraction failed' });
  }
}

export default requireAuth(handler);
