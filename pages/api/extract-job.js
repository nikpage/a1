import requireAuth from '../../lib/requireAuth';
import { analyzeJobOnly } from '../../utils/openai';
import { logAiTransaction } from '../../utils/database';

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
    logAiTransaction({
      user_id: req.user.user_id,
      model: gemini_usage.model,
      cache_miss_tokens: gemini_usage.inputTokens,
      cache_hit_tokens: 0,
      completion_tokens: gemini_usage.outputTokens + gemini_usage.thinkingTokens,
      thinking_tokens: gemini_usage.thinkingTokens,
      detail: { type: 'job_extraction' },
    }).catch(() => {});
    return res.status(200).json({ extraction: output, gemini_usage });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Extraction failed' });
  }
}

export default requireAuth(handler);
