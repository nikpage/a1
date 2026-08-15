// pages/api/resolve-flag.js
//
// Onboarding Step 3: the user resolves one master-CV flag. We load the signed-in
// user's canonical master, apply the resolution deterministically (utils/master-flags),
// and save it back. user_id ALWAYS comes from the verified session, never the body.
//
// The flag object itself is supplied by the client (it came from the user's own
// analysis), but every mutation is validated against the user's OWN master:
// applySingleFix whitelists the editable fields and bounds-checks indexes, so a
// crafted flag cannot reach outside the record or overwrite protected content
// (voice_samples, achievements). The user is authoritative over their own facts.

import requireAuth from '../../lib/requireAuth';
import { getMasterCv, saveMasterCv, getLatestAnalysis } from '../../utils/database';
import { resolveFlag } from '../../utils/master-flags';
import { applyOverlapAnswer } from '../../utils/master-schema';
import { computeMasterIssues, parseAnalysisContent } from '../../utils/master-issues';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id } = req.user;
  const { flag, decision, value } = req.body || {};

  const VALID_TYPES = new Set(['single', 'structural', 'clarify', 'overlap']);
  if (!flag || typeof flag !== 'object' || !VALID_TYPES.has(flag.type)) {
    return res.status(400).json({ error: 'A valid flag { type } is required' });
  }
  if (typeof decision !== 'string') {
    return res.status(400).json({ error: 'decision is required' });
  }

  let master;
  try {
    master = await getMasterCv(user_id);
  } catch {
    return res.status(500).json({ error: 'Could not load your record' });
  }
  if (!master) {
    return res.status(409).json({ error: 'No master record yet — finish the build first' });
  }

  let updated;
  try {
    // An overlap question is answered by the one function that nests a role.
    // The pair itself is re-read from the user's OWN stored record by index, so
    // a crafted flag can only choose WHICH open question is answered, never
    // which roles move.
    updated = flag.type === 'overlap'
      ? applyOverlapAnswer(master, flag.question_index, decision)
      : resolveFlag(master, flag, { decision, value });
  } catch (err) {
    // A bad target / out-of-range index / missing value lands here — never a 500.
    return res.status(400).json({ error: err.message });
  }

  try {
    await saveMasterCv(user_id, updated);
  } catch {
    return res.status(500).json({ error: 'Could not save your record' });
  }

  // Recompute the open questions against the UPDATED master — no extra DB write,
  // no AI call, the updated master is already in memory. This is what makes the
  // question list hierarchical: answering a structural overlap can remove the
  // short-tenure/gap questions it was suppressing or that it made moot.
  //
  // The analysis load is best-effort only — its sole purpose is to attach
  // context/suggestion text to the recomputed flags. A failure here must never
  // break the resolve itself, so it degrades to context-free flags.
  let analysisContent = null;
  try {
    const data = await getLatestAnalysis(user_id);
    analysisContent = parseAnalysisContent(data?.content);
  } catch {
    analysisContent = null;
  }

  const flags = computeMasterIssues(updated, { analysis: analysisContent });

  return res.status(200).json({ ok: true, master: updated, flags });
}

export default requireAuth(handler);
