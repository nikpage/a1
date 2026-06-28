// pages/api/get-analysis.js
import { logger } from '../../lib/logger';
import { getLatestAnalysis, getMasterCv } from '../../utils/database';
import { computeMasterIssues } from '../../utils/master-issues';
import requireAuth from '../../lib/requireAuth';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id } = req.user;

  try {
    const data = await getLatestAnalysis(user_id);
    if (!data) return res.status(404).json({ analysis: '', error: 'No analysis found for this user.' });
    // The master's experience[] backs the onboarding skeleton (companies/dates/
    // roles). The open questions are computed deterministically from its verbatim
    // dates (utils/master-issues) — NOT by an AI pass, which would reconcile the
    // gaps/overlaps away. A missing master is non-fatal — the step renders without
    // the timeline or questions.
    let experience = [];
    let flags = [];
    try {
      const master = await getMasterCv(user_id);
      if (master && Array.isArray(master.experience)) experience = master.experience;
      if (master) flags = computeMasterIssues(master);
    } catch (e) {
      logger.error('get-analysis: master load failed:', e.message);
    }
    return res.status(200).json({ analysis: data.content, experience, flags });
  } catch (error) {
    logger.error('Supabase query error:', error.message);
    return res.status(500).json({ analysis: '', error: 'Error fetching data from database.' });
  }
}

export default requireAuth(handler);
