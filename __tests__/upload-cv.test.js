// __tests__/upload-cv.test.js — focused: upload mints session cookie

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-upload-secret-77';
  process.env.NODE_ENV = 'test';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://fake.supabase';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key';
});

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { verifyToken, mintSessionToken } from '../lib/auth.js';
import { createRequest, createResponse } from 'node-mocks-http';

// ── Mock formidable ──────────────────────────────────────────────────────────
// The handler calls form.parse(req, cb). We mock it to deliver a fake PDF file.
// We make `file` an actual Buffer so Buffer.isBuffer(file) is true — the handler
// then uses it directly as the buffer without going through the stream fallback.

vi.mock('formidable', () => ({
  default: () => ({
    parse: (_req, cb) => {
      const fakeFile = Object.assign(Buffer.from('fake pdf bytes'), {
        mimetype: 'application/pdf',
        size: 100,
        filepath: null,
        originalFilename: 'cv.pdf',
      });
      cb(null, {}, { file: fakeFile });
    },
  }),
}));

// ── Mock PDF extractor ───────────────────────────────────────────────────────
// The upload route now extracts text PLUS a layout sidecar, so the boundary mock
// must provide both the plain-text default AND the layout-aware named export.
vi.mock('../utils/pdf-extract.js', () => ({
  default: async () => 'John Smith\nSoftware Engineer\ntest@example.com',
  extractPdfWithLayout: async () => ({
    text: 'John Smith\nSoftware Engineer\ntest@example.com',
    layout: { format: 'pdf', pages: 1, columns: 1, multi_column: false },
  }),
}));

// ── Mock database utils (use vi.hoisted so refs are safe in factory) ─────────
const mockUpsertUser = vi.hoisted(() => vi.fn(async () => {}));
const mockUpsertCV   = vi.hoisted(() => vi.fn(async () => {}));

vi.mock('../utils/database.js', () => ({
  upsertUser: mockUpsertUser,
  upsertCV:   mockUpsertCV,
  supabase: {},
}));

// ── Mock Supabase client (service-role, used directly in upload-cv) ──────────
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }),
      }),
      upsert: () => Promise.resolve({ data: null, error: null }),
    }),
  }),
}));

// ── Import handler after all mocks are in place ──────────────────────────────
import handler from '../pages/api/upload-cv.js';

describe('upload-cv — session cookie minted on successful upload', () => {
  beforeEach(() => {
    mockUpsertUser.mockClear();
    mockUpsertCV.mockClear();
  });

  test('Set-Cookie header present on success and decodes to the returned user_id', async () => {
    const req = createRequest({ method: 'POST' });
    const res = createResponse();

    // Handler uses a formidable callback internally; wrap in a promise to wait for it
    await new Promise((resolve) => {
      handler(req, res);
      // Poll until the response has been ended by the handler
      const interval = setInterval(() => {
        if (res.statusCode !== 200 || res._isEndCalled()) {
          clearInterval(interval);
          resolve();
        }
        // Give the handler up to 1 second
      }, 10);
      setTimeout(() => { clearInterval(interval); resolve(); }, 1000);
    });

    expect(res.statusCode).toBe(200);

    const body = res._getJSONData();
    expect(body.user_id).toBeDefined();
    expect(typeof body.user_id).toBe('string');

    // The layout signal is NOT persisted — only the text is saved — and it is
    // returned in the response so it can ride in-flight to the analysis call.
    expect(mockUpsertCV).toHaveBeenCalledTimes(1);
    const upsertArgs = mockUpsertCV.mock.calls[0];
    expect(upsertArgs[1]).toMatch(/John Smith/);
    expect(upsertArgs).toHaveLength(2); // (user_id, text) — no layout argument
    expect(body.layout).toMatchObject({ format: 'pdf', multi_column: false });

    // Cookie must be present
    const setCookie = res.getHeader('Set-Cookie');
    expect(setCookie).toBeDefined();
    const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    expect(cookieStr).toMatch(/auth-token=/);
    expect(cookieStr).toMatch(/HttpOnly/);

    // Token must decode to the same user_id returned in the body
    const tokenMatch = cookieStr.match(/auth-token=([^;]+)/);
    expect(tokenMatch).not.toBeNull();
    const decoded = await verifyToken(tokenMatch[1]);
    expect(decoded).not.toBeNull();
    expect(decoded.user_id).toBe(body.user_id);
  });
});

// Drives the handler's formidable callback to completion, exactly as the test
// above does. Shared so the session cases below cannot drift from it.
async function runHandler(req, res) {
  await new Promise((resolve) => {
    handler(req, res);
    const interval = setInterval(() => {
      if (res.statusCode !== 200 || res._isEndCalled()) {
        clearInterval(interval);
        resolve();
      }
    }, 10);
    setTimeout(() => { clearInterval(interval); resolve(); }, 1000);
  });
}

// REGRESSION: the route used to call genSessionId() unconditionally — the comment
// claimed "mint from cookie if present" but the cookie was never read. Every
// upload therefore created a NEW account and overwrote the signed-in visitor's
// session cookie with it, orphaning their real profile (tokens, master CV,
// analyses) and logging them out. These pin the identity rule in both directions.
describe('upload-cv — identity comes from the session when there is one', () => {
  beforeEach(() => {
    mockUpsertUser.mockClear();
    mockUpsertCV.mockClear();
  });

  test('a signed-in visitor keeps their user_id — no new account, no logout', async () => {
    const existingId = 'existing-user-id-abc123';
    const token = mintSessionToken({ user_id: existingId, email: 'marta@example.com' });
    const req = createRequest({ method: 'POST', headers: { cookie: `auth-token=${token}` } });
    req.cookies = { 'auth-token': token };
    const res = createResponse();

    await runHandler(req, res);

    expect(res.statusCode).toBe(200);
    // The SAME id is returned, written to the DB, and re-issued in the cookie.
    expect(res._getJSONData().user_id).toBe(existingId);
    expect(mockUpsertUser.mock.calls[0][0]).toBe(existingId);
    expect(mockUpsertCV.mock.calls[0][0]).toBe(existingId);

    const cookieStr = [].concat(res.getHeader('Set-Cookie'))[0];
    const decoded = await verifyToken(cookieStr.match(/auth-token=([^;]+)/)[1]);
    expect(decoded.user_id).toBe(existingId);
    // The email must survive the re-mint, or the session is silently downgraded.
    expect(decoded.email).toBe('marta@example.com');
  });

  test('a forged / expired cookie is ignored and a fresh id is minted', async () => {
    const req = createRequest({ method: 'POST', headers: { cookie: 'auth-token=not.a.real.jwt' } });
    req.cookies = { 'auth-token': 'not.a.real.jwt' };
    const res = createResponse();

    await runHandler(req, res);

    expect(res.statusCode).toBe(200);
    const { user_id } = res._getJSONData();
    expect(user_id).not.toBe('not.a.real.jwt');
    expect(user_id).toMatch(/^[0-9a-f-]{36}$/); // a freshly generated uuid
  });

  test('an anonymous visitor still gets a brand-new id', async () => {
    const req = createRequest({ method: 'POST' });
    const res = createResponse();

    await runHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._getJSONData().user_id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
