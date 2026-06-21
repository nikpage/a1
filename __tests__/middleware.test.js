// __tests__/middleware.test.js — tests for 2.4: rate limiter configuration
//
// Next.js edge middleware cannot be executed in a Node.js/vitest environment (it uses
// the Web Request/Response API and @upstash/ratelimit makes live network calls). Testing
// the full runtime behaviour is not feasible here without a real Edge runtime harness.
//
// What IS testable: the rate limiter configuration — that three Ratelimit instances are
// constructed with the correct window sizes and request limits, and that the matcher
// targets exactly the three routes that should be rate-limited. This is the honesty-clause
// allowance from the Testing law: we document the gap and test what we can.

vi.hoisted(() => {
  process.env.UPSTASH_REDIS_REST_URL = 'http://fake.redis';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';
});

import { describe, test, expect, vi } from 'vitest';

// Capture constructor args in a hoisted array so the vi.mock factory can access it.
const ratelimitCtorCalls = vi.hoisted(() => []);
const mockSlidingWindow  = vi.hoisted(() => vi.fn((n, t) => ({ _type: 'slidingWindow', n, t })));

vi.mock('@upstash/ratelimit', () => {
  class Ratelimit {
    constructor(config) {
      ratelimitCtorCalls.push(config);
    }
    async limit() { return { success: true }; }
  }
  Ratelimit.slidingWindow = mockSlidingWindow;
  return { Ratelimit };
});

vi.mock('@upstash/redis', () => ({
  Redis: class {
    constructor() {}
  },
}));

// Importing middleware triggers the three Ratelimit constructor calls at module load time.
import * as middlewareMod from '../middleware.js';

describe('2.4 — middleware rate limiter configuration', () => {
  test('creates exactly three Ratelimit instances', () => {
    expect(ratelimitCtorCalls).toHaveLength(3);
  });

  test('uses slidingWindow with 10 req/min for upload-cv and generate-cv-cover', () => {
    const tenPerMin = mockSlidingWindow.mock.calls.filter(
      ([n, t]) => n === 10 && t === '1 m'
    );
    expect(tenPerMin).toHaveLength(2);
  });

  test('uses slidingWindow with 5 req/min for send-magic-link', () => {
    const fivePerMin = mockSlidingWindow.mock.calls.filter(
      ([n, t]) => n === 5 && t === '1 m'
    );
    expect(fivePerMin).toHaveLength(1);
  });

  test('matcher targets exactly the three rate-limited routes', () => {
    expect(middlewareMod.config.matcher).toEqual([
      '/api/upload-cv',
      '/api/generate-cv-cover',
      '/api/auth/send-magic-link',
    ]);
  });
});
