// pages/api/master-add-info.js
//
// "Anything not on your CV?" — the user types loose text about work their CV
// never captured; the AI folds it into their canonical master record.
//
//   POST { text, answers?: [{ question, answer }] }
//     → { ok: true, master, flags, changes }        the record was updated
//     → { ok: false, questions: [...] }             cannot place it yet — nothing saved
//
// user_id ALWAYS comes from the verified session, never the body, and the master
// loaded/saved is that user's own — the request supplies text only, so nothing
// here can reach another user's record. A per-user Redis lock serialises the
// read-modify-write (the whole master is rewritten) and stops a double-submit
// paying for two augment calls.

import requireAuth from '../../lib/requireAuth';
import { getMasterCv, saveMasterCv, getLatestAnalysis, logAiTransaction } from '../../utils/database';
import { augmentMaster } from '../../utils/openai';
import { computeMasterIssues, parseAnalysisContent } from '../../utils/master-issues';
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
  const { text, answers } = req.body || {};

  if (typeof text !== 'string' || text.trim().length < 10) {
    return res.status(400).json({ error: 'Tell us a bit more — a sentence or two at least' });
  }
  if (text.length > MAX_TEXT) {
    return res.status(400).json({ error: `That is too long — keep it under ${MAX_TEXT} characters` });
  }

  // Answers to the questions a previous round asked. Shape-checked, capped, and
  // trimmed: they go straight into a prompt, so nothing unbounded gets through.
  const cleanAnswers = (Array.isArray(answers) ? answers : [])
    .filter((a) => a && typeof a.question === 'string' && typeof a.answer === 'string')
    .map((a) => ({ question: a.question.slice(0, 300).trim(), answer: a.answer.slice(0, 500).trim() }))
    .filter((a) => a.question && a.answer)
    .slice(0, 2);

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
    if (!master) {
      return res.status(409).json({ error: 'No master record yet — upload your CV first' });
    }

    let result;
    try {
      result = await augmentMaster(master, text.trim(), cleanAnswers);
    } catch (e) {
      logger.error('master-add-info augment failed:', e.message);
      return res.status(502).json({ error: 'Could not add that right now — try again' });
    }

    // Every paid call is cost-logged (augment attempts + verify), whether or not
    // the result is saved — the user was charged for it either way.
    for (const mu of result.usages) {
      await logAiTransaction({
        user_id,
        model: mu.model,
        cache_miss_tokens: mu.inputTokens,
        cache_hit_tokens: 0,
        completion_tokens: mu.outputTokens + mu.thinkingTokens,
        thinking_tokens: mu.thinkingTokens,
        detail: { type: mu.label },
      }).catch(() => {});
    }

    // The model could not place the fact without more from the user. Save
    // NOTHING — a half-placed role in the canonical record is worse than none —
    // and hand the questions back for a second round.
    if (result.questions.length) {
      return res.status(200).json({ ok: false, questions: result.questions, _gemini_usage: result.usages });
    }

    try {
      await saveMasterCv(user_id, result.output);
    } catch {
      return res.status(500).json({ error: 'Could not save your record' });
    }

    // Recompute the open questions against the UPDATED master, exactly as
    // resolve-flag does — new information can settle an existing question (a gap
    // just filled) or raise one (a new role overlapping an old one). The analysis
    // load is best-effort: it only attaches context text to the flags.
    let analysisContent = null;
    try {
      const data = await getLatestAnalysis(user_id);
      analysisContent = parseAnalysisContent(data?.content);
    } catch {
      analysisContent = null;
    }
    const flags = computeMasterIssues(result.output, { analysis: analysisContent });

    return res.status(200).json({
      ok: true,
      master: result.output,
      flags,
      changes: result.changes,
      _gemini_usage: result.usages,
    });
  } finally {
    if (lockHeld) {
      await getRedis().del(lockKey).catch(() => {});
    }
  }
}

export default requireAuth(handler);
