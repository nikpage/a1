import { NextResponse } from 'next/server';

// In-memory sliding-window rate limiter. No external store, so nothing to
// delete or lose connectivity to — a dead dependency can never again 502 the
// upload flow. Trade-off: state lives per running server instance (Netlify runs
// several), so this throttles per-instance/best-effort rather than globally.
// For strict global limits a shared store (Redis) is required; this is the
// resilient floor that always works.

const WINDOW_MS = 60_000;

const LIMITS = {
  '/api/upload-cv': 10,
  '/api/generate-cv-cover': 10,
  '/api/auth/send-magic-link': 5,
};

// key (`path|ip`) -> array of request timestamps within the current window.
const hits = new Map();

function allow(key, max, now) {
  const fresh = (hits.get(key) || []).filter((ts) => now - ts < WINDOW_MS);
  if (fresh.length >= max) {
    hits.set(key, fresh); // persist the pruned list; do NOT record this one
    return false;
  }
  fresh.push(now);
  hits.set(key, fresh);
  return true;
}

// Opportunistic cleanup so the Map can't grow unbounded across many IPs.
function sweep(now) {
  if (hits.size < 5000) return;
  for (const [k, arr] of hits) {
    if (!arr.some((ts) => now - ts < WINDOW_MS)) hits.delete(k);
  }
}

export const config = {
  matcher: ['/api/upload-cv', '/api/generate-cv-cover', '/api/auth/send-magic-link'],
};

export async function middleware(request) {
  const path = request.nextUrl.pathname;
  const max = LIMITS[path];
  if (!max) return NextResponse.next();

  const ip =
    request.headers.get('x-nf-client-connection-ip') ||
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    '127.0.0.1';

  const now = Date.now();
  sweep(now);

  if (!allow(`${path}|${ip}`, max, now)) {
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

// Exported for tests — proves the limiter actually rejects over-limit traffic.
export const __test = { allow, WINDOW_MS, LIMITS };
