// pages/api/save-metadata.js
import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { userId, metadata, feedback } = req.body;

  if (!userId || !metadata) {
    return res.status(400).json({ error: 'Missing userId or metadata' });
  }

  try {
    // Insert into cv_metadata
    const { data: cvMeta, error: metaError } = await supabase
      .from('cv_metadata')
      .upsert(
        { user_id: userId, data: metadata },
        { onConflict: ['user_id'], returning: 'representation' }
      )
      .single();

    if (metaError) {
      console.error('Metadata save error:', metaError);
      return res.status(500).json({ error: metaError.message });
    }

    // Insert into cv_feedback if feedback is provided
    if (feedback && cvMeta?.id) {
      const { error: feedbackError } = await supabase
        .from('cv_feedback')
        .insert({
          cv_metadata_id: cvMeta.id,
          feedback,
        });

      if (feedbackError) {
        console.error('Feedback save error:', feedbackError);
        return res.status(500).json({ error: feedbackError.message });
      }
    }

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('Unexpected error:', e);
    return res.status(500).json({ error: e.message });
  }
}
