// ===== File: /api/analyze.js =====
import { KeyManager } from '../js/key-manager.js';
const km = new KeyManager();

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  try {
    const { text, documentType } = req.body;
    if (!text) return res.status(400).json({ error: 'No text provided' });
    const apiKey = km.keys[0];
    if (!apiKey) throw new Error('API key missing');

    // DeepSeek Chat Completions API
    const apiRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are a CV review assistant. Output JSON with key "feedback".' },
          { role: 'user', content: text }
        ],
        response_format: { type: 'json_object' }
      })
    });
    if (!apiRes.ok) {
      const errTxt = await apiRes.text();
      throw new Error(`DeepSeek error ${apiRes.status}: ${errTxt}`);
    }
    const chatJson = await apiRes.json();
    const content = chatJson.choices[0].message.content;
    let parsed;
    try { parsed = JSON.parse(content); } catch { throw new Error('Invalid JSON from DeepSeek'); }
    const feedback = parsed.feedback;
    if (!feedback) throw new Error('No feedback received');
    return res.status(200).json({ feedback });
  } catch (err) {
    console.error('API analyze error:', err);
    return res.status(500).json({ error: err.message });
  }
}
