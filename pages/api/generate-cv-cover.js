// pages/api/generate-cv-cover.js

import { logger } from '../../lib/logger';
import { getCV, saveGeneratedDoc, logAiTransaction } from '../../utils/database';
import { getUserById, decrementGenerations } from '../../utils/generation-utils';
import { generateCV, generateCoverLetter } from '../../utils/openai';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';
import requireAuth from '../../lib/requireAuth';

const redis = Redis.fromEnv();

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user_id = req.user.user_id;
  const { analysis: analysisRaw, tone = 'Formal', type = 'both', tweak = '' } = req.body;
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
  const acquired = await redis.set(lockKey, '1', { nx: true, ex: 30 });
  if (acquired !== 'OK') return res.status(429).json({ error: 'Generation already in progress' });

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

    let cvRecord;
    try {
      cvRecord = await getCV(user_id);
      if (!cvRecord || !cvRecord.cv_data) {
        return res.status(404).json({ error: 'CV not found for user' });
      }
    } catch (dbErr) {
      logger.error('CV fetch error:', dbErr.message);
      return res.status(500).json({ error: 'Error fetching CV data' });
    }

    let cvRes = null;
    let coverRes = null;
    let cv = null;
    let cover = null;

    try {
      if (type === 'cv' || type === 'both') {
        cvRes = await generateCV({ cv: cvRecord.cv_data, analysis, tone, tweak, core });
        cv = cvRes.content;
      }

      if (type === 'cover' || type === 'both') {
        coverRes = await generateCoverLetter({ cv: cvRecord.cv_data, analysis, tone, tweak, core });
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

      if (type === 'cv' || type === 'both') {
        const gu = cvRes.gemini_usage;
        await logAiTransaction({
          user_id,
          source_gen_id: crypto.randomUUID(),
          model: gu.model,
          cache_hit_tokens: 0,
          cache_miss_tokens: gu.inputTokens,
          completion_tokens: gu.outputTokens + gu.thinkingTokens,
          thinking_tokens: gu.thinkingTokens,
          detail: { tone, type: 'cv' },
        });
      }
      if (type === 'cover' || type === 'both') {
        const gu = coverRes.gemini_usage;
        await logAiTransaction({
          user_id,
          source_gen_id: crypto.randomUUID(),
          model: gu.model,
          cache_hit_tokens: 0,
          cache_miss_tokens: gu.inputTokens,
          completion_tokens: gu.outputTokens + gu.thinkingTokens,
          thinking_tokens: gu.thinkingTokens,
          detail: { tone, type: 'cover' },
        });
      }

      const gemini_usage = [
        ...(cvRes?.gemini_usage ? [cvRes.gemini_usage] : []),
        ...(coverRes?.gemini_usage ? [coverRes.gemini_usage] : []),
      ];
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
    await redis.del(lockKey);
  }
}

export default requireAuth(handler);
