// /api/user-tokens.js

import { createClient } from '@supabase/supabase-js';
import { getUID } from '../../utils/auth.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end('Method Not Allowed');

  const uid = getUID(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { data, error } = await supabase
      .from('users')
      .select('tokens')
      .eq('id', uid)
      .single();

    if (error || !data) return res.status(404).json({ error: 'User not found' });

    res.status(200).json({ tokens: data.tokens });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Token fetch failed' });
  }
}
