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
import { getMasterCv, saveMasterCv } from '../../utils/database';
import { resolveFlag } from '../../utils/master-flags';
import { applyOverlapAnswer } from '../../utils/master-schema';
import { computeMasterIssues } from '../../utils/master-issues';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id } = req.user;
  const { flag, decision, value } = req.body || {};

  const VALID_TYPES = new Set(['single', 'structural', 'overlap']);
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
    // The pair is re-found in the user's OWN stored record by the IDENTITY of
    // the two roles, so a crafted flag can only choose WHICH open question is
    // answered, never which roles move — and a question that is no longer open
    // is a 400, never a save that quietly changed nothing.
    updated = flag.type === 'overlap'
      ? applyOverlapAnswer(master, { role_key: flag.role_key, umbrella_key: flag.umbrella_key }, decision)
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
  // no AI call, the updated master is already in memory. Answering an overlap
  // restructures the record, so the remaining questions are re-read from it.
  const flags = computeMasterIssues(updated);

  return res.status(200).json({ ok: true, master: updated, flags });
}

export default requireAuth(handler);
