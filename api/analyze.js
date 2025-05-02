// ===== File: /api/analyze.js =====
import { KeyManager } from '../js/key-manager.js';
const km = new KeyManager();

// Enable JSON parsing
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

    const apiRes = await fetch('https://api.deepseek.io/v1/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ text, documentType })
    });

    if (!apiRes.ok) {
      const errTxt = await apiRes.text();
      throw new Error(`DeepSeek error ${apiRes.status}: ${errTxt}`);
    }

    const { feedback, usage } = await apiRes.json();
    km.trackUsage(usage);
    return res.status(200).json({ feedback });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
