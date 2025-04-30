// /api/init-user.js

import { createClient } from '@supabase/supabase-js';
import { getUID } from '../../utils/auth.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const DEFAULT_TOKENS = 500;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const uid = getUID(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { data: existing } = await supabase.from('users').select('id').eq('id', uid).single();

    if (!existing) {
      await supabase.from('users').insert({ id: uid, tokens: DEFAULT_TOKENS });
    }

    res.status(200).json({ status: 'initialized' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Init failed' });
  }
}
