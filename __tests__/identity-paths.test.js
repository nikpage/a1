// __tests__/identity-paths.test.js
//
// The two routes that decide WHO YOU ARE. Both used to take that answer from an
// untrusted or stale carrier: send-magic-link from the request body, verify
// from a snapshot stored on the magic-token row. These pin the durable rules —
// identity comes from the signed session cookie, and the EMAIL resolves to the
// canonical account.

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-identity-secret';
  process.env.NODE_ENV = 'test';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://fake.supabase';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fake-anon-key';
  process.env.UPSTASH_REDIS_REST_URL = 'http://fake.redis';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';
  process.env.GMAIL_APP_PASSWORD = 'fake-app-password';
});

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { mockReqRes } from './helpers.js';
import { mintSessionToken } from '../lib/auth.js';

const mockSendMail = vi.hoisted(() => vi.fn());
vi.mock('nodemailer', () => ({
  default: { createTransport: () => ({ sendMail: mockSendMail }) },
}));

vi.mock('@upstash/redis', () => ({ Redis: { fromEnv: () => ({}) } }));
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
const mockGetMagicToken            = vi.hoisted(() => vi.fn());
const mockDeleteMagicToken         = vi.hoisted(() => vi.fn());

vi.mock('../utils/database', () => ({
  getUserByEmail: mockGetUserByEmail,
  updateUserEmail: mockUpdateUserEmail,
  createUserWithEmail: mockCreateUserWithEmail,
  deleteMagicTokensByEmail: mockDeleteMagicTokensByEmail,
  insertMagicToken: mockInsertMagicToken,
  getMagicToken: mockGetMagicToken,
  deleteMagicToken: mockDeleteMagicToken,
}));

import sendMagicLink from '../pages/api/auth/send-magic-link.js';
import verify from '../pages/api/auth/verify.js';

const VICTIM = 'victim@example.com';

beforeEach(() => {
  vi.resetAllMocks();
  mockSendMail.mockResolvedValue({});
  mockGetUserByEmail.mockResolvedValue(null);
  mockCreateUserWithEmail.mockResolvedValue({ user_id: 'freshly-created' });
  mockUpdateUserEmail.mockImplementation(async (user_id, email) => ({ user_id, email }));
  mockDeleteMagicTokensByEmail.mockResolvedValue(undefined);
  mockInsertMagicToken.mockResolvedValue(undefined);
  mockDeleteMagicToken.mockResolvedValue(undefined);
});

describe('send-magic-link — identity never comes from the request body', () => {
  test('a body-supplied user_id cannot claim an email (account-takeover path)', async () => {
    const { req, res } = mockReqRes({
      method: 'POST',
      body: { email: VICTIM, user_id: 'attacker-controlled-id' },
    });
    req.headers.origin = 'https://mysuper.cv';

    await sendMagicLink(req, res);

    // The attacker's id must never be stamped with the victim's address...
    expect(mockUpdateUserEmail).not.toHaveBeenCalled();
    // ...and the link must be minted against a brand-new account instead.
    expect(mockCreateUserWithEmail).toHaveBeenCalledWith(VICTIM);
    expect(mockInsertMagicToken.mock.calls[0][0].user_id).toBe('freshly-created');
  });

  test('the visitor OWN signed session is honoured, so an anonymous upload carries into signup', async () => {
    const cookie = mintSessionToken({ user_id: 'anon-upload-session', email: null });
    const { req, res } = mockReqRes({
      method: 'POST',
      body: { email: VICTIM, user_id: 'attacker-controlled-id' },
      cookies: { 'auth-token': cookie },
    });
    req.headers.origin = 'https://mysuper.cv';

    await sendMagicLink(req, res);

    expect(mockUpdateUserEmail).toHaveBeenCalledWith('anon-upload-session', VICTIM);
    expect(mockCreateUserWithEmail).not.toHaveBeenCalled();
    expect(mockInsertMagicToken.mock.calls[0][0].user_id).toBe('anon-upload-session');
  });

  test('an existing account for the address always wins over any session', async () => {
    mockGetUserByEmail.mockResolvedValue({ user_id: 'established-account', email: VICTIM });
    const cookie = mintSessionToken({ user_id: 'anon-upload-session', email: null });
    const { req, res } = mockReqRes({
      method: 'POST',
      body: { email: VICTIM },
      cookies: { 'auth-token': cookie },
    });
    req.headers.origin = 'https://mysuper.cv';

    await sendMagicLink(req, res);

    expect(mockInsertMagicToken.mock.calls[0][0].user_id).toBe('established-account');
    expect(mockUpdateUserEmail).not.toHaveBeenCalled();
  });
});

describe('verify — the email resolves the account, not the token snapshot', () => {
  test('a stale user_id on the token does not log the user into an orphan row', async () => {
    mockGetMagicToken.mockResolvedValue({
      token: 't1', email: VICTIM, user_id: 'orphaned-duplicate',
    });
    mockGetUserByEmail.mockResolvedValue({ user_id: 'canonical-account', email: VICTIM });

    const { req, res } = mockReqRes({ method: 'GET', query: { token: 't1' } });
    await verify(req, res);

    expect(res._getRedirectUrl()).toBe('/canonical-account');
    expect(res._getRedirectUrl()).not.toContain('orphaned-duplicate');
  });

  test('with no account for the address, the token id is used AND the row is made real', async () => {
    mockGetMagicToken.mockResolvedValue({
      token: 't2', email: VICTIM, user_id: 'phantom-id',
    });
    mockGetUserByEmail.mockResolvedValue(null);

    const { req, res } = mockReqRes({ method: 'GET', query: { token: 't2' } });
    await verify(req, res);

    // Old code issued a session for a user_id that might have no row at all.
    expect(mockUpdateUserEmail).toHaveBeenCalledWith('phantom-id', VICTIM);
    expect(res._getRedirectUrl()).toBe('/phantom-id');
  });

  test('the session cookie is issued for the resolved account, not the token snapshot', async () => {
    mockGetMagicToken.mockResolvedValue({
      token: 't3', email: VICTIM, user_id: 'orphaned-duplicate',
    });
    mockGetUserByEmail.mockResolvedValue({ user_id: 'canonical-account', email: VICTIM });

    const { req, res } = mockReqRes({ method: 'GET', query: { token: 't3' } });
    await verify(req, res);

    const setCookie = String(res.getHeader('Set-Cookie'));
    const jwt = decodeURIComponent(setCookie.split('auth-token=')[1].split(';')[0]);
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());
    expect(payload.user_id).toBe('canonical-account');
    expect(payload.email).toBe(VICTIM);
  });

  test('an invalid token still fails closed', async () => {
    mockGetMagicToken.mockResolvedValue(null);
    const { req, res } = mockReqRes({ method: 'GET', query: { token: 'nope' } });
    await verify(req, res);
    expect(res._getRedirectUrl()).toBe('/?error=login-failed');
  });
});
