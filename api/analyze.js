// /api/analyze.js

import crypto from 'crypto';
import { KeyManager } from '../js/key-manager.js';
import { buildCVMetadataExtractionPrompt } from '../js/prompt-builder.js';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with Service Role key
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables.');
}
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'No text provided' });

    const km = new KeyManager();
    const apiKey = km.keys[0];
    if (!apiKey) throw new Error('DeepSeek API key missing');
    console.log('[DeepSeek API] Key index:', km.currentKeyIndex);

    const apiRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
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

    const userId = crypto.randomUUID();

    // Save metadata
    const { error: metaError } = await supabase
      .from('cv_metadata')
      .insert({ user_id: userId, metadata: parsed });

    if (metaError) {
      throw new Error(`Metadata insert error: ${metaError.message}`);
    }

    return res.status(200).json({ userId, metadata: parsed });
  } catch (err) {
    console.error('API analyze error:', err);
    return res.status(500).json({ error: err.message });
  }
}
