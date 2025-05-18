// /api/analyze.js

import crypto from 'crypto';
import { KeyManager } from '../js/key-manager.js';
import { buildCVMetadataExtractionPrompt } from '../js/prompt-builder.js';

const km = new KeyManager();

// Enable JSON body parsing
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

    // parse DeepSeek response
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error('Invalid JSON from DeepSeek');
    }

    // insert user via Supabase   REST API
    const userId = crypto.randomUUID();
    // insert user via Supabase REST API
    const restRes = await fetch(
      'https://ybfvkdxeusgqdwbekcxm.supabase.co/rest/v1/users',
      {
        method: 'POST',
        headers: {
          apikey:        process.env.SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([{
          id:     userId,
          email:  '',      // non-null
          secret: ''       // non-null
        }])
      }
    );
    if (!restRes.ok) {
      const errTxt = await restRes.text();
      throw new Error(`DB insert error ${restRes.status}: ${errTxt}`);
    }


    return res.status(200).json(parsed);
  } catch (err) {
    console.error('API analyze error:', err);
    return res.status(500).json({ error: err.message });
  }
}
