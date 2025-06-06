// pages/api/save.js
import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  console.log('🛠️ [save.js] Request body:', req.body);
  const { userId, data, feedback, jobMetadata } = req.body || {};
  if (!userId || !data) return res.status(400).json({ error: 'Missing userId or data' });

  try {
    // Handle CV Metadata
    const { data: metaRow, error: metaErr } = await supabase
      .from('cv_metadata')
      .upsert(
        { user_id: userId, data },
        { onConflict: ['user_id'] }
      )
      .select()
      .single();
    if (metaErr) throw metaErr;

    // Handle CV Feedback (if provided)
    if (feedback) {
      const cv_metadata_id = feedback.cv_metadata_id || metaRow?.id;
      const feedbackValue = feedback.feedback !== undefined ? feedback.feedback : feedback;

      const insertPayload = {
        cv_metadata_id,
        feedback: feedbackValue,
      };

      const { error: fbErr } = await supabase.from('cv_feedback').insert([insertPayload]);
      if (fbErr) throw fbErr;
    }

    // Handle Job Metadata
    if (jobMetadata) {
      const { error: jobErr } = await supabase.from('job_metadata').insert([
        {
          user_id: userId,
          data: jobMetadata,
        },
      ]);
      if (jobErr) throw jobErr;
    }

    return res.status(200).json({ ok: true, cv_metadata_id: metaRow.id });
  } catch (err) {
    console.error('🚨 SAVE ERROR:', err);
    return res.status(500).json({ error: err.message });
  }
}
