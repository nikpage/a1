// pages/api/add-cv-commit.js
//
// Commits an add-another-CV merge that pages/api/add-cv.js previewed. The user
// has reviewed the conflicts; `overrides` carries the ones where they chose to
// keep the OLD value. With no overrides we save the already-computed proposed
// master as-is (no extra AI call); with overrides we re-merge once so the chosen
// values are placed correctly by the model. Identity comes from req.user.

import { Redis } from '@upstash/redis';
import requireAuth from '../../lib/requireAuth';
import { upsertCV, saveMasterCv, logAiTransaction } from '../../utils/database';
import { buildOrMergeMaster } from '../../utils/openai';
import { stashKey } from './add-cv';
import { logger } from '../../lib/logger';

let _redis;
function getRedis() {
  if (!_redis) _redis = Redis.fromEnv();
  return _redis;
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user_id = req.user.user_id;
  const { nonce, overrides } = req.body || {};
  if (!nonce || typeof nonce !== 'string') {
    return res.status(400).json({ error: 'Missing nonce' });
  }

  const redis = getRedis();
  const key = stashKey(user_id, nonce);
  const stash = await redis.get(key);
  if (!stash) {
    return res.status(410).json({ error: 'This merge has expired — please upload the CV again.' });
  }

  const { newText, existingMaster, proposedMaster } = stash;
  const validOverrides = Array.isArray(overrides)
    ? overrides.filter((o) => o && typeof o.where === 'string' && typeof o.value === 'string')
    : [];

  let finalMaster = proposedMaster;
  let usages = [];
  if (validOverrides.length) {
    try {
      const remerged = await buildOrMergeMaster(newText, existingMaster, validOverrides);
      finalMaster = remerged.output;
      usages = remerged.usages;
    } catch (e) {
      logger.error('[add-cv-commit] re-merge with overrides failed:', e.message);
      return res.status(502).json({ error: 'Could not apply your choices. Please try again.' });
    }
    for (const gu of usages) {
      logAiTransaction({
        user_id,
        model: gu.model,
        cache_miss_tokens: gu.inputTokens,
        cache_hit_tokens: 0,
        completion_tokens: gu.outputTokens + gu.thinkingTokens,
        thinking_tokens: gu.thinkingTokens,
        detail: { type: `${gu.label} (commit)` },
      }).catch(() => {});
    }
  }

  try {
    await saveMasterCv(user_id, finalMaster);
    await upsertCV(user_id, newText); // newest raw text becomes the voice source
  } catch (e) {
    logger.error('[add-cv-commit] save failed:', e.message);
    return res.status(500).json({ error: 'Could not save your profile. Please try again.' });
  }

  await redis.del(key).catch(() => {});
  return res.status(200).json({ ok: true, gemini_usage: usages });
}

export default requireAuth(handler);
