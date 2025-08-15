// middleware.js

import { NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const ratelimitPublic = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '60 s'), // 1 req/min for public
  prefix: 'rl_public',
});

// CORS
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:3001';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  // 'Access-Control-Allow-Credentials': 'true', // enable only if you use cookies
  'Vary': 'Origin',
};

export const config = {
  // include upload endpoint too (CORS error came from /api/upload-cv)
  matcher: ['/api/analyze-cv-job', '/api/upload-cv'],
};

export async function middleware(request) {
  // Preflight: respond with CORS headers and exit early (no rate limit / size checks)
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
  }

  // Lightweight payload cap using header only (body not readable at the edge)
  const maxSizeKB = Number(process.env.MAX_FILE_SIZE_KB) || 100;
  const limitInBytes = maxSizeKB * 1024;
  const contentLengthHeader = request.headers.get('content-length');
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : null;
  if (contentLength !== null && !Number.isNaN(contentLength) && contentLength > limitInBytes) {
    return new NextResponse(
      JSON.stringify({ error: 'Payload too large' }),
      { status: 413, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    );
  }

  // Public edge limiter keyed by IP + UA (auth verified inside route)
  const xff = request.headers.get('x-forwarded-for');
  const clientIp = xff ? xff.split(',')[0].trim() : (request.ip || 'unknown');
  const ua = request.headers.get('user-agent') || 'unknown';
  const key = `ip:${clientIp}|ua:${ua}`;

  const { success } = await ratelimitPublic.limit(key);
  if (!success) {
    return new NextResponse(
      JSON.stringify({ error: 'Too many requests' }),
      { status: 429, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    );
  }

  // Pass-through: attach CORS headers to downstream response
  const res = NextResponse.next();
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}
