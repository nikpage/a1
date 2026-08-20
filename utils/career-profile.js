// utils/career-profile.js
//
// ONE DOOR to the career profile — the job-agnostic half of the analysis
// (prompts/career-profile.js). Resolving it is always the same three steps:
// fingerprint the record, reuse the stored profile if it matches, otherwise
// build it and save it. That block existed in three copies (the background
// worker, the local harness, and it was about to exist in the write routes),
// which is three places for the fingerprint check to drift out of step and
// start paying for a rebuild nobody needed.
//
// It never throws. A profile is an OPTIMISATION: without one the per-job pass
// derives the person itself, exactly as it did before this existed, so a failed
// build must cost a log line and nothing else.

import { recordFingerprint } from './master-schema.js';
import { getCareerProfile, saveCareerProfile } from './database.js';
import { buildCareerProfile } from './openai.js';
import { logger } from '../lib/logger.js';

// Returns { profile, usages, rebuilt }. `profile` is null when there is no
// master to build one from, or when the build failed.
export async function resolveCareerProfile(user_id, master, sourceText) {
  if (!master || !user_id) return { profile: null, usages: [], rebuilt: false };

  const fingerprint = recordFingerprint(master);
  try {
    const stored = await getCareerProfile(user_id);
    if (stored && stored.record_fingerprint === fingerprint) {
      return { profile: stored, usages: [], rebuilt: false };
    }
  } catch (e) {
    // A read failure is not a reason to rebuild — it is a reason to carry on
    // without a profile and leave the stored one alone.
    logger.error('[career-profile] read failed, analysing without it:', e.message);
    return { profile: null, usages: [], rebuilt: false };
  }

  try {
    const built = await buildCareerProfile(sourceText, master);
    const profile = { ...built.profile, record_fingerprint: fingerprint };
    await saveCareerProfile(user_id, profile);
    return { profile, usages: [built.gemini_usage], rebuilt: true };
  } catch (e) {
    logger.error('[career-profile] build/save failed, analysing without it:', e.message);
    return { profile: null, usages: [], rebuilt: false };
  }
}

// The refresh a WRITE path owes: the record just changed, so the profile that
// describes it is stale. Called after the master is saved, so the person's next
// application starts from a profile that already knows about the change instead
// of paying to rebuild it mid-application.
export async function refreshCareerProfile(user_id, master) {
  return resolveCareerProfile(user_id, master, JSON.stringify(master));
}
