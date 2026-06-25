// __tests__/send-magic-link.test.js

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-magic-secret';
  process.env.NODE_ENV = 'test';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://fake.supabase';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fake-anon-key';
  process.env.UPSTASH_REDIS_REST_URL = 'http://fake.redis';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';
  process.env.RESEND_FROM_EMAIL = 'noreply@mysuper.cv';
});

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { mockReqRes } from './helpers.js';

const mockSend = vi.hoisted(() => vi.fn());

vi.mock('resend', () => ({
  Resend: class {
    constructor() {
      this.emails = { send: mockSend };
    }
  },
}));

vi.mock('@upstash/redis', () => ({
  Redis: { fromEnv: () => ({}) },
}));

vi.mock('@upstash/ratelimit', () => {
  class Ratelimit {
    constructor() {}
    limit() { return Promise.resolve({ success: true }); }
  }
  Ratelimit.slidingWindow = vi.fn();
  return { Ratelimit };
});

vi.mock('../utils/originCheck', () => ({
  isValidOrigin: () => true,
  getBaseUrl: () => 'https://mysuper.cv',
}));

const mockGetUserByEmail           = vi.hoisted(() => vi.fn());
const mockUpdateUserEmail          = vi.hoisted(() => vi.fn());
const mockCreateUserWithEmail      = vi.hoisted(() => vi.fn());
const mockDeleteMagicTokensByEmail = vi.hoisted(() => vi.fn());
const mockInsertMagicToken         = vi.hoisted(() => vi.fn());

vi.mock('../utils/database', () => ({
  getUserByEmail: mockGetUserByEmail,
  updateUserEmail: mockUpdateUserEmail,
  createUserWithEmail: mockCreateUserWithEmail,
  deleteMagicTokensByEmail: mockDeleteMagicTokensByEmail,
  insertMagicToken: mockInsertMagicToken,
}));

import handler from '../pages/api/auth/send-magic-link.js';

const VALID_EMAIL = 'user@example.com';

beforeEach(() => {
  vi.resetAllMocks();
  mockSend.mockResolvedValue({ error: null });
  mockGetUserByEmail.mockResolvedValue(null);
  mockCreateUserWithEmail.mockResolvedValue({ user_id: 'uid-new-456' });
  mockDeleteMagicTokensByEmail.mockResolvedValue(undefined);
  mockInsertMagicToken.mockResolvedValue(undefined);
});

describe('POST /api/auth/send-magic-link', () => {
  test('NODE_ENV !== production: dev shortcut returns 200 with devLink and does NOT call resend', async () => {
    const { req, res } = mockReqRes({
      method: 'POST',
      body: { email: VALID_EMAIL },
    });

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const json = res._getJSONData();
    expect(json).toHaveProperty('devLink');
    expect(json.devLink).toContain('/api/auth/verify?token=');
    expect(mockSend).not.toHaveBeenCalled();
  });

  test('valid new-user email in production → resend.emails.send called with correct fields, returns 200', async () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const { req, res } = mockReqRes({
        method: 'POST',
        body: { email: VALID_EMAIL },
      });

      await handler(req, res);

      expect(mockSend).toHaveBeenCalledOnce();
      const [sendArgs] = mockSend.mock.calls;
      expect(sendArgs[0].to).toBe(VALID_EMAIL);
      expect(sendArgs[0].subject).toContain('login link');
      expect(sendArgs[0].from).toBe('noreply@mysuper.cv');
      expect(res.statusCode).toBe(200);
    } finally {
      process.env.NODE_ENV = orig;
    }
  });

  test('Resend returns error object → response 500 { error: "Email send failed." }', async () => {
    mockSend.mockResolvedValue({ error: { message: 'rate limited by Resend' } });
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const { req, res } = mockReqRes({
        method: 'POST',
        body: { email: VALID_EMAIL },
      });

      await handler(req, res);

      expect(res.statusCode).toBe(500);
      expect(res._getJSONData()).toEqual({ error: 'Email send failed.' });
    } finally {
      process.env.NODE_ENV = orig;
    }
  });

  test('invalid email (no @) → 400, resend never called', async () => {
    const { req, res } = mockReqRes({
      method: 'POST',
      body: { email: 'notanemail' },
    });

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
