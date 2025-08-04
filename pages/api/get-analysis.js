// pages/api/get-analysis.js
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../../lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Add CORS headers
function addCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.thecv.pro');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

async function getAnalysisHandler(req, res) {
  try {
    console.log('DEBUG - req.user:', req.user);
    console.log('DEBUG - req.user keys:', Object.keys(req.user || {}));
    const { user_id } = req.user;

    if (!user_id) {
      return res.status(400).json({ error: 'User ID missing in token' });
    }

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
}

export default function handler(req, res) {
  addCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return requireAuth(getAnalysisHandler)(req, res);
}
