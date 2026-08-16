// netlify/functions/generate-background.mjs
//
// Background generation worker. The *-background suffix gives Netlify the 15-min
// budget instead of the 10s sync limit that was returning 502 HTML pages to the
// browser once the CV rule stack made a run up to six Gemini calls.
//
// Called DIRECTLY by the browser (relative URL) — no server-to-server hop. It
// returns 202 immediately and ALWAYS publishes a terminal status (done or error)
// for the client-minted generation_id, so the poll never hangs on silence.

import * as Sentry from '@sentry/node';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { runGeneration, GenerationError } from '../../utils/run-generation.js';
import { saveGenerationStatus } from '../../utils/database.js';
import { verifyToken } from '../../lib/auth.js';
import { logger } from '../../lib/logger.js';

// `/.netlify/functions/*` is not routed through Next's middleware, so the 10/min
// generate limiter that used to sit there cannot apply. It is enforced here
// instead — same window and same `rl_generate` prefix, keyed by the verified
// user rather than the IP, which is the stronger key for an authenticated,
// money-spending path.
let _limiter;
function getLimiter() {
  if (!_limiter) {
    _limiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      prefix: 'rl_generate',
    });
  }
  return _limiter;
}

function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key.trim() === name) return rest.join('=').trim();
  }
  return null;
}

export const handler = async (event) => {
  const cookieHeader = event.headers?.cookie || event.headers?.Cookie || '';
  const verified = await verifyToken(parseCookie(cookieHeader, 'auth-token'));
  // Generation touches tokens and PII, so the session is the ONLY source of the
  // user_id — never the request body.
  if (!verified?.user_id) return { statusCode: 401 };
  const user_id = verified.user_id;

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400 };
  }

  const { generation_id, analysis, tone, type, tweak, language } = body;
  if (!generation_id) {
    logger.error('[generate-bg] missing generation_id');
    return { statusCode: 400 };
  }

  try {
    // A limiter outage must not take down writing — same fail-open stance the
    // generation lock takes.
    try {
      const { success } = await getLimiter().limit(user_id);
      if (!success) throw new GenerationError('Too many requests. Please wait a moment.', 429);
    } catch (rlErr) {
      if (rlErr instanceof GenerationError) throw rlErr;
      logger.error('[generate-bg] rate limiter unavailable, proceeding:', rlErr.message);
    }

    const result = await runGeneration({ user_id, generation_id, analysis, tone, type, tweak, language });
    await saveGenerationStatus(user_id, generation_id, { status: 'done', ...result });
  } catch (e) {
    if (!(e instanceof GenerationError)) {
      Sentry.captureException(e);
      logger.error('[generate-bg] generation error:', e.response?.data || e.message);
    }
    const payload = e instanceof GenerationError
      ? { status: 'error', error: e.code, httpStatus: e.status, ...(e.detail !== undefined && { detail: e.detail }) }
      : { status: 'error', error: e.message || 'Generation failed', httpStatus: 500 };
    try {
      await saveGenerationStatus(user_id, generation_id, payload);
    } catch (pubErr) {
      logger.error('[generate-bg] could not save error status:', pubErr.message);
    }
  }

  return { statusCode: 202 };
};
