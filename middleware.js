import { NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const uploadLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  prefix: 'rl_upload',
});

const generateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  prefix: 'rl_generate',
});

const magicLinkLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 m'),
  prefix: 'rl_magic_link',
});

const LIMITERS = {
  '/api/upload-cv': uploadLimiter,
  '/api/generate-cv-cover': generateLimiter,
  '/api/auth/send-magic-link': magicLinkLimiter,
};

// Per-path max requests per minute — kept in step with the Upstash limiters
// above. Used only by the in-memory fallback when Upstash is unreachable.
const FALLBACK_MAX = {
  '/api/upload-cv': 10,
  '/api/generate-cv-cover': 10,
  '/api/auth/send-magic-link': 5,
};
const FALLBACK_WINDOW_MS = 60_000;

// `path|ip` -> timestamps within the current window. Lives in this server
// copy's memory; only consulted if Upstash throws, so users are never locked
// out by a Redis outage while abusers still get throttled (per-copy).
const fallbackHits = new Map();

function fallbackAllow(key, max, now) {
  const fresh = (fallbackHits.get(key) || []).filter((ts) => now - ts < FALLBACK_WINDOW_MS);
  if (fresh.length >= max) {
    fallbackHits.set(key, fresh);
    return false;
  }
  fresh.push(now);
  fallbackHits.set(key, fresh);
  if (fallbackHits.size > 5000) {
    for (const [k, arr] of fallbackHits) {
      if (!arr.some((ts) => now - ts < FALLBACK_WINDOW_MS)) fallbackHits.delete(k);
    }
  }
  return true;
}

export const config = {
  matcher: ['/api/upload-cv', '/api/generate-cv-cover', '/api/auth/send-magic-link'],
};

export async function middleware(request) {
  const path = request.nextUrl.pathname;
  const limiter = LIMITERS[path];
  if (!limiter) return NextResponse.next();

  const ip =
    request.headers.get('x-nf-client-connection-ip') ||
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    '127.0.0.1';

  let success;
  try {
    ({ success } = await limiter.limit(ip));
  } catch (err) {
    // Upstash unreachable — degrade to the in-memory limiter instead of 502ing
    // the request. Still throttles; never locks users out over a Redis outage.
    console.error(`[ratelimit] Upstash failed on ${path}, using in-memory fallback:`, err?.message || err);
    success = fallbackAllow(`${path}|${ip}`, FALLBACK_MAX[path], Date.now());
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

// Exported for tests — proves the fallback actually throttles.
export const __test = { fallbackAllow, FALLBACK_WINDOW_MS, FALLBACK_MAX };
