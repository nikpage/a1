// __tests__/generate-cv-cover.test.js — tests for 2.1 (deferred decrement) and 2.2 (Redis lock)

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-gen-secret';
  process.env.NODE_ENV = 'test';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://fake.supabase';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key';
  process.env.UPSTASH_REDIS_REST_URL = 'http://fake.redis';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';
});

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createRequest, createResponse } from 'node-mocks-http';

const mockRedisSet = vi.hoisted(() => vi.fn());
const mockRedisDel = vi.hoisted(() => vi.fn());

vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: () => ({ set: mockRedisSet, del: mockRedisDel }),
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({}),
}));

const mockGenerateCV           = vi.hoisted(() => vi.fn());
const mockGenerateCoverLetter  = vi.hoisted(() => vi.fn());
const mockDecrementGenerations = vi.hoisted(() => vi.fn());
const mockGetUserById          = vi.hoisted(() => vi.fn());
const mockGetCV                = vi.hoisted(() => vi.fn());
const mockSaveGeneratedDoc     = vi.hoisted(() => vi.fn());
const mockLogAiTransaction     = vi.hoisted(() => vi.fn());

vi.mock('../utils/openai', () => ({
  generateCV: mockGenerateCV,
  generateCoverLetter: mockGenerateCoverLetter,
}));

vi.mock('../utils/generation-utils', () => ({
  getUserById: mockGetUserById,
  decrementGenerations: mockDecrementGenerations,
}));

vi.mock('../utils/database', () => ({
  getCV: mockGetCV,
  saveGeneratedDoc: mockSaveGeneratedDoc,
  logAiTransaction: mockLogAiTransaction,
}));

vi.mock('../lib/requireAuth', () => ({
  default: (handler) => handler,
}));

import handler from '../pages/api/generate-cv-cover.js';

const FAKE_USER_ID = 'user-test-123';
const FAKE_USER    = { user_id: FAKE_USER_ID, generations_left: 5, tokens: 10 };
const FAKE_CV      = { cv_data: 'John Smith — Software Engineer' };
const CV_RESULT    = { content: 'Generated CV text', usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 }, gemini_usage: { label: 'generate CV' } };
const COVER_RESULT = { content: 'Generated cover letter', usage: { prompt_tokens: 80, completion_tokens: 150, total_tokens: 230 }, gemini_usage: { label: 'generate cover letter' } };

function makeReq(body = {}) {
  const req = createRequest({ method: 'POST', body });
  req.user = { user_id: FAKE_USER_ID };
  return req;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRedisSet.mockResolvedValue('OK');
  mockRedisDel.mockResolvedValue(1);
  mockGetUserById.mockResolvedValue(FAKE_USER);
  mockGetCV.mockResolvedValue(FAKE_CV);
  mockGenerateCV.mockResolvedValue(CV_RESULT);
  mockGenerateCoverLetter.mockResolvedValue(COVER_RESULT);
  mockDecrementGenerations.mockResolvedValue();
  mockSaveGeneratedDoc.mockResolvedValue();
  mockLogAiTransaction.mockResolvedValue();
});

// ── Task 2.1: Deferred decrement ─────────────────────────────────────────────

describe('2.1 — decrement after AI success', () => {
  test('happy path: both AI calls succeed → decrementGenerations called exactly once', async () => {
    const req = makeReq({ analysis: JSON.stringify({ job: 'engineer' }), tone: 'Formal', type: 'both' });
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mockDecrementGenerations).toHaveBeenCalledTimes(1);
    expect(mockDecrementGenerations).toHaveBeenCalledWith(FAKE_USER_ID, 1);
  });

  test('CV generation throws → decrementGenerations NOT called, 500 returned', async () => {
    mockGenerateCV.mockRejectedValue(new Error('Gemini network error'));

    const req = makeReq({ analysis: JSON.stringify({ job: 'engineer' }), tone: 'Formal', type: 'both' });
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(mockDecrementGenerations).not.toHaveBeenCalled();
  });

  test('cover-letter generation throws → decrementGenerations NOT called, 500 returned', async () => {
    mockGenerateCoverLetter.mockRejectedValue(new Error('Gemini timeout'));

    const req = makeReq({ analysis: JSON.stringify({ job: 'engineer' }), tone: 'Formal', type: 'both' });
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(mockDecrementGenerations).not.toHaveBeenCalled();
  });
});

// ── Task 2.2: Redis generation lock ──────────────────────────────────────────

describe('2.2 — generation lock', () => {
  test('lock acquired (set returns OK) → generation proceeds, 200 returned', async () => {
    mockRedisSet.mockResolvedValue('OK');

    const req = makeReq({ analysis: JSON.stringify({ job: 'engineer' }), tone: 'Formal', type: 'cv' });
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mockGenerateCV).toHaveBeenCalledTimes(1);
    expect(mockDecrementGenerations).toHaveBeenCalledTimes(1);
  });

  test('lock already held (set returns null) → 429 immediately, no AI call, no decrement', async () => {
    mockRedisSet.mockResolvedValue(null);

    const req = makeReq({ analysis: JSON.stringify({ job: 'engineer' }), tone: 'Formal', type: 'both' });
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(429);
    expect(res._getJSONData()).toMatchObject({ error: 'Generation already in progress' });
    expect(mockGenerateCV).not.toHaveBeenCalled();
    expect(mockGenerateCoverLetter).not.toHaveBeenCalled();
    expect(mockDecrementGenerations).not.toHaveBeenCalled();
  });

  test('Redis unavailable (set throws) → fail open: generation proceeds, 200, no unlock attempted', async () => {
    // Regression: old code returned 500 "Service temporarily unavailable" here,
    // taking down all writing whenever Upstash hiccupped. The lock is best-effort.
    mockRedisSet.mockRejectedValue(new Error('Failed to parse URL from /pipeline'));

    const req = makeReq({ analysis: JSON.stringify({ job: 'engineer' }), tone: 'Formal', type: 'cv' });
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mockGenerateCV).toHaveBeenCalledTimes(1);
    expect(mockDecrementGenerations).toHaveBeenCalledTimes(1);
    // No lock was held, so we must not try to release one.
    expect(mockRedisDel).not.toHaveBeenCalled();
  });

  test('AI throws after lock acquired → lock released (redis.del called)', async () => {
    mockGenerateCV.mockRejectedValue(new Error('Gemini exploded'));

    const req = makeReq({ analysis: JSON.stringify({ job: 'engineer' }), tone: 'Formal', type: 'cv' });
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(mockRedisDel).toHaveBeenCalledTimes(1);
    expect(mockRedisDel).toHaveBeenCalledWith(`gen_lock:${FAKE_USER_ID}`);
  });

  test('successful generation → lock released after response', async () => {
    const req = makeReq({ analysis: JSON.stringify({ job: 'engineer' }), tone: 'Formal', type: 'cv' });
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mockRedisDel).toHaveBeenCalledTimes(1);
    expect(mockRedisDel).toHaveBeenCalledWith(`gen_lock:${FAKE_USER_ID}`);
  });
});
