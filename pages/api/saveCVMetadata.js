import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  const { userId, cvData, feedbackData } = req.body;

  if (!userId || !cvData) {
    return res.status(400).json({ error: 'Missing userId or cvData' });
  }

  try {
    // Upsert CV metadata
    const { data: cvMeta, error: metaError } = await supabase
      .from('cv_metadata')
      .upsert({ user_id: userId, data: cvData }, { onConflict: ['user_id'] })
      .select()
      .single();

    if (metaError) {
      console.error('CV metadata upsert error:', metaError);
      return res.status(500).json({ error: 'Failed to save CV metadata' });
    }

    // If feedback exists, insert it linked to cv_metadata id
    if (feedbackData) {
      const { error: feedbackError } = await supabase
        .from('cv_feedback')
        .insert([{ cv_metadata_id: cvMeta.id, feedback: feedbackData }]);

      if (feedbackError) {
        console.error('CV feedback insert error:', feedbackError);
        return res.status(500).json({ error: 'Failed to save CV feedback' });
      }
    }

    return res.status(200).json({ message: 'CV metadata and feedback saved' });
  } catch (e) {
    console.error('Unexpected error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
