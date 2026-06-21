// __tests__/delete-account.test.js

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-delete-secret';
  process.env.NODE_ENV = 'test';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://fake.supabase';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fake-anon-key';
});

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { mockReqRes, authCookieFor } from './helpers.js';

const mockDeleteUserData = vi.hoisted(() => vi.fn());

// Mock only the database layer; let requireAuth run for real (uses JWT, no supabase)
vi.mock('../utils/database', () => ({
  deleteUserData: mockDeleteUserData,
}));

// Stub supabase-js so database.js can import without error (lazy singletons, never called)
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({})) }));

import handler from '../pages/api/delete-account.js';

const USER_A = 'user-aaa-111';
const USER_B = 'user-bbb-222';

beforeEach(() => {
  vi.resetAllMocks();
  mockDeleteUserData.mockResolvedValue(undefined);
});

describe('DELETE /api/delete-account', () => {
  test('authenticated DELETE → calls deleteUserData with correct user_id, returns 200 { deleted: true }, clears cookie', async () => {
    const { req, res } = mockReqRes({
      method: 'DELETE',
      cookies: { 'auth-token': authCookieFor(USER_A) },
    });

    await handler(req, res);

    expect(mockDeleteUserData).toHaveBeenCalledWith(USER_A);
    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toEqual({ deleted: true });
    const cookie = res.getHeader('Set-Cookie');
    expect(cookie).toMatch(/auth-token=;/);
    expect(cookie).toMatch(/Max-Age=0/);
  });

  test('deleteUserData throws → error propagates', async () => {
    mockDeleteUserData.mockRejectedValue(new Error('DB error'));
    const { req, res } = mockReqRes({
      method: 'DELETE',
      cookies: { 'auth-token': authCookieFor(USER_A) },
    });

    await expect(handler(req, res)).rejects.toThrow('DB error');
  });

  test('unauthenticated request (no cookie) → 401', async () => {
    const { req, res } = mockReqRes({ method: 'DELETE', cookies: {} });

    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(mockDeleteUserData).not.toHaveBeenCalled();
  });

  test('cross-user: user_id comes from session, not request body — user A cannot delete user B', async () => {
    // Even if user A sends user B's id in the body, the handler uses req.user.user_id
    const { req, res } = mockReqRes({
      method: 'DELETE',
      cookies: { 'auth-token': authCookieFor(USER_A) },
      body: { user_id: USER_B },
    });

    await handler(req, res);

    expect(mockDeleteUserData).toHaveBeenCalledWith(USER_A);
    expect(mockDeleteUserData).not.toHaveBeenCalledWith(USER_B);
  });
});
