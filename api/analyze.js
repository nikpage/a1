import { KeyManager } from '../js/key-manager.js';
import { buildCVMetadataExtractionPrompt } from '../js/prompt-builder.js';
import crypto from 'crypto';

const km = new KeyManager();

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'No text provided' });

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
    const content = chatJson.choices[0].message.content;

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error('Invalid JSON from DeepSeek');
    }

    // ✅ Respond immediately with metadata
    res.status(200).json(parsed);

    // 🚀 Async DB insert (non-blocking)
    (async () => {
      const userId = crypto.randomUUID();

      // 1. Create user
      const userRes = await fetch('https://ybfvkdxeusgqdwbekcxm.supabase.co/rest/v1/users', {
        method: 'POST',
        headers: {
          apikey:        process.env.SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([{ id: userId, email: null, secret: '' }])
      });

      if (!userRes.ok) {
        console.error(`[DB] Failed to insert user:`, await userRes.text());
        return;
      }

      // 2. Insert metadata
      const metaRes = await fetch('https://ybfvkdxeusgqdwbekcxm.supabase.co/rest/v1/cv_metadata', {
        method: 'POST',
        headers: {
          apikey:        process.env.SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([{
          user_id: userId,
          data: parsed,
          file_url: null // You can update this later when file URL is known
        }])
      });

      if (!metaRes.ok) {
        console.error(`[DB] Failed to insert metadata:`, await metaRes.text());
      }
    })();

  } catch (err) {
    console.error('API analyze error:', err);
    return res.status(500).json({ error: err.message });
  }
}
