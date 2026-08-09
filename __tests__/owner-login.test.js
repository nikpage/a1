// __tests__/owner-login.test.js — the shared-secret owner door.
//
// This route hands out a real session, so the negative cases are the point:
// a wrong key, a missing key, or a key that merely shares a prefix must get
// nothing — no cookie, no redirect, no hint that the route exists.

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-owner-secret-jwt';
  process.env.API_SHARED_SECRET = 'the-real-shared-secret';
  process.env.NODE_ENV = 'test';
});

import { describe, test, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

const mockGetUserByEmail = vi.hoisted(() => vi.fn());

vi.mock('../utils/database', () => ({
  getUserByEmail: mockGetUserByEmail,
}));

import handler from '../pages/api/auth/owner.js';

function makeRes() {
  const res = {
    statusCode: null,
    body: null,
    headers: {},
    redirectedTo: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    setHeader(name, value) { this.headers[name] = value; },
    redirect(code, url) { this.statusCode = code; this.redirectedTo = url; },
  };
  return res;
}

function cookieHeader(res) {
  const set = res.headers['Set-Cookie'];
  return Array.isArray(set) ? set.join('\n') : set || '';
}

describe('owner login door', () => {
  beforeEach(() => {
    mockGetUserByEmail.mockReset();
    mockGetUserByEmail.mockResolvedValue({ user_id: 'owner-123', email: 'owner@example.com' });
  });

  test('the right key mints a real session for the resolved account and lands on /me', async () => {
    const res = makeRes();
    await handler({ method: 'GET', query: { key: 'the-real-shared-secret', email: 'Owner@Example.com' } }, res);

    expect(res.redirectedTo).toBe('/me');
    expect(mockGetUserByEmail).toHaveBeenCalledWith('owner@example.com');

    const token = cookieHeader(res).match(/auth-token=([^;]+)/)[1];
    const decoded = jwt.verify(token, 'test-owner-secret-jwt');
    expect(decoded.user_id).toBe('owner-123');
    expect(decoded.email).toBe('owner@example.com');
  });

  test('a wrong key gets a bare 404 — no cookie, no redirect, no database lookup', async () => {
    const res = makeRes();
    await handler({ method: 'GET', query: { key: 'wrong-secret', email: 'owner@example.com' } }, res);

    expect(res.statusCode).toBe(404);
    expect(res.redirectedTo).toBeNull();
    expect(cookieHeader(res)).toBe('');
    expect(mockGetUserByEmail).not.toHaveBeenCalled();
  });

  test('a prefix of the real key is rejected — no length or prefix leak', async () => {
    const res = makeRes();
    await handler({ method: 'GET', query: { key: 'the-real-shared-secre', email: 'owner@example.com' } }, res);

    expect(res.statusCode).toBe(404);
    expect(cookieHeader(res)).toBe('');
  });

  test('no key at all is rejected exactly like a wrong one', async () => {
    const res = makeRes();
    await handler({ method: 'GET', query: { email: 'owner@example.com' } }, res);

    expect(res.statusCode).toBe(404);
    expect(cookieHeader(res)).toBe('');
  });

  test('an address with no account gets 404 and no session', async () => {
    mockGetUserByEmail.mockResolvedValue(null);
    const res = makeRes();
    await handler({ method: 'GET', query: { key: 'the-real-shared-secret', email: 'ghost@example.com' } }, res);

    expect(res.statusCode).toBe(404);
    expect(cookieHeader(res)).toBe('');
  });

  test('an unset secret says so instead of pretending the key was wrong', async () => {
    const saved = process.env.API_SHARED_SECRET;
    delete process.env.API_SHARED_SECRET;
    const res = makeRes();
    await handler({ method: 'GET', query: { key: 'anything', email: 'owner@example.com' } }, res);
    process.env.API_SHARED_SECRET = saved;

    expect(res.statusCode).toBe(503);
    expect(res.body.error).toMatch(/API_SHARED_SECRET/);
    expect(cookieHeader(res)).toBe('');
  });

  test('POST is refused — this door is GET only', async () => {
    const res = makeRes();
    await handler({ method: 'POST', query: { key: 'the-real-shared-secret' } }, res);

    expect(res.statusCode).toBe(405);
    expect(cookieHeader(res)).toBe('');
  });
});
