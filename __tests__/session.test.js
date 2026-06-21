// __tests__/session.test.js — tests for lib/session.js, lib/requireAuth.js, and security

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-session-secret-42';
  process.env.NODE_ENV = 'test';
});

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { mockReqRes, authCookieFor } from './helpers.js';

// ── lib/session.js ──────────────────────────────────────────────────────────
import { setSessionCookie } from '../lib/session.js';
import { verifyToken } from '../lib/auth.js';

describe('setSessionCookie', () => {
  test('sets an HttpOnly auth-token cookie that verifyToken decodes back to the user_id', async () => {
    const { req, res } = mockReqRes();
    const user_id = 'user-abc-123';

    setSessionCookie(res, { user_id });

    const setCookie = res.getHeader('Set-Cookie');
    expect(setCookie).toBeDefined();
    const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    expect(cookieStr).toMatch(/auth-token=/);
    expect(cookieStr).toMatch(/HttpOnly/);

    const tokenMatch = cookieStr.match(/auth-token=([^;]+)/);
    expect(tokenMatch).not.toBeNull();
    const token = tokenMatch[1];

    const decoded = await verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded.user_id).toBe(user_id);
  });

  test('cookie uses SameSite=None; Secure in production', () => {
    const savedEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const { req, res } = mockReqRes();
    setSessionCookie(res, { user_id: 'u1' });

    const raw = res.getHeader('Set-Cookie');
    const cookieStr = Array.isArray(raw) ? raw[0] : raw;
    expect(cookieStr).toMatch(/SameSite=None/);
    expect(cookieStr).toMatch(/Secure/);

    process.env.NODE_ENV = savedEnv;
  });
});

// ── lib/requireAuth.js ──────────────────────────────────────────────────────
import requireAuth from '../lib/requireAuth.js';

describe('requireAuth middleware', () => {
  test('returns 401 when no auth-token cookie is present', async () => {
    const handler = vi.fn();
    const wrapped = requireAuth(handler);
    const { req, res } = mockReqRes({ method: 'GET', cookies: {} });

    await wrapped(req, res);

    expect(res.statusCode).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  test('calls handler with req.user.user_id when a valid cookie is present', async () => {
    const user_id = 'user-xyz-789';
    const cookieValue = authCookieFor(user_id);

    const handler = vi.fn(async (req, res) => res.status(200).json({ ok: true }));
    const wrapped = requireAuth(handler);
    const { req, res } = mockReqRes({ cookies: { 'auth-token': cookieValue } });

    await wrapped(req, res);

    expect(handler).toHaveBeenCalledOnce();
    expect(req.user).toBeDefined();
    expect(req.user.user_id).toBe(user_id);
  });

  test('returns 401 for a tampered token', async () => {
    const handler = vi.fn();
    const wrapped = requireAuth(handler);
    const { req, res } = mockReqRes({ cookies: { 'auth-token': 'not.a.valid.jwt' } });

    await wrapped(req, res);

    expect(res.statusCode).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });
});

// ── Cross-user attack test ───────────────────────────────────────────────────
// tokens.js reads user_id from req.user (set by requireAuth) and IGNORES req.query.
// The test proves that injecting user_id=B in the query while holding A's cookie
// returns A's data, not B's. The mock returns different token counts per user so
// the assertion distinguishes whose data was fetched.
//
// This test MUST FAIL if someone reverts tokens.js to read user_id from req.query:
// then getUser would be called with B's id, returning 0 tokens, and expect(tokens).toBe(99) fails.

const USER_A = { user_id: 'user-A', tokens: 99, generations_left: 5 };
const USER_B = { user_id: 'user-B', tokens: 0,  generations_left: 0 };

// vi.hoisted ensures mockGetUser is initialised before vi.mock factory evaluates
const mockGetUser = vi.hoisted(() => vi.fn());

vi.mock('../utils/database.js', () => ({
  getUser: mockGetUser,
  supabase: {},
}));

import tokensHandler from '../pages/api/tokens.js';

describe('tokens.js — cross-user attack', () => {
  beforeEach(() => mockGetUser.mockReset());

  test('sanity: valid cookie → 200 and getUser called with cookie user_id', async () => {
    mockGetUser.mockResolvedValue({ tokens: 55, generations_left: 2 });
    const cookieValue = authCookieFor('sanity-uid');
    const { req, res } = mockReqRes({ cookies: { 'auth-token': cookieValue } });

    await tokensHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mockGetUser).toHaveBeenCalledWith('sanity-uid');
  });

  test('no cookie → 401 (route is protected)', async () => {
    const { req, res } = mockReqRes({ method: 'GET', cookies: {}, query: { user_id: USER_A.user_id } });

    await tokensHandler(req, res);

    expect(res.statusCode).toBe(401);
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  test('cookie for A with user_id=B in query returns A data (injected id is ignored)', async () => {
    // Return user-specific data so we can distinguish whose data was fetched
    mockGetUser.mockImplementation(async (uid) => {
      if (uid === USER_A.user_id) return { tokens: USER_A.tokens, generations_left: USER_A.generations_left };
      // B's id or anything else → return B's low balance; assertion on tokens catches the violation
      return { tokens: USER_B.tokens, generations_left: USER_B.generations_left };
    });

    const cookieValue = authCookieFor(USER_A.user_id);
    const { req, res } = mockReqRes({
      method: 'GET',
      cookies: { 'auth-token': cookieValue },
      query: { user_id: USER_B.user_id }, // attacker injects B's id
    });

    await tokensHandler(req, res);

    expect(res.statusCode).toBe(200);
    const body = res._getJSONData();
    // Must return A's token count (99), not B's (0)
    expect(body.tokens).toBe(USER_A.tokens);
    // getUser must have been called with A's id, never B's or undefined
    const calledWith = mockGetUser.mock.calls.map(c => c[0]);
    expect(calledWith).toContain(USER_A.user_id);
    expect(calledWith).not.toContain(USER_B.user_id);
    expect(calledWith.every(uid => uid !== undefined)).toBe(true);
  });
});
