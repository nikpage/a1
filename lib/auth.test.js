import { describe, test, expect, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';

// Set JWT_SECRET before auth.js module loads (vi.hoisted runs before imports)
vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-fixed-secret-for-auth-tests';
});

import { mintSessionToken, verifyToken } from './auth.js';

const TEST_SECRET = 'test-fixed-secret-for-auth-tests';

describe('auth — JWT mint→verify roundtrip', () => {
  test('minted token round-trips with correct payload', async () => {
    const token = mintSessionToken({ user_id: 'u123', email: 'a@b.com' });
    const result = await verifyToken(token);
    expect(result).toEqual({ user_id: 'u123', email: 'a@b.com' });
  });

  test('token signed with different secret returns null', async () => {
    const token = jwt.sign({ user_id: 'u123', email: 'a@b.com' }, 'other-secret', { expiresIn: '1h' });
    const result = await verifyToken(token);
    expect(result).toBeNull();
  });

  test('structurally tampered token returns null', async () => {
    const token = mintSessionToken({ user_id: 'u123', email: 'a@b.com' });
    const [header, payload, sig] = token.split('.');
    // flip first character of payload to corrupt it
    const tamperedPayload = String.fromCharCode(payload.charCodeAt(0) ^ 1) + payload.slice(1);
    const tampered = [header, tamperedPayload, sig].join('.');
    const result = await verifyToken(tampered);
    expect(result).toBeNull();
  });

  test('verifyToken(null) returns null', async () => {
    const result = await verifyToken(null);
    expect(result).toBeNull();
  });
});

describe('auth — no secret throws at call time (Task 1.1)', () => {
  // getSecret() reads env lazily at call time — no module reload needed.
  afterEach(() => {
    process.env.JWT_SECRET = TEST_SECRET;
  });

  test('mintSessionToken throws when JWT_SECRET and API_SHARED_SECRET are unset', () => {
    delete process.env.JWT_SECRET;
    delete process.env.API_SHARED_SECRET;
    expect(() => mintSessionToken({ user_id: 'x' })).toThrow('JWT_SECRET');
    // restore happens in afterEach
  });

  test('mintSessionToken works once JWT_SECRET is restored', () => {
    // env was deleted by previous test but afterEach restores it
    process.env.JWT_SECRET = TEST_SECRET;
    expect(() => mintSessionToken({ user_id: 'y' })).not.toThrow();
  });

  test('verifyToken propagates the missing-secret error', async () => {
    delete process.env.JWT_SECRET;
    delete process.env.API_SHARED_SECRET;
    // verifyToken calls getSecret() before jwt.verify; it throws synchronously inside the try.
    // The catch block re-returns null for jwt errors, but getSecret() throws before jwt is called.
    // So verifyToken will throw (not return null).
    await expect(verifyToken('some-token')).rejects.toThrow('JWT_SECRET');
  });
});
