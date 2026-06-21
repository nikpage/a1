// pages/api/get-analysis-status.js
//
// Poll endpoint for the background analysis flow. user_id comes from the verified
// session cookie; analysis_id (an unguessable UUID minted per request) is still
// required from the body to scope the lookup.

import { logger } from '../../lib/logger';
import { getGenDataByAnalysisId } from '../../utils/database';
import { getTokenFromReq, verifyToken } from '../../lib/auth';

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = getTokenFromReq(req);
  const session = token ? await verifyToken(token) : null;
  const { analysis_id, user_id: bodyUserId } = req.body || {};
  const user_id = session?.user_id || bodyUserId;
  if (!user_id) return res.status(401).json({ error: 'Missing user_id' });
  if (!analysis_id) {
    return res.status(400).json({ error: 'Missing analysis_id' });
  }

  let data;
  try {
    data = await getGenDataByAnalysisId(user_id, analysis_id);
  } catch (error) {
    logger.error('[get-analysis-status] query error:', error.message);
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

export default handler;
