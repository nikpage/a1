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
  if (!userId || !metadata) {
    return res.status(400).json({ error: 'Missing userId or metadata' });
  }

  try {
    // 1) Upsert user
    const { error: userErr } = await supabase
      .from('users')
      .upsert({ id: userId, email: null, secret: '' });
    if (userErr) throw userErr;

    // 2) Insert CV metadata
    const { error: metaErr } = await supabase
      .from('cv_metadata')
      .insert({ user_id: userId, data: metadata, file_url: null });
    if (metaErr) throw metaErr;

    // 3) (Optional) Store CV text
    // await supabase
    //   .from('cv_bodies')
    //   .insert({ user_id: userId, body: cv_body });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('DB error:', err);
    return res.status(500).json({ error: err.message });
  }
}
