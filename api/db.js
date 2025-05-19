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

  try {
    // 1) Upsert user
    await supabase
      .from('users')
      .upsert({ id: userId, email: null, secret: '' });

    // 2) Upsert metadata
    await supabase
      .from('cv_metadata')
      .upsert({ user_id: userId, data: metadata, file_url: null });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('DB error:', err);
    return res.status(500).json({ error: err.message });
  }
}
