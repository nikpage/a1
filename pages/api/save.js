// pages/api/save.js
import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  const { userId, data, feedback } = req.body || {};
  if (!userId || !data) {
    return res.status(400).json({ error: 'Missing userId or data' });
  }

  try {
    // Save cv_metadata with expanded columns
    const { data: metaRow, error: metaErr } = await supabase
      .from('cv_metadata')
      .upsert({
        user_id: userId,
        data,
        display_name: data.display_name || 'Unnamed CV',
        document_input_id: data.document_input_id || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: ['user_id'] })
      .select()
      .single();

    if (metaErr) {
      console.error('cv_metadata error:', metaErr.message, metaErr.details);
      return res.status(500).json({ error: 'Failed to save cv_metadata', details: metaErr });
    }

    // Save cv_feedback if provided
    if (feedback) {
      const feedbackValue = typeof feedback === 'string' ? feedback : feedback.feedback || '';
      const { error: fbErr } = await supabase
        .from('cv_feedback')
        .insert({
          cv_metadata_id: metaRow.id,
          user_id: userId,
          feedback: feedbackValue,
          display_name: data.display_name || 'Unnamed CV',
          created_at: new Date().toISOString(),
        });

      if (fbErr) {
        console.error('cv_feedback error:', fbErr.message, fbErr.details);
        return res.status(500).json({ error: 'Failed to save feedback', details: fbErr });
      }
    }

    return res.status(200).json({ ok: true, cv_metadata_id: metaRow.id });
  } catch (err) {
    console.error('SAVE endpoint error:', err.message, err.stack);
    return res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
}
