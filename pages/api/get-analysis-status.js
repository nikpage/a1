// pages/api/get-analysis-status.js
//
// Read-only poll endpoint for the background analysis flow. Scoped by user_id +
// analysis_id (an unguessable UUID minted per request), so it works for the
// guest landing flow without auth. Reads gen_data only — no tokens, writes, or AI.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, analysis_id } = req.body || {};
  if (!user_id || !analysis_id) {
    return res.status(400).json({ error: 'Missing user_id or analysis_id' });
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

  try {
    const parsed = JSON.parse(content);
    if (parsed && parsed.__analysis_error) {
      return res.status(200).json({ status: 'error', error: parsed.__analysis_error });
    }
  } catch {
    // not the sentinel — it's the real analysis JSON; fall through
  }

  return res.status(200).json({ status: 'done', analysis: content });
}
