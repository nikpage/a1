// path: /pages/api/header-stats.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

  const { data: user, error } = await supabase
    .from('users')
    .select('generations_left, tokens')
    .eq('user_id', user_id)
    .single();

  if (error || !user) return res.status(404).json({ error: 'User not found' });

  return res.status(200).json({
    generations: user.generations_left ?? 0,
    downloads: user.tokens ?? 0,
  });
}
