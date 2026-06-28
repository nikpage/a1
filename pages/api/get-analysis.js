// pages/api/get-analysis.js
import { logger } from '../../lib/logger';
import { getLatestAnalysis, getMasterCv } from '../../utils/database';
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
    // roles) and is what master_flags index into. A missing master is non-fatal —
    // the Flag Fixer simply renders without the timeline.
    let experience = [];
    try {
      const master = await getMasterCv(user_id);
      if (master && Array.isArray(master.experience)) experience = master.experience;
    } catch (e) {
      logger.error('get-analysis: master load failed:', e.message);
    }
    return res.status(200).json({ analysis: data.content, experience });
  } catch (error) {
    logger.error('Supabase query error:', error.message);
    return res.status(500).json({ analysis: '', error: 'Error fetching data from database.' });
  }
}

export default requireAuth(handler);
