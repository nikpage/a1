// pages/api/get-analysis.js
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../../lib/auth';
import userRateLimiter from '../../lib/userRateLimiter';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    if (!userRateLimiter(req.user.user_id, res)) {
      return;
    }

    const { user_id } = req.user;

    const { data, error } = await supabase
      .from('gen_data')
      .select('content')
      .eq('user_id', user_id)
      .eq('type', 'analysis')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Supabase query error:', error);
      return res.status(500).json({ error: 'Database query failed' });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    return res.status(200).json({ analysis: data[0].content });
  } catch (err) {
    console.error('Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
