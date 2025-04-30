// /api/admin-logs.js

import { createClient } from '@supabase/supabase-js';
import { getUID } from '../../utils/auth.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const ADMIN_UID = 'your-admin-id'; // replace with actual UID

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end('Method Not Allowed');

  const uid = getUID(req);
  if (uid !== ADMIN_UID) return res.status(403).json({ error: 'Forbidden' });

  try {
    const { data, error } = await supabase.from('logs').select('*').order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: 'Failed to fetch logs' });
    res.status(200).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
