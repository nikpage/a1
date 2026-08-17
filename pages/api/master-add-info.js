// pages/api/master-add-info.js
//
// "Anything not on your CV?" — the user types loose text about work their CV
// never captured; the AI folds it into their canonical master record.
//
//   POST { text }
//     → { ok: true, master, flags }                 the record was updated
//
// user_id ALWAYS comes from the verified session, never the body, and the master
// loaded/saved is that user's own — the request supplies text only, so nothing
// here can reach another user's record. A per-user Redis lock serialises the
// read-modify-write (the whole master is rewritten) and stops a double-submit
// paying for two augment calls.

import requireAuth from '../../lib/requireAuth';
import { getCV, getMasterCv, saveMasterCv } from '../../utils/database';
import { withAiContext } from '../../utils/ai-meter';
import { augmentMaster, buildOrMergeMaster } from '../../utils/openai';
import { computeMasterIssues } from '../../utils/master-issues';
import { mergeAdditions } from '../../utils/master-schema';
import { logger } from '../../lib/logger';
import { Redis } from '@upstash/redis';

let _redis;
function getRedis() {
  if (!_redis) _redis = Redis.fromEnv();
  return _redis;
}

// Long enough for a real career story, short enough that nobody pastes a novel
// (or another whole CV — that path is the upload, not this box) into a paid call.
const MAX_TEXT = 4000;

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id } = req.user;
  const { text } = req.body || {};

  if (typeof text !== 'string' || text.trim().length < 10) {
    return res.status(400).json({ error: 'Tell us a bit more — a sentence or two at least' });
  }
  if (text.length > MAX_TEXT) {
    return res.status(400).json({ error: `That is too long — keep it under ${MAX_TEXT} characters` });
  }

  const lockKey = `master_add_lock:${user_id}`;
  let lockHeld = false;
  try {
    const acquired = await getRedis().set(lockKey, '1', { nx: true, ex: 60 });
    if (acquired !== 'OK') return res.status(429).json({ error: 'Still adding your last note — one moment' });
    lockHeld = true;
  } catch (redisErr) {
    // The lock is a safeguard, not a dependency — an Upstash outage must not
    // block the user from updating their own record.
    logger.error('Redis lock unavailable for master-add-info, proceeding without lock:', redisErr.message);
  }

  try {
    let master;
    try {
      master = await getMasterCv(user_id);
    } catch {
      return res.status(500).json({ error: 'Could not load your record' });
    }
    // A missing master is recoverable, not a dead end. The master build runs once
    // in the background analysis, and if that call failed the column is simply
    // null — the user still has their uploaded CV text, and refusing here would
    // strand them with a record that can never be added to. Build it now from
    // that text (the same builder the background worker uses), then augment.
    const buildUsages = [];
    if (!master) {
      let cvRecord = null;
      try {
        cvRecord = await getCV(user_id);
      } catch {
        cvRecord = null;
      }
      if (!cvRecord?.cv_data) {
        return res.status(409).json({ error: 'No CV on file yet — upload your CV first' });
      }
      try {
        const built = await buildOrMergeMaster(cvRecord.cv_data);
        master = built.output;
        buildUsages.push(...built.usages);
        await saveMasterCv(user_id, master);
      } catch (e) {
        logger.error('master-add-info: on-demand master build failed:', e.message);
        return res.status(502).json({ error: 'Could not read your CV record — try again' });
      }
    }

    let result;
    try {
      result = await augmentMaster(master, text.trim());
    } catch (e) {
      logger.error('master-add-info augment failed:', e.message);
      return res.status(502).json({ error: 'Could not add that right now — try again' });
    }

    // Every paid call — each augment attempt and the verify pass — was recorded
    // by the meter as it responded, whether or not the result is saved.

    // The model was handed the whole record and returns a whole record, because
    // augmentMaster runs the BUILD prompt — pure re-extraction. Saving that
    // return value re-transcribes the person's entire career on every note, and
    // whatever the cheap model compresses, retitles or drops is gone. So the
    // stored record is the base and the output is read for ADDITIONS only, which
    // is what this route has always promised. Corrections belong to the editor.
    const merged = mergeAdditions(master, result.output);

    try {
      await saveMasterCv(user_id, merged);
    } catch {
      return res.status(500).json({ error: 'Could not save your record' });
    }

    // Recompute the open questions against the UPDATED master, exactly as
    // resolve-flag does — added information can settle an existing question or
    // raise one (a new role overlapping the person's own practice).
    const flags = computeMasterIssues(merged);

    return res.status(200).json({
      ok: true,
      master: merged,
      flags,
      _gemini_usage: [...buildUsages, ...result.usages],
    });
  } finally {
    if (lockHeld) {
      await getRedis().del(lockKey).catch(() => {});
    }
  }
}

export default requireAuth(withAiContext('api:master-add-info', handler));
