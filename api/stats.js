// stats.js
import { supabase } from './_supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const { data, error } = await supabase.from('stats').select('*').eq('id', 1).single();
    if (error) throw error;

    res.status(200).json({
      cv: data.cv_count,
      cover: data.cover_count,
      extract: data.extract_count,
      tokens: data.tokens_spent,
      tone: {
        Formal: data.tone_formal,
        Neutral: data.tone_neutral,
        Casual: data.tone_casual,
        Cocky: data.tone_cocky
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
}
