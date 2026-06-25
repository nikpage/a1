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

  const { success } = await limiter.limit(ip);

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
