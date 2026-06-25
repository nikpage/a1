import { NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { logger } from './lib/logger';

// The rate limiter is a PROTECTIVE layer in front of the upload / generate /
// magic-link routes. It must never become a single point of failure for them:
// if Upstash is unconfigured (missing env) or unreachable at request time, the
// edge function used to throw and return a bare 502 ("edge function ...") that
// the browser then tried to JSON.parse — breaking the whole upload flow. So we
// FAIL OPEN here: when the limiter can't run, we allow the request and log the
// error loudly (never silently), rather than block legitimate traffic.

const redisConfigured = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

// @upstash/redis does NOT throw when url/token are missing — it builds a broken
// client that only fails later inside .limit(). Guard construction so a missing
// env surfaces here as "no limiter" (handled by fail-open) instead of a runtime
// crash on the first request.
const redis = redisConfigured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

const makeLimiter = (prefix, max) =>
  redis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(max, '1 m'), prefix }) : null;

const LIMITERS = {
  '/api/upload-cv': makeLimiter('rl_upload', 10),
  '/api/generate-cv-cover': makeLimiter('rl_generate', 10),
  '/api/auth/send-magic-link': makeLimiter('rl_magic_link', 5),
};

export const config = {
  matcher: ['/api/upload-cv', '/api/generate-cv-cover', '/api/auth/send-magic-link'],
};

export async function middleware(request) {
  const path = request.nextUrl.pathname;

  // Only the three matched paths reach here. If a path has no limiter, it means
  // Upstash isn't configured — allow the request rather than 502 it.
  if (!(path in LIMITERS)) return NextResponse.next();
  const limiter = LIMITERS[path];
  if (!limiter) {
    logger.error(`[ratelimit] Upstash not configured — allowing ${path} unthrottled`);
    return NextResponse.next();
  }

  const ip =
    request.headers.get('x-nf-client-connection-ip') ||
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    '127.0.0.1';

  let success = true;
  try {
    ({ success } = await limiter.limit(ip));
  } catch (err) {
    // Upstash unreachable / timed out. Fail open so the core flow keeps working,
    // but surface the error so the real outage is visible (not swallowed).
    logger.error(`[ratelimit] limiter failed on ${path}, failing open:`, err?.message || err);
    return NextResponse.next();
  }

  if (!success) {
    return new NextResponse(
      JSON.stringify({ error: 'Too many requests' }),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  return NextResponse.next();
}
