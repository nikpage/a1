// pages/api/save.js
import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  const { type, userId, data, name, feedback } = req.body;

  if (!type || !userId || !data) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    let result = { data: null, error: null };

    switch (type) {
      case 'cv_meta':
        const metaUpsert = await supabase.from('cv_metadata').upsert(
          { user_id: userId, data },
          { onConflict: ['user_id'], returning: 'minimal' }
        );

        if (metaUpsert.error) throw metaUpsert.error;

        if (feedback) {
          const { data: existingMeta, error: metaErr } = await supabase
            .from('cv_metadata')
            .select('id')
            .eq('user_id', userId)
            .single();

          if (metaErr) throw metaErr;

          const feedbackCheck = await supabase
            .from('cv_feedback')
            .select('id')
            .eq('cv_metadata_id', existingMeta.id);

          if (!feedbackCheck.data || feedbackCheck.data.length === 0) {
            const feedbackInsert = await supabase.from('cv_feedback').insert({
              cv_metadata_id: existingMeta.id,
              feedback,
            });

            if (feedbackInsert.error) throw feedbackInsert.error;
          }
        }
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

    // ✅ Rock-solid error handling
    if (!result || result.error) {
      const msg = result?.error?.message || 'Unknown save failure';
      console.error('Save error:', result?.error || 'No result returned');
      return res.status(500).json({ error: msg });
    }

    res.status(200).json({ success: true, data: result.data });
  } catch (e) {
    console.error('Unexpected error:', e);
    return res.status(500).json({ error: e.message });
  }
}
