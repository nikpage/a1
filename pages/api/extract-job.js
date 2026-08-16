import requireAuth from '../../lib/requireAuth';
import { analyzeJobOnly } from '../../utils/openai';
import { runWithAiContext } from '../../utils/ai-meter';

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobText } = req.body || {};
  if (!jobText || !String(jobText).trim()) {
    return res.status(400).json({ error: 'Missing jobText' });
  }

  // The extraction call is recorded by the meter inside callGemini, attributed
  // to this user through the context — including a call that then fails to
  // parse, which the old post-hoc log here never saw.
  return runWithAiContext({ user_id: req.user.user_id, context: 'api:extract-job' }, async () => {
    try {
      const { output, gemini_usage } = await analyzeJobOnly(String(jobText));
      return res.status(200).json({ extraction: output, gemini_usage });
    } catch (e) {
      return res.status(500).json({ error: e.message || 'Extraction failed' });
    }
  });
}

export default requireAuth(handler);
