import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  const { userId, data } = req.body;

  if (!userId || !data) {
    return res.status(400).json({ error: 'Missing userId or data' });
  }

  try {
    const { error } = await supabase
      .from('job_metadata')
      .upsert({ user_id: userId, data }, { onConflict: ['user_id'] });

    if (error) {
      console.error('Supabase upsert error:', error);
      return res.status(500).json({ error: 'Database upsert failed' });
    }

    return res.status(200).json({ message: 'Job metadata saved successfully' });
  } catch (e) {
    console.error('Unexpected error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
