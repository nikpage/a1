import { supabase } from '../../utils/supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { email } = req.body;

  if (!email) {
    res.status(400).json({ error: 'Missing email' });
    return;
  }

  const { data, error } = await supabase.from('users').insert([{ email }]);

  if (error) {
    res.status(500).json({ error: error.message });
  } else {
    res.status(200).json({ data });
  }
}
