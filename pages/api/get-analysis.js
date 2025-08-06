// pages/api/get-analysis.js
import { createClient } from '@supabase/supabase-js';
import { getTokenFromReq, verifyToken } from '../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id } = req.body;
  const token = getTokenFromReq(req);

  try {
    const decoded = await verifyToken(token);
    if (!decoded || decoded.user_id !== user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await supabase
    .from('gen_data')
    .select('content')
    .eq('user_id', user_id)
    .eq('type', 'analysis')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Supabase query error:', error.message);
    return res.status(500).json({ analysis: '', error: 'Error fetching data from database.' });
  }

  if (!data) {
    return res.status(404).json({ analysis: '', error: 'No analysis found for this user.' });
  }

  return res.status(200).json({ analysis: data.content });
}
