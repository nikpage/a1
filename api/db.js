// /api/db.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SERVICE_ROLE_KEY
);

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

  // Try each upsert, but never throw
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

  // Always respond 200 so /api/second-stage.js can keep running
  return res.status(200).json({ success: true });
}
