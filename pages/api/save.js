// pages/api/save.js
import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  console.log('[/api/save] Request body:', req.body);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  const { type, userId, data, name } = req.body;

  if (!type || !userId || !data) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    let result;
    switch (type) {
      case 'cv_meta':
        result = await supabase.from('cv_metadata').upsert(
          { user_id: userId, data },
          { onConflict: ['user_id'], returning: 'representation' }
        );
        break;

      case 'job_meta':
        result = await supabase.from('jobs_metadata').upsert(
          { user_id: userId, data },
          { onConflict: ['user_id'], returning: 'representation' }
        );
        break;

      case 'feedback':
        result = await supabase.from('cv_feedback').insert({
          cv_metadata_id: data.cv_metadata_id,
          feedback: data.feedback,
        });
        break;

      case 'cv':
        result = await supabase.from('saved_cvs').insert({
          user_id: userId,
          name: name || 'Untitled CV',
          content: data,
        });
        break;

      case 'cover':
        result = await supabase.from('saved_cover_letters').insert({
          user_id: userId,
          name: name || 'Untitled Cover Letter',
          content: data,
        });
        break;

      default:
        return res.status(400).json({ error: `Unknown save type: ${type}` });
    }

    if (result.error) {
      console.error('[/api/save] Supabase error:', result.error);
      return res.status(500).json({ error: result.error.message });
    }

    res.status(200).json({ success: true, data: result.data });
  } catch (e) {
    console.error('[/api/save] Unexpected error:', e);
    res.status(500).json({ error: e.message });
  }
}
