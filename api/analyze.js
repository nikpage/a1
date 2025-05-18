// pages/api/analyze.js
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // 1. Only allow POST
  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ error: `Method ${req.method} Not Allowed` });
  }

  // 2. Secret header check
  if (req.headers['x-api-secret'] !== process.env.API_SHARED_SECRET) {
    return res
      .status(401)
      .json({ error: 'Unauthorized: bad or missing secret' });
  }

  try {
    // 3. Safe JSON parse
    let payload;
    try {
      payload = typeof req.body === 'string'
        ? JSON.parse(req.body)
        : req.body;
    } catch {
      return res
        .status(400)
        .json({ error: 'Invalid JSON payload' });
    }

    const { text } = payload;
    if (typeof text !== 'string' || text.trim() === '') {
      return res
        .status(400)
        .json({ error: 'Missing or invalid `text` in request body' });
    }

    // 4. Call DeepSeek
    const deepSeekRes = await fetch(
      'https://api.deepseek.example/metadata',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      }
    );
    if (!deepSeekRes.ok) {
      throw new Error(`DeepSeek error ${deepSeekRes.status}`);
    }
    const data = await deepSeekRes.json();

    // 5. Insert user + metadata in Supabase
    const userId = crypto.randomUUID();
    const { error: userErr } = await supabase
      .from('users')
      .insert({ id: userId, email: null });
    if (userErr) throw userErr;

    const { data: metaRows, error: metaErr } = await supabase
      .from('cv_metadata')
      .insert({
        user_id: userId,
        file_url: data.fileUrl,
        data
      });
    if (metaErr) throw metaErr;

    // 6. Success → always JSON
    return res
      .status(200)
      .json({ metadata: metaRows[0] });

  } catch (err) {
    console.error('analyze handler error:', err);
    return res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'Internal Server Error' });
  }
}
