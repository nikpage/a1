import { describe, test, expect, beforeAll } from 'vitest';
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
