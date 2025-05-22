// pages/api/feedback.js
import { buildCVFeedbackPrompt } from '../../lib/prompt-builder';
import { generate } from '../../lib/deepseekClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { metadata, cvBody, prompt } = req.body;
  if (!metadata || !cvBody) {
    return res.status(400).json({ error: 'metadata and cvBody are required' });
  }

  try {
    // Use provided prompt or build from metadata
    const finalPrompt = prompt || buildCVFeedbackPrompt({ metadata, parsedCV: cvBody });
    // Call DeepSeek (our AI service)
    const raw = await generate(finalPrompt);
    let feedback;
    try {
      const parsed = JSON.parse(raw);
      feedback = parsed.feedback || raw;
    } catch {
      feedback = raw;
    }
    return res.status(200).json({ feedback });
  } catch (err) {
    console.error('Feedback API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
