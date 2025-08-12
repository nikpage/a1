import { NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(2, '30 s'),
  prefix: 'ratelimit_middleware',
});

export const config = {
  matcher: '/api/analyze-cv-job',
};

export async function middleware(request) {
  const maxSizeKB = Number(process.env.MAX_FILE_SIZE_KB) || 100;
  const limitInBytes = maxSizeKB * 1024;
  const contentLength = Number(request.headers.get('content-length'));

  if (isNaN(contentLength) || contentLength > limitInBytes) {
    return new NextResponse(
      JSON.stringify({ error: 'Payload too large' }),
      {
        status: 413,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  const ip = request.ip ?? '127.0.0.1';
  const { success } = await ratelimit.limit(ip);

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
