// /api/db.js
import { supabase } from '../supabaseClient.js';  // reuse your working client :contentReference[oaicite:0]{index=0}:contentReference[oaicite:1]{index=1}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { userId, metadata, cv_body } = req.body;
  if (!userId || !metadata || !cv_body) {
    return res
      .status(400)
      .json({ error: 'userId, metadata and cv_body are required.' });
  }

  // Attempt to upsert user and metadata, but never crash
  try {
    const { error: userErr } = await supabase
      .from('users')
      .upsert([{ id: userId, email: null, secret: '' }]);
    if (userErr) console.error('[DB] user upsert error:', userErr);
  } catch (err) {
    console.error('[DB] user upsert threw:', err);
  }

  try {
    const { error: metaErr } = await supabase
      .from('cv_metadata')
      .upsert([{ user_id: userId, data: metadata, file_url: null }]);
    if (metaErr) console.error('[DB] metadata upsert error:', metaErr);
  } catch (err) {
    console.error('[DB] metadata upsert threw:', err);
  }

  // Always respond 200 so callers (analyze & second-stage) keep running
  return res.status(200).json({ success: true });
}
