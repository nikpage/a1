import { KeyManager } from '../js/key-manager.js';
import { buildCVPrompt, buildCoverLetterPrompt } from '../js/prompt-builder.js';

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { parsedCV, jobMeta, tone, feedback } = req.body;
    if (!parsedCV || !jobMeta || !tone) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const km = new KeyManager();
    const apiKey = km.keys[km.currentKeyIndex];
    if (!apiKey) throw new Error('API key missing');

    // Generate CV
    const cvRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: buildCVPrompt(parsedCV, jobMeta, tone, feedback) }
        ],
        response_format: { type: 'text' }
      })
    });
    if (!cvRes.ok) {
      const err = await cvRes.text();
      throw new Error(`DeepSeek CV error ${cvRes.status}: ${err}`);
    }
    const cvHTML = await cvRes.text();

    // Generate Cover Letter
    const clRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: buildCoverLetterPrompt(parsedCV, jobMeta, tone, feedback) }
        ],
        response_format: { type: 'text' }
      })
    });
    if (!clRes.ok) {
      const err = await clRes.text();
      throw new Error(`DeepSeek Cover Letter error ${clRes.status}: ${err}`);
    }
    const coverLetterHTML = await clRes.text();

    return res.status(200).json({ cvHTML, coverLetterHTML });
  } catch (err) {
    console.error('API build-docs error:', err);
    return res.status(500).json({ error: err.message });
  }
}
