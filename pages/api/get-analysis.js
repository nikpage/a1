// pages/api/get-analysis.js

import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../../lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getAnalysisHandler(req, res) {
  const { user_id } = req.user;
  console.log('get-analysis: req.user:', req.user);
  console.log('get-analysis: user_id being queried:', user_id);
  console.log('get-analysis: user_id type:', typeof user_id);

  const { data, error } = await supabase
    .from('gen_data')
    .select('content')
    .eq('user_id', user_id.toString())
    .eq('type', 'analysis')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Supabase error:', error);
    return res.status(500).json({ error: 'Database error' });
  }

  if (!data || data.length === 0) {
    return res.status(404).json({ error: 'Analysis not found' });
  }

  return res.status(200).json({ analysis: data[0].content });
}

export default requireAuth(getAnalysisHandler);
