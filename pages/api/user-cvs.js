import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  const { secret } = req.query;
  if (!secret) return res.status(400).json({ error: 'Missing secret' });

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('secret', secret)
    .single();

  if (userError) return res.status(404).json({ error: 'User not found' });

  const { data: cvs, error: cvError } = await supabase
    .from('cv_metadata')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (cvError) return res.status(500).json({ error: 'DB read failed' });

  res.status(200).json(cvs);
}
