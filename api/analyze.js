// /api/analyze.js

import { KeyManager } from '../js/key-manager.js';
import { buildCVMetadataExtractionPrompt } from '../js/prompt-builder.js';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const km = new KeyManager();
export const config = { api: { bodyParser: true } };

// Supabase client (service‐role)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // 0. Optional secret‐check
  if (process.env.API_SHARED_SECRET) {
    if (req.headers['x-api-secret'] !== process.env.API_SHARED_SECRET) {
      console.warn('Bad secret:', req.headers['x-api-secret']);
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  // 1. POST only
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 2. Your working DEV logic
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'No text provided' });

    const apiKey = km.keys[0];
    if (!apiKey) throw new Error('API key missing');

    const apiRes = await fetch(
      'https://api.deepseek.com/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: buildCVMetadataExtractionPrompt(text) }],
          response_format: { type: 'json_object' }
        })
      }
    );
    if (!apiRes.ok) {
      const errTxt = await apiRes.text();
      throw new Error(`DeepSeek error ${apiRes.status}: ${errTxt}`);
    }

    const chatJson = await apiRes.json();
    const content  = chatJson.choices[0].message.content;
    let parsed;
    try { parsed = JSON.parse(content); }
    catch { throw new Error('Invalid JSON from DeepSeek'); }

    // 3. LOG: show parsed output so we know it’s valid
    console.log('DeepSeek output:', parsed);

    // 4. Supabase writes with verbose logging
    const userId = crypto.randomUUID();
    console.log('Inserting user with ID:', userId);

    const { data: userRows, error: userErr } = await supabase
      .from('users')
      .insert({ id: userId, email: null });
    console.log('User insert result:', { userRows, userErr });
    if (userErr) throw userErr;

    console.log('Inserting cv_metadata row...');
    const { data: metaRows, error: metaErr } = await supabase
      .from('cv_metadata')
      .insert({
        user_id:  userId,
        file_url: parsed.fileUrl ?? null,
        data:     parsed
      });
    console.log('cv_metadata insert result:', { metaRows, metaErr });
    if (metaErr) throw metaErr;

    // 5. Return exactly what you need
    return res.status(200).json({ metadata: metaRows[0] });

  } catch (err) {
    console.error('API analyze error:', err);
    return res.status(500).json({ error: err.message });
  }
}
