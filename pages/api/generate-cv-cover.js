// pages/api/generate-cv-cover.js

import { logger } from '../../lib/logger';
import { getGenerationSource, saveGeneratedDoc, logAiTransaction } from '../../utils/database';
import { getUserById, decrementGenerations } from '../../utils/generation-utils';
import { generateCV, generateCoverLetter } from '../../utils/openai';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';
import requireAuth from '../../lib/requireAuth';
import { GENERATION_LANGUAGES } from '../../prompts/language';

let _redis;
function getRedis() {
  if (!_redis) _redis = Redis.fromEnv();
  return _redis;
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user_id = req.user.user_id;
  const { analysis: analysisRaw, tone = 'Formal', type = 'both', tweak = '', language: languageRaw = 'auto' } = req.body;
  // Explicit output language for this application ('en' / 'cs'); 'auto' keeps the
  // historic behaviour (write in the master CV's own language). Anything else is
  // coerced to 'auto' rather than reaching the prompt unchecked.
  const language = GENERATION_LANGUAGES[languageRaw] ? languageRaw : 'auto';
  if (!analysisRaw || !type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  let analysis;
  try {
    analysis = typeof analysisRaw === 'string' ? JSON.parse(analysisRaw) : analysisRaw;
  } catch {
    return res.status(400).json({ error: 'Invalid analysis JSON' });
  }

  const lockKey = `gen_lock:${user_id}`;
  // Best-effort double-submit guard. If Upstash is unreachable, proceed WITHOUT
  // the lock rather than failing the user's generation — the lock is a safeguard,
  // not a core dependency. A Redis outage must never take down writing.
  let lockHeld = false;
  try {
    const acquired = await getRedis().set(lockKey, '1', { nx: true, ex: 30 });
    if (acquired !== 'OK') return res.status(429).json({ error: 'Generation already in progress' });
    lockHeld = true;
  } catch (redisErr) {
    logger.error('Redis lock unavailable, proceeding without lock:', redisErr.message);
  }

  try {
    let user;
    try {
      user = await getUserById(user_id);
      if (!user) return res.status(404).json({ error: 'User not found' });
    } catch (userErr) {
      logger.error('User fetch error:', userErr.message);
      return res.status(500).json({ error: 'Error fetching user data' });
    }

    // Writing is free — gated only by the free-write allowance, never by paid
    // tokens. Tokens are spent at download time, not generation.
    if (user.generations_left <= 0) {
      return res.status(403).json({ error: 'NO_GENERATIONS_LEFT' });
    }

    // The user's saved candidate-core profile steers every document. Prefer the
    // (possibly user-edited) saved value; fall back to the draft in the analysis.
    const core = (user.candidate_core && user.candidate_core.trim()) || analysis?.candidate_core || '';

    // The MASTER CV is the source generation builds from — the complete,
    // structured source-of-truth. Fall back to the raw CV text only for users
    // whose master hasn't been built (older accounts / a failed build).
    let source;
    try {
      source = await getGenerationSource(user_id);
    } catch {
      return res.status(500).json({ error: 'Error fetching CV data' });
    }
    if (!source) {
      return res.status(404).json({ error: 'CV not found for user' });
    }

    let cvRes = null;
    let coverRes = null;
    let cv = null;
    let cover = null;

    try {
      if (type === 'cv' || type === 'both') {
        cvRes = await generateCV({ cv: source, analysis, tone, tweak, core, language });
        cv = cvRes.content;
      }

      if (type === 'cover' || type === 'both') {
        coverRes = await generateCoverLetter({ cv: source, analysis, tone, tweak, core, language });
        cover = coverRes.content;
      }

      // Both AI calls succeeded — decrement only now
      await decrementGenerations(user_id, 1);

      if (cv) {
        await saveGeneratedDoc({
          user_id,
          source_cv_id: user_id,
          type: 'cv',
          tone,
          file_name: 'Generated_CV.txt',
          content: cv
        });
      }

      if (cover) {
        await saveGeneratedDoc({
          user_id,
          source_cv_id: user_id,
          type: 'cover',
          tone,
          file_name: 'Generated_Cover_Letter.txt',
          content: cover
        });
      }

      // Every Gemini call this run made — the writing call AND its verify pass
      // — gets its own transactions row and its own console line. Each result
      // exposes them as `gemini_usages` (falling back to the single usage for
      // safety), so adding a call can never silently escape cost logging.
      const usagesOf = (result) =>
        result?.gemini_usages || (result?.gemini_usage ? [result.gemini_usage] : []);

      const logUsages = async (result, docType) => {
        for (const gu of usagesOf(result)) {
          await logAiTransaction({
            user_id,
            source_gen_id: crypto.randomUUID(),
            model: gu.model,
            cache_hit_tokens: 0,
            cache_miss_tokens: gu.inputTokens,
            completion_tokens: gu.outputTokens + gu.thinkingTokens,
            thinking_tokens: gu.thinkingTokens,
            detail: { tone, type: docType, step: gu.label },
          });
        }
      };

      if (type === 'cv' || type === 'both') await logUsages(cvRes, 'cv');
      if (type === 'cover' || type === 'both') await logUsages(coverRes, 'cover');

      const gemini_usage = [...usagesOf(cvRes), ...usagesOf(coverRes)];
      return res.status(200).json({
        ...(cv && { cv }),
        ...(cover && { cover }),
        gemini_usage
      });
    } catch (err) {
      const detail = err?.response?.data || err?.message || 'unknown';
      logger.error('Generation error:', detail);
      return res.status(500).json({ error: 'Generation failed', detail });
    }
  } finally {
    if (lockHeld) {
      try { await getRedis().del(lockKey); } catch (e) { logger.error('Redis unlock error:', e.message); }
    }
  }
}

export default requireAuth(handler);
