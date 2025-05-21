// pages/api/feedback.js
import { getFeedback } from '../../lib/deepseekClient';
import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { userId, metadata, cvBody, fileUrl } = req.body;

  try {
    // 1) Persist the metadata in cv_metadata and grab its ID
    const { data: metaRec, error: metaErr } = await supabase
      .from('cv_metadata')
      .insert({
        user_id: userId,
        file_url: fileUrl || null,
        data: metadata,
      })
      .select('id')
      .single();

    if (metaErr) {
      throw new Error('Metadata insert error: ' + metaErr.message);
    }

    const cvMetadataId = metaRec.id;

    // 2) Call DeepSeek for the AI feedback
    const feedback = await getFeedback(metadata, cvBody);

    // 3) Persist that feedback in cv_feedback
    const { error: fbErr } = await supabase
      .from('cv_feedback')
      .insert({
        cv_metadata_id: cvMetadataId,
        feedback: feedback,
      });

    if (fbErr) {
      console.error('Feedback insert error:', fbErr);
    }

    // 4) Return the AI feedback to the client
    res.status(200).json({ feedback });
  } catch (error) {
    console.error('Feedback endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
}
