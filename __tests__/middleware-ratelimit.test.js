// Proves the in-memory limiter actually throttles — the 11th upload in a
// 60s window is rejected, the window slides, and IPs are independent.
import { describe, test, expect } from 'vitest';
import { __test } from '../middleware.js';

const { allow, WINDOW_MS } = __test;

describe('in-memory rate limiter', () => {
  test('rejects the (max+1)th request inside the window', () => {
    const key = 'k|1.1.1.1';
    const t0 = 1_000_000;
    for (let i = 0; i < 10; i++) expect(allow(key, 10, t0 + i)).toBe(true);
    // 11th within the same minute is blocked.
    expect(allow(key, 10, t0 + 11)).toBe(false);
    // Still blocked later in the same window.
    expect(allow(key, 10, t0 + 30_000)).toBe(false);
  });

  test('window slides: old hits expire and traffic is allowed again', () => {
    const key = 'k|2.2.2.2';
    const t0 = 5_000_000;
    for (let i = 0; i < 10; i++) expect(allow(key, 10, t0 + i)).toBe(true);
    expect(allow(key, 10, t0 + 100)).toBe(false);
    // After the full window passes, the slate is clear.
    expect(allow(key, 10, t0 + WINDOW_MS + 1)).toBe(true);
  });

  test('limits are per-key (per IP), not global', () => {
    const t0 = 9_000_000;
    for (let i = 0; i < 10; i++) allow('k|3.3.3.3', 10, t0 + i);
    expect(allow('k|3.3.3.3', 10, t0 + 11)).toBe(false); // attacker capped
    expect(allow('k|4.4.4.4', 10, t0 + 11)).toBe(true); // other IP unaffected
  });
});
