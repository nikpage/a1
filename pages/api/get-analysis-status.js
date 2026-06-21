// pages/api/get-analysis-status.js
//
// Poll endpoint for the background analysis flow. user_id comes from the verified
// session cookie; analysis_id (an unguessable UUID minted per request) is still
// required from the body to scope the lookup.

import { createClient } from '@supabase/supabase-js';
import requireAuth from '../../lib/requireAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id } = req.user;
  const { analysis_id } = req.body || {};
  if (!analysis_id) {
    return res.status(400).json({ error: 'Missing analysis_id' });
  }

  const { data, error } = await supabase
    .from('gen_data')
    .select('content')
    .eq('user_id', user_id)
    .eq('analysis_id', analysis_id)
    .eq('type', 'analysis')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('[get-analysis-status] query error:', error.message);
    return res.status(500).json({ error: 'Error fetching analysis status' });
  }

  const content = data?.[0]?.content;
  if (!content) {
    return res.status(200).json({ status: 'pending' });
  }

  let gemini_usage = null;
  try {
    const parsed = JSON.parse(content);
    if (parsed && parsed.__analysis_error) {
      return res.status(200).json({ status: 'error', error: parsed.__analysis_error });
    }
    gemini_usage = parsed?._gemini_usage || null;
  } catch {
    // not the sentinel — it's the real analysis JSON; fall through
  }

  return res.status(200).json({ status: 'done', analysis: content, gemini_usage });
}

export default requireAuth(handler);
