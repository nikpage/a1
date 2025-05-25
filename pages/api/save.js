// pages/api/save.js
import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { userId, data, feedback } = req.body;
    if (!userId || !data || !feedback) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    // Insert into cv_metadata
    const { data: metaInsert, error: metaErr } = await supabase
      .from('cv_metadata')
      .insert([{ user_id: userId, ...data }])
      .select()
      .single();

    if (metaErr || !metaInsert) {
      return res.status(500).json({ error: 'Metadata insert failed', details: metaErr.message });
    }

    // Insert feedback, linked to metadata
    const { error: fbErr } = await supabase
      .from('cv_feedback')
      .insert([{ cv_metadata_id: metaInsert.id, feedback }]);

    if (fbErr) {
      return res.status(500).json({ error: 'Feedback insert failed', details: fbErr.message });
    }

    res.status(200).json({ ok: true, cv_metadata_id: metaInsert.id });
  } catch (err) {
    console.error('SAVE ERROR:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
}
