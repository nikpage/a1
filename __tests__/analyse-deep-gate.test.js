// __tests__/analyse-deep-gate.test.js
//
// The deep pass runs only for a VERIFIED session. user_id itself falls back to
// the request body, so a caller with no valid cookie still gets an analysis —
// just a teaser-shaped one, missing the assessment, red flags, quick wins and
// action items. That degradation used to be completely silent: nothing logged,
// nothing in the saved record, indistinguishable from a model that returned
// less. The saved analysis now says why.

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-deep-gate';
  process.env.NODE_ENV = 'test';
});

import { describe, test, expect, vi, beforeEach } from 'vitest';

const mockVerifyToken = vi.hoisted(() => vi.fn());
const mockAnalyzeTeaser = vi.hoisted(() => vi.fn());
const mockAnalyzeCvJob = vi.hoisted(() => vi.fn());
const mockSaveGeneratedDoc = vi.hoisted(() => vi.fn());
const mockGetMasterCv = vi.hoisted(() => vi.fn());

vi.mock('../lib/auth.js', () => ({ verifyToken: mockVerifyToken }));

vi.mock('../utils/openai.js', () => ({
  analyzeTeaser: mockAnalyzeTeaser,
  analyzeCvJob: mockAnalyzeCvJob,
  buildOrMergeMaster: vi.fn(),
}));

vi.mock('../utils/database.js', () => ({
  saveGeneratedDoc: mockSaveGeneratedDoc,
  logAiTransaction: vi.fn().mockResolvedValue(undefined),
  getMasterCv: mockGetMasterCv,
  saveMasterCv: vi.fn().mockResolvedValue(undefined),
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ order: () => ({ limit: async () => ({ data: [{ cv_data: 'raw cv text' }] }) }) }),
          order: () => ({ limit: async () => ({ data: [{ cv_data: 'raw cv text' }] }) }),
        }),
      }),
    }),
  },
}));

import { handler } from '../netlify/functions/analyse-background.mjs';

const TEASER_OUT = JSON.stringify({ cv_data: { Name: 'Nik Page' }, analysis: { overall_score: '6' } });
const USAGE = { model: 'gemini-3.5-flash', inputTokens: 1, outputTokens: 1, thinkingTokens: 0, costUsd: 0 };

// What the worker actually persisted, parsed back.
function savedDoc() {
  const call = mockSaveGeneratedDoc.mock.calls.at(-1)[0];
  return JSON.parse(call.content);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetMasterCv.mockResolvedValue({ experience: [] });
  mockAnalyzeTeaser.mockResolvedValue({ output: TEASER_OUT, gemini_usage: USAGE });
  mockSaveGeneratedDoc.mockResolvedValue(undefined);
});

describe('deep-pass gate', () => {
  test('deep requested with no verified session → teaser saved, and it says why', async () => {
    mockVerifyToken.mockResolvedValue(null);

    const res = await handler({
      headers: { cookie: '' },
      body: JSON.stringify({ analysis_id: 'aid-1', user_id: 'user-from-body', deep: true }),
    });

    expect(res.statusCode).toBe(202);
    expect(mockAnalyzeCvJob).not.toHaveBeenCalled();
    expect(savedDoc()._deep_skipped).toBe('unauthenticated');
  });

  test('deep requested with a verified session → deep runs and no skip marker', async () => {
    mockVerifyToken.mockResolvedValue({ user_id: 'user-1' });
    mockAnalyzeCvJob.mockResolvedValue({
      output: JSON.stringify({ cv_data: { Name: 'Nik Page' }, action_items: { cv: { critical: ['x'] } } }),
      gemini_usages: [USAGE],
    });

    await handler({
      headers: { cookie: 'auth-token=good' },
      body: JSON.stringify({ analysis_id: 'aid-2', deep: true }),
    });

    expect(mockAnalyzeCvJob).toHaveBeenCalledTimes(1);
    expect(savedDoc()._deep_skipped).toBeUndefined();
    expect(savedDoc().action_items.cv.critical).toEqual(['x']);
  });

  test('deep pass throws → teaser kept, and the reason is recorded', async () => {
    mockVerifyToken.mockResolvedValue({ user_id: 'user-1' });
    mockAnalyzeCvJob.mockRejectedValue(new Error('API returned invalid JSON'));

    await handler({
      headers: { cookie: 'auth-token=good' },
      body: JSON.stringify({ analysis_id: 'aid-3', deep: true }),
    });

    expect(savedDoc()._deep_skipped).toBe('failed: API returned invalid JSON');
  });
});
