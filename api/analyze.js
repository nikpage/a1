// pages/api/analyze.js
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // 1. Only POST allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // 2. Secret header check
  if (req.headers['x-api-secret'] !== process.env.API_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: bad or missing secret' });
  }

  try {
    // 3. Parse JSON body
    let payload;
    try {
      payload = JSON.parse(req.body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }

    const { text } = payload;
    if (typeof text !== 'string' || text.trim() === '') {
      return res.status(400).json({ error: 'Missing or invalid `text` in request body' });
    }

    // 4. Call DeepSeek (example)
    const deepSeekRes = await fetch('https://api.deepseek.example/metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (!deepSeekRes.ok) {
      throw new Error(`DeepSeek error ${deepSeekRes.status}`);
    }
    const data = await deepSeekRes.json();

    // 5. Insert user and metadata into Supabase
    const userId = crypto.randomUUID();
    await supabase.from('users').insert({ id: userId, email: null });
    const insertMeta = await supabase
      .from('cv_metadata')
      .insert({ user_id: userId, file_url: data.fileUrl, data: data });

    if (insertMeta.error) {
      throw insertMeta.error;
    }

    // 6. Success response
    return res.status(200).json({ metadata: insertMeta.data[0] });

  } catch (err) {
    console.error('analyze handler error:', err);
    // 7. Always JSON on error
    return res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'Internal Server Error' });
  }
}
