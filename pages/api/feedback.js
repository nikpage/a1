// pages/api/feedback.js
import { getFeedback } from '../../lib/deepseekClient';
import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const { userId, metadata, cvBody, fileUrl } = req.body;
  try {
    // Get AI feedback
    const feedback = await getFeedback(metadata, cvBody);

    // Persist into Supabase
    const { error } = await supabase
      .from('cv_metadata')
      .insert({
        user_id: userId,
        file_url: fileUrl || null,
        data: feedback,
      });

    if (error) {
      console.error('Supabase insert error:', error);
      // don't block returning feedback to user
    }

    res.status(200).json({ feedback });
  } catch (error) {
    console.error('DeepSeek feedback error:', error);
    res.status(500).json({ error: error.message });
  }
}
