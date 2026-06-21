// __tests__/upload-cv.test.js — focused: upload mints session cookie

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-upload-secret-77';
  process.env.NODE_ENV = 'test';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://fake.supabase';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key';
});

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { verifyToken } from '../lib/auth.js';
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
vi.mock('../utils/pdf-extract.js', () => ({
  default: async () => 'John Smith\nSoftware Engineer\ntest@example.com',
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
