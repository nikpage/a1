// __tests__/header-stats.test.js

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-header-stats-secret';
  process.env.NODE_ENV = 'test';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://fake.supabase';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fake-anon-key';
});

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { mockReqRes, authCookieFor } from './helpers.js';

// Only the outside world (Supabase) is stubbed. requireAuth, the handler and
// getUserStats all run for real — including the column projection, which this
// stub honours so an under-specified select() shows up as a missing field.
const state = vi.hoisted(() => ({ rows: {}, selects: [] }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from(table) {
      let cols = [];
      let row = null;
      const chain = {
        select(c) { cols = c.split(',').map(s => s.trim()); state.selects.push(c); return chain; },
        eq(field, value) {
          if (table === 'users' && field === 'user_id') row = state.rows[value] ?? null;
          return chain;
        },
        single() {
          if (!row) return Promise.resolve({ data: null, error: { message: 'no rows' } });
          const projected = {};
          for (const c of cols) if (c in row) projected[c] = row[c];
          return Promise.resolve({ data: projected, error: null });
        },
      };
      return chain;
    },
  })),
}));

import handler from '../pages/api/header-stats.js';

const USER_A = 'user-header-aaa';

beforeEach(() => {
  state.rows = {};
  state.selects = [];
});

describe('GET /api/header-stats', () => {
  test('downloads = free_downloads_left + tokens', async () => {
    state.rows[USER_A] = {
      user_id: USER_A,
      generations_left: 3,
      tokens: 2,
      free_downloads_left: 1000,
      email: 'a@example.com',
    };

    const { req, res } = mockReqRes({ cookies: { 'auth-token': authCookieFor(USER_A) } });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toEqual({
      generations: 3,
      downloads: 1002,
      email: 'a@example.com',
    });
  });

  test('missing balances default to 0', async () => {
    state.rows[USER_A] = { user_id: USER_A, email: null };

    const { req, res } = mockReqRes({ cookies: { 'auth-token': authCookieFor(USER_A) } });
    await handler(req, res);

    expect(res._getJSONData()).toEqual({ generations: 0, downloads: 0, email: null });
  });

  test('free credits alone are counted when tokens are 0', async () => {
    state.rows[USER_A] = { user_id: USER_A, generations_left: 0, tokens: 0, free_downloads_left: 5, email: null };

    const { req, res } = mockReqRes({ cookies: { 'auth-token': authCookieFor(USER_A) } });
    await handler(req, res);

    expect(res._getJSONData().downloads).toBe(5);
  });

  test('user_id comes from the session cookie, never the body', async () => {
    state.rows[USER_A] = { user_id: USER_A, generations_left: 1, tokens: 0, free_downloads_left: 7, email: null };
    state.rows['victim'] = { user_id: 'victim', generations_left: 99, tokens: 99, free_downloads_left: 99, email: 'v@example.com' };

    const { req, res } = mockReqRes({
      method: 'POST',
      cookies: { 'auth-token': authCookieFor(USER_A) },
      body: { user_id: 'victim' },
    });
    await handler(req, res);

    expect(res._getJSONData()).toEqual({ generations: 1, downloads: 7, email: null });
  });

  test('unauthenticated request is rejected', async () => {
    const { req, res } = mockReqRes({});
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });
});
