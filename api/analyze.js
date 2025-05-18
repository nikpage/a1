// pages/api/analyze.js

import { KeyManager } from '../js/key-manager.js';
import { buildCVMetadataExtractionPrompt } from '../js/prompt-builder.js';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
const km = new KeyManager();

// Enable JSON body parsing
export const config = { api: { bodyParser: true } };

// Supabase (service-role) client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // 0. Secret check (nice-to-have)
  if (process.env.API_SHARED_SECRET) {
    if (req.headers['x-api-secret'] !== process.env.API_SHARED_SECRET) {
      return res.status(401).json({ error: 'Unauthorized: bad or missing secret' });
    }
  }

  // 1. Only POST
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

    // 2. Call DeepSeek
    const apiRes = await fetch(
      'https://api.deepseek.com/chat/completions',
      {
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
      }
    );
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

    // 3. Insert into Supabase
    const userId = crypto.randomUUID();
    const { error: userErr } = await supabase
      .from('users')
      .insert({ id: userId, email: null });
    if (userErr) throw userErr;

    const { data: metaRows, error: metaErr } = await supabase
      .from('cv_metadata')
      .insert({
        user_id: userId,
        file_url: parsed.fileUrl ?? null,
        data: parsed
      });
    if (metaErr) throw metaErr;

    // 4. Success
    return res.status(200).json({ metadata: metaRows[0] });

  } catch (err) {
    console.error('API analyze error:', err);
    return res.status(500).json({ error: err.message });
  }
}
