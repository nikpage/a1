// pages/api/add-cv.js
//
// Add-another-CV (MERGE preview). For a user who ALREADY has a master CV, this
// folds a newly uploaded CV into it and returns the proposed result + any
// conflicts for the user to confirm — WITHOUT saving yet. The proposed master is
// stashed in Redis under a nonce; pages/api/add-cv-commit.js saves it once the
// user confirms. Identity comes from the verified session (req.user), never body.
//
// bodyParser is disabled so formidable can read the multipart upload; requireAuth
// only reads the auth-token cookie, so it composes fine with that.

import { Redis } from '@upstash/redis';
import formidable from 'formidable';
import crypto from 'crypto';
import requireAuth from '../../lib/requireAuth';
import { extractTextFromUpload, CvFileError } from '../../utils/extractCvText';
import { getMasterCv, logAiTransaction } from '../../utils/database';
import { buildOrMergeMaster } from '../../utils/openai';
import { logger } from '../../lib/logger';

export const config = { api: { bodyParser: false } };

export const STASH_TTL_SECONDS = 900; // 15 min — user has time to review conflicts
export const stashKey = (user_id, nonce) => `addcv:${user_id}:${nonce}`;

let _redis;
function getRedis() {
  if (!_redis) _redis = Redis.fromEnv();
  return _redis;
}

function parseForm(req) {
  return new Promise((resolve, reject) => {
    formidable().parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user_id = req.user.user_id;

  let newText;
  try {
    const { files } = await parseForm(req);
    newText = await extractTextFromUpload(files.file);
  } catch (err) {
    if (err instanceof CvFileError) return res.status(400).json({ error: err.message });
    logger.error('[add-cv] upload parse failed:', err.message);
    return res.status(400).json({ error: 'Upload failed' });
  }

  const existingMaster = await getMasterCv(user_id).catch(() => null);
  if (!existingMaster) {
    // No profile to merge into — caller should have used the normal upload path.
    return res.status(409).json({ error: 'No existing profile to merge into' });
  }

  let proposedMaster, gemini_usage;
  try {
    const merged = await buildOrMergeMaster(newText, existingMaster);
    proposedMaster = merged.output;
    gemini_usage = merged.gemini_usage;
  } catch (e) {
    logger.error('[add-cv] merge failed:', e.message);
    return res.status(502).json({ error: 'Could not merge this CV. Please try again.' });
  }

  // The merge AI call really happened — log its cost (DB + return usage for console).
  logAiTransaction({
    user_id,
    model: gemini_usage.model,
    cache_miss_tokens: gemini_usage.inputTokens,
    cache_hit_tokens: 0,
    completion_tokens: gemini_usage.outputTokens + gemini_usage.thinkingTokens,
    thinking_tokens: gemini_usage.thinkingTokens,
    detail: { type: 'master_cv_merge_preview' },
  }).catch(() => {});

  const nonce = crypto.randomUUID();
  await getRedis().set(
    stashKey(user_id, nonce),
    { newText, existingMaster, proposedMaster },
    { ex: STASH_TTL_SECONDS }
  );

  const conflicts = Array.isArray(proposedMaster.conflicts) ? proposedMaster.conflicts : [];
  return res.status(200).json({ nonce, conflicts, gemini_usage });
}

export default requireAuth(handler);
