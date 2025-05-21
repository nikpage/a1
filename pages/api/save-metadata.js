// pages/api/save-metadata.js
import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const { userId, metadata } = req.body;
  const { error } = await supabase
    .from('cv_metadata')
    .insert({
      user_id: userId,
      data: metadata,
    });
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ success: true });
}
