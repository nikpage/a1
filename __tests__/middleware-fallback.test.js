// Proves the in-memory fallback (used when Upstash is down) actually throttles:
// the 11th request in the window is rejected, the window slides, IPs are
// independent. Red on a no-op fallback that always returns true.
import { describe, test, expect } from 'vitest';
import { __test } from '../middleware.js';

const { fallbackAllow, FALLBACK_WINDOW_MS } = __test;

describe('in-memory rate-limit fallback', () => {
  test('rejects the (max+1)th request inside the window', () => {
    const key = 'k|1.1.1.1';
    const t0 = 1_000_000;
    for (let i = 0; i < 10; i++) expect(fallbackAllow(key, 10, t0 + i)).toBe(true);
    expect(fallbackAllow(key, 10, t0 + 11)).toBe(false);
    expect(fallbackAllow(key, 10, t0 + 30_000)).toBe(false);
  });

  test('window slides: old hits expire and traffic is allowed again', () => {
    const key = 'k|2.2.2.2';
    const t0 = 5_000_000;
    for (let i = 0; i < 10; i++) expect(fallbackAllow(key, 10, t0 + i)).toBe(true);
    expect(fallbackAllow(key, 10, t0 + 100)).toBe(false);
    expect(fallbackAllow(key, 10, t0 + FALLBACK_WINDOW_MS + 1)).toBe(true);
  });

  test('limits are per-key (per IP), not global', () => {
    const t0 = 9_000_000;
    for (let i = 0; i < 10; i++) fallbackAllow('k|3.3.3.3', 10, t0 + i);
    expect(fallbackAllow('k|3.3.3.3', 10, t0 + 11)).toBe(false);
    expect(fallbackAllow('k|4.4.4.4', 10, t0 + 11)).toBe(true);
  });
});
