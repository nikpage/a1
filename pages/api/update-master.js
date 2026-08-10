// pages/api/update-master.js
//
// The user edits their own master record directly. Until now the only write
// paths were the flag fixer (one deterministic resolution at a time) and
// add-info (additive only, never overwrites) — so a wrong date, a role that
// shouldn't be there, or clumsy achievement wording could not be fixed at all.
//
// This route takes the whole edited record and saves it. Two guards:
//   1. user_id comes from the verified session, never the body, so a request
//      can only ever rewrite the caller's OWN record.
//   2. normaliseMaster() drops unknown keys, coerces every field to its declared
//      type, and carries the protected fields (voice_samples, conflicts) over
//      from the stored record — a crafted body cannot put arbitrary JSON into
//      master_cv or hand-edit the code-grounded verbatim quotes.
//
// Like resolve-flag, it returns the saved record plus freshly recomputed flags
// (no AI call — the record is already in memory), so the page reflects that
// answering something by hand can clear the question that asked about it.

import requireAuth from '../../lib/requireAuth';
import { getMasterCv, saveMasterCv, getLatestAnalysis } from '../../utils/database';
import { normaliseMaster } from '../../utils/master-schema';
import { computeMasterIssues, parseAnalysisContent } from '../../utils/master-issues';
import { logger } from '../../lib/logger';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id } = req.user;
  const { master: edited } = req.body || {};

  if (!edited || typeof edited !== 'object' || Array.isArray(edited)) {
    return res.status(400).json({ error: 'A master record is required' });
  }

  let stored;
  try {
    stored = await getMasterCv(user_id);
  } catch (e) {
    logger.error('update-master: load failed:', e.message);
    return res.status(500).json({ error: 'Could not load your record' });
  }
  // Editing presupposes a record to edit — a build must have run first.
  if (!stored) {
    return res.status(409).json({ error: 'No master record yet — upload a CV first' });
  }

  let updated;
  try {
    updated = normaliseMaster(edited, stored);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // An edit that empties the career record is a client bug, not an intention.
  if (updated.experience.length === 0 && Array.isArray(stored.experience) && stored.experience.length > 0) {
    return res.status(400).json({ error: 'That edit would remove every role from your record' });
  }

  try {
    await saveMasterCv(user_id, updated);
  } catch (e) {
    logger.error('update-master: save failed:', e.message);
    return res.status(500).json({ error: 'Could not save your record' });
  }

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
