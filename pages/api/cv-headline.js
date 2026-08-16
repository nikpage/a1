// pages/api/cv-headline.js
//
// The CV headline (the tagline under the name) edited on its own, without
// rewriting the whole document. Three actions, all operating on the CV the user
// is looking at:
//   set        — persist the headline the user typed in place
//   remove     — drop the headline line
//   regenerate — one small Gemini call for a fresh headline, then persist
//
// A headline change is NOT a document generation: it never touches the free-write
// allowance and never spends a download token. The Gemini call is still cost-logged
// like every other AI call. Persistence goes through the SAME path the generator
// uses (saveGeneratedDoc → a new gen_data row, which get-docs then reads back).

import { logger } from '../../lib/logger';
import { getGenerationSource, saveGeneratedDoc } from '../../utils/database';
import { withAiContext } from '../../utils/ai-meter';
import { generateHeadline } from '../../utils/openai';
import { writeHeadline, readHeadline, removeHeadline } from '../../utils/cv-headline';
import { GENERATION_LANGUAGES } from '../../prompts/language';
import { Redis } from '@upstash/redis';
import requireAuth from '../../lib/requireAuth';

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
  const {
    action = 'set',
    content,
    headline = '',
    analysis: analysisRaw,
    tone = 'Formal',
    language: languageRaw = 'auto',
  } = req.body;

  if (typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: 'Missing CV content' });
  }
  if (!['set', 'remove', 'regenerate'].includes(action)) {
    return res.status(400).json({ error: 'Unknown action' });
  }

  const language = GENERATION_LANGUAGES[languageRaw] ? languageRaw : 'auto';

  let updated;
  let gemini_usage = [];

  if (action === 'remove') {
    updated = removeHeadline(content);
  } else if (action === 'set') {
    if (typeof headline !== 'string' || !headline.trim()) {
      return res.status(400).json({ error: 'Missing headline' });
    }
    updated = writeHeadline(content, headline);
  } else {
    let analysis;
    try {
      analysis = typeof analysisRaw === 'string' ? JSON.parse(analysisRaw) : analysisRaw;
    } catch {
      return res.status(400).json({ error: 'Invalid analysis JSON' });
    }

    // Short per-user lock: a headline re-roll is free, so the lock is what stops
    // a held-down button turning into a burst of Gemini calls. Best-effort — a
    // Redis outage must not block the user (same rule as the generator).
    const lockKey = `headline_lock:${user_id}`;
    let lockHeld = false;
    try {
      const acquired = await getRedis().set(lockKey, '1', { nx: true, ex: 15 });
      if (acquired !== 'OK') return res.status(429).json({ error: 'Headline already being written' });
      lockHeld = true;
    } catch (redisErr) {
      logger.error('Redis lock unavailable, proceeding without lock:', redisErr.message);
    }

    try {
      let source;
      try {
        source = await getGenerationSource(user_id);
      } catch {
        return res.status(500).json({ error: 'Error fetching CV data' });
      }
      if (!source) return res.status(404).json({ error: 'CV not found for user' });

      let result;
      try {
        result = await generateHeadline({
          cv: source,
          analysis,
          tone,
          current: readHeadline(content),
          language,
        });
      } catch (err) {
        const detail = err?.response?.data || err?.message || 'unknown';
        logger.error('Headline generation error:', detail);
        return res.status(500).json({ error: 'Headline generation failed', detail });
      }

      if (!result.content) {
        return res.status(500).json({ error: 'Headline generation failed' });
      }
      updated = writeHeadline(content, result.content);
      gemini_usage = result.gemini_usages;

      // Cost logging is not optional — and it no longer happens here: the meter
      // inside callGemini wrote a row for each of these calls as it responded.
    } finally {
      if (lockHeld) {
        try { await getRedis().del(lockKey); } catch (e) { logger.error('Redis unlock error:', e.message); }
      }
    }
  }

  try {
    await saveGeneratedDoc({
      user_id,
      source_cv_id: user_id,
      type: 'cv',
      tone,
      file_name: 'Generated_CV.txt',
      content: updated,
    });
  } catch (err) {
    logger.error('Headline save error:', err.message);
    return res.status(500).json({ error: 'Could not save the CV' });
  }

  return res.status(200).json({ cv: updated, headline: readHeadline(updated), gemini_usage });
}

export default requireAuth(withAiContext('api:cv-headline', handler));
