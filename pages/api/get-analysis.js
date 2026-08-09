// pages/api/get-analysis.js
import { logger } from '../../lib/logger';
import { getLatestAnalysis, getMasterCv } from '../../utils/database';
import { computeMasterIssues, parseAnalysisContent } from '../../utils/master-issues';
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
    // Whether the per-user master record actually exists. The build runs once in
    // the background analysis; when that call fails the column is left null while
    // the CV text sits safely on file. Without this flag the page cannot tell an
    // EMPTY record from a genuinely clean one — and told the user "came through
    // clean" over a record that did not exist.
    let master_missing = true;
    // The full master record, for callers that show/edit the whole thing (the
    // personal workbench at /me) rather than just the onboarding skeleton.
    let master = null;
    try {
      master = await getMasterCv(user_id);
      master_missing = !master;
      if (master && Array.isArray(master.experience)) experience = master.experience;
      // data.content is the stored gen_data payload — a JSON STRING today (the
      // background function always JSON.stringify()s before insert), but handled
      // defensively either way. Feeding it in lets issues carry the teaser's own
      // sentences about the same overlap/gap as `context`/`suggestion` (TASK 2).
      if (master) flags = computeMasterIssues(master, { analysis: parseAnalysisContent(data.content) });
    } catch (e) {
      logger.error('get-analysis: master load failed:', e.message);
    }
    return res.status(200).json({ analysis: data.content, experience, flags, master_missing, master });
  } catch (error) {
    logger.error('Supabase query error:', error.message);
    return res.status(500).json({ analysis: '', error: 'Error fetching data from database.' });
  }
}

export default requireAuth(handler);
