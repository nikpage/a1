// pages/api/save.js
import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  const { userId, data, feedback } = req.body || {};
  if (!userId || !data || !feedback) {
    return res.status(400).json({ error: 'Missing userId, data or feedback' });
  }

  try {
    // Plain insert into cv_metadata
    const { data: metaRow, error: metaErr } = await supabase
      .from('cv_metadata')
      .insert([{ user_id: userId, data }])
      .select()
      .single();

    if (metaErr) {
      return res.status(500).json({ error: metaErr.message });
    }

    // Insert feedback
    const { error: fbErr } = await supabase
      .from('cv_feedback')
      .insert([{ cv_metadata_id: metaRow.id, feedback }]);

    if (fbErr) {
      return res.status(500).json({ error: fbErr.message });
    }

    return res.status(200).json({ ok: true, cv_metadata_id: metaRow.id });
  } catch (err) {
    console.error('SAVE ERROR:', err);
    return res.status(500).json({ error: err.message });
  }
}
