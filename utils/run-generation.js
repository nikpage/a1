// utils/run-generation.js
//
// The whole CV / cover-letter generation run, in one place: the per-user Redis
// lock, the free-write allowance check, the source lookup, both AI calls, the
// deferred decrement, the saves, and the cost logging.
//
// It lives here rather than in an API route because generation is far too slow
// for Netlify's 10s synchronous limit — the rule stack means a run is up to six
// Gemini calls (write → verify → validate → retry → re-verify, per document),
// which returned a 502 HTML error page to the browser. The caller is
// `netlify/functions/generate-background.mjs` (15-min budget); this module is
// transport-agnostic and throws GenerationError instead of writing a response.

import crypto from 'crypto';
import { Redis } from '@upstash/redis';
import { logger } from '../lib/logger.js';
import { getGenerationSource, saveGeneratedDoc, logAiTransaction, getVoiceProfile } from './database.js';
import { getUserById, decrementGenerations } from './generation-utils.js';
import { generateCV, generateCoverLetter } from './openai.js';
import { GENERATION_LANGUAGES } from '../prompts/language.js';

// The lock outlives a full run now that generation is a background job. 30s was
// sized for the old synchronous route and would have expired mid-write.
const LOCK_TTL_SECONDS = 600;

let _redis;
function getRedis() {
  if (!_redis) _redis = Redis.fromEnv();
  return _redis;
}

export class GenerationError extends Error {
  constructor(code, status, detail) {
    super(code);
    this.name = 'GenerationError';
    this.code = code;
    this.status = status;
    if (detail !== undefined) this.detail = detail;
  }
}

export async function runGeneration({
  user_id,
  analysis: analysisRaw,
  tone = 'Formal',
  type = 'both',
  tweak = '',
  language: languageRaw = 'auto',
}) {
  // Explicit output language for this application ('en' / 'cs'); 'auto' keeps the
  // historic behaviour (write in the master CV's own language). Anything else is
  // coerced to 'auto' rather than reaching the prompt unchecked.
  const language = GENERATION_LANGUAGES[languageRaw] ? languageRaw : 'auto';
  if (!analysisRaw || !type) throw new GenerationError('Missing required fields', 400);

  let analysis;
  try {
    analysis = typeof analysisRaw === 'string' ? JSON.parse(analysisRaw) : analysisRaw;
  } catch {
    throw new GenerationError('Invalid analysis JSON', 400);
  }

  const lockKey = `gen_lock:${user_id}`;
  // Best-effort double-submit guard. If Upstash is unreachable, proceed WITHOUT
  // the lock rather than failing the user's generation — the lock is a safeguard,
  // not a core dependency. A Redis outage must never take down writing.
  let lockHeld = false;
  try {
    const acquired = await getRedis().set(lockKey, '1', { nx: true, ex: LOCK_TTL_SECONDS });
    if (acquired !== 'OK') throw new GenerationError('Generation already in progress', 429);
    lockHeld = true;
  } catch (redisErr) {
    if (redisErr instanceof GenerationError) throw redisErr;
    logger.error('Redis lock unavailable, proceeding without lock:', redisErr.message);
  }

  try {
    let user;
    try {
      user = await getUserById(user_id);
    } catch (userErr) {
      logger.error('User fetch error:', userErr.message);
      throw new GenerationError('Error fetching user data', 500);
    }
    if (!user) throw new GenerationError('User not found', 404);

    // Writing is free — gated only by the free-write allowance, never by paid
    // tokens. Tokens are spent at download time, not generation.
    if (user.generations_left <= 0) throw new GenerationError('NO_GENERATIONS_LEFT', 403);

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
      throw new GenerationError('Error fetching CV data', 500);
    }
    if (!source) throw new GenerationError('CV not found for user', 404);

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
        // The user's own writing voice, read only for the letter — the CV's
        // constraint is accuracy, not personality, and we don't promise voice
        // there. A missing profile is normal: the letter falls back to the
        // master's voice_samples exactly as before.
        let voiceProfile = null;
        try {
          voiceProfile = await getVoiceProfile(user_id);
        } catch (e) {
          logger.error('voice profile load failed (writing without it):', e.message);
        }
        coverRes = await generateCoverLetter({ cv: source, analysis, tone, tweak, core, language, voiceProfile });
        cover = coverRes.content;
      }
    } catch (err) {
      const detail = err?.response?.data || err?.message || 'unknown';
      logger.error('Generation error:', detail);
      throw new GenerationError('Generation failed', 500, detail);
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
        content: cv,
      });
    }

    if (cover) {
      await saveGeneratedDoc({
        user_id,
        source_cv_id: user_id,
        type: 'cover',
        tone,
        file_name: 'Generated_Cover_Letter.txt',
        content: cover,
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

    // Layer 6 warnings (checks 5-9) ride out with the document so the user
    // sees what the validator flagged; hard failures never reach here.
    const cvWarnings = cvRes?.validation?.warnings || [];
    return {
      ...(cv && { cv }),
      ...(cover && { cover }),
      ...(cvWarnings.length && { cv_warnings: cvWarnings }),
      gemini_usage: [...usagesOf(cvRes), ...usagesOf(coverRes)],
    };
  } finally {
    if (lockHeld) {
      try { await getRedis().del(lockKey); } catch (e) { logger.error('Redis unlock error:', e.message); }
    }
  }
}
