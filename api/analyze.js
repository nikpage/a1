// /api/analyze.js
import { KeyManager } from '../js/key-manager.js';
import { buildCVMetadataExtractionPrompt } from '../js/prompt-builder.js';

const km = new KeyManager();

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { text, userId } = req.body;
    if (!text || !userId) {
      return res.status(400).json({ error: 'Missing text or userId' });
    }

    const apiKey = km.keys[0];
    console.log('[DeepSeek API] Using Key index:', km.currentKeyIndex);
    if (!apiKey) throw new Error('API key missing');

    const apiRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'user', content: buildCVMetadataExtractionPrompt(text) }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!apiRes.ok) {
      const errTxt = await apiRes.text();
      throw new Error(`DeepSeek error ${apiRes.status}: ${errTxt}`);
    }

    const chatJson = await apiRes.json();
    let parsed;
    try {
      parsed = JSON.parse(chatJson.choices[0].message.content);
    } catch {
      throw new Error('Invalid JSON from DeepSeek');
    }

    // ✅ Return only metadata immediately
    res.status(200).json(parsed);

    // 🛠️ Forward persistence to api/db.js in background
    setImmediate(() => {
      fetch(`${req.headers.origin}/api/db`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, metadata: parsed, cv_body: text })
      }).catch(e => console.error('[DB Forward Error]', e));
    });

  } catch (err) {
    console.error('API analyze error:', err);
    return res.status(500).json({ error: err.message });
  }
}
