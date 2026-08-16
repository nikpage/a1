// __tests__/cv-headline.test.js
//
// The headline-only route. What matters: it edits ONLY the headline line of the
// CV it was given, it persists through the same saveGeneratedDoc path the
// generator uses, it writes the user_id from the SESSION (never the body), it
// cost-logs the Gemini call, and it never spends a generation or a token.

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createRequest, createResponse } from 'node-mocks-http';

const mockGenerateHeadline = vi.hoisted(() => vi.fn());
const mockGetSource        = vi.hoisted(() => vi.fn());
const mockSaveGeneratedDoc = vi.hoisted(() => vi.fn());
const mockLogAiTransaction = vi.hoisted(() => vi.fn());
const mockRedisSet         = vi.hoisted(() => vi.fn());
const mockRedisDel         = vi.hoisted(() => vi.fn());

vi.mock('../utils/openai', () => ({ generateHeadline: mockGenerateHeadline }));

vi.mock('../utils/database', () => ({
  getGenerationSource: mockGetSource,
  saveGeneratedDoc: mockSaveGeneratedDoc,
  logAiTransaction: mockLogAiTransaction,
  getAiSpendSince: vi.fn(async () => ({ total: 0, unpriced: 0 })),
}));

vi.mock('@upstash/redis', () => ({
  Redis: { fromEnv: () => ({ set: mockRedisSet, del: mockRedisDel }) },
}));

vi.mock('../lib/requireAuth', () => ({ default: (handler) => handler }));

import { aiContext } from '../utils/ai-meter.js';
import handler from '../pages/api/cv-headline.js';
import { readHeadline } from '../utils/cv-headline.js';

const SESSION_USER = 'user-session-1';

// The AI cost context as it stood when the Gemini call was made — this is what
// decides whose ledger the spend lands in.
let aiContextSeen = null;
const CV = [
  '<center>',
  '',
  '# Jane Doe',
  '**Head of Operations**',
  '+49 123 | jane@doe.de',
  '',
  '</center>',
  '',
  '### **Professional Summary**',
  'Ran fulfilment for Acme.',
].join('\n');

function run(body) {
  const req = createRequest({ method: 'POST', body });
  req.user = { user_id: SESSION_USER };
  const res = createResponse();
  return handler(req, res).then(() => res);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSource.mockResolvedValue('{"experience":[]}');
  mockSaveGeneratedDoc.mockResolvedValue({});
  mockLogAiTransaction.mockResolvedValue({});
  mockRedisSet.mockResolvedValue('OK');
  mockRedisDel.mockResolvedValue(1);
  aiContextSeen = null;
  mockGenerateHeadline.mockImplementation(async () => {
    aiContextSeen = { ...aiContext() };
    return HEADLINE_RESULT;
  });
});

const HEADLINE_RESULT = {
    content: 'Operations Director | Lean Fulfilment',
    gemini_usage: { label: 'generate headline', model: 'gemini-2.5-flash', inputTokens: 900, outputTokens: 12, thinkingTokens: 5 },
    gemini_usages: [{ label: 'generate headline', model: 'gemini-2.5-flash', inputTokens: 900, outputTokens: 12, thinkingTokens: 5 }],
};

describe('POST /api/cv-headline', () => {
  test('set: writes the user\'s text into the CV and persists it, with no AI call', async () => {
    const res = await run({ action: 'set', content: CV, headline: 'Ops Leader | Fulfilment' });

    expect(res.statusCode).toBe(200);
    const data = res._getJSONData();
    expect(readHeadline(data.cv)).toBe('Ops Leader | Fulfilment');
    expect(data.headline).toBe('Ops Leader | Fulfilment');
    // the rest of the document is untouched
    expect(data.cv).toContain('+49 123 | jane@doe.de');
    expect(data.cv).toContain('Ran fulfilment for Acme.');
    expect(mockGenerateHeadline).not.toHaveBeenCalled();

    const [saved] = mockSaveGeneratedDoc.mock.calls[0];
    expect(saved.type).toBe('cv');
    expect(saved.content).toBe(data.cv);
  });

  test('remove: drops the headline line only', async () => {
    const res = await run({ action: 'remove', content: CV });

    expect(res.statusCode).toBe(200);
    const data = res._getJSONData();
    expect(data.headline).toBe('');
    expect(data.cv).not.toContain('**Head of Operations**');
    expect(data.cv).toContain('# Jane Doe');
    expect(data.cv).toContain('+49 123 | jane@doe.de');
    expect(mockSaveGeneratedDoc).toHaveBeenCalledOnce();
  });

  test('regenerate: uses the master as source, applies the new line and cost-logs the call', async () => {
    const res = await run({ action: 'regenerate', content: CV, analysis: '{"generation_framework":{}}', tone: 'Confident' });

    expect(res.statusCode).toBe(200);
    expect(mockGenerateHeadline).toHaveBeenCalledOnce();
    const [args] = mockGenerateHeadline.mock.calls[0];
    expect(args.cv).toBe('{"experience":[]}');
    expect(args.tone).toBe('Confident');
    // the model is told which headline it is replacing
    expect(args.current).toBe('Head of Operations');

    const data = res._getJSONData();
    expect(readHeadline(data.cv)).toBe('Operations Director | Lean Fulfilment');

    // Cost rows are written by the meter inside callGemini (see
    // __tests__/ai-meter.test.js), not by this route. What the route owns is
    // ATTRIBUTION: the AI context the call runs in must name the session user,
    // because that is the user_id the meter bills.
    expect(aiContextSeen).toMatchObject({ user_id: SESSION_USER, context: 'api:cv-headline' });
  });

  test('a user_id in the body is ignored — the session user owns the write', async () => {
    const res = await run({ action: 'set', content: CV, headline: 'Ops Leader', user_id: 'victim-user' });

    expect(res.statusCode).toBe(200);
    const [saved] = mockSaveGeneratedDoc.mock.calls[0];
    expect(saved.user_id).toBe(SESSION_USER);
    expect(saved.source_cv_id).toBe(SESSION_USER);
    // 'set' makes no AI call at all, so nothing was attributed or billed.
    expect(aiContextSeen).toBeNull();
  });

  test('a second concurrent regenerate is refused by the lock — no Gemini call, nothing saved', async () => {
    mockRedisSet.mockResolvedValue(null);
    const res = await run({ action: 'regenerate', content: CV, analysis: {} });

    expect(res.statusCode).toBe(429);
    expect(mockGenerateHeadline).not.toHaveBeenCalled();
    expect(mockSaveGeneratedDoc).not.toHaveBeenCalled();
    expect(aiContextSeen).toBeNull();
  });

  test('rejects an unknown action and a missing document', async () => {
    const bad = await run({ action: 'delete-everything', content: CV });
    expect(bad.statusCode).toBe(400);

    const empty = await run({ action: 'set', content: '', headline: 'x' });
    expect(empty.statusCode).toBe(400);
    expect(mockSaveGeneratedDoc).not.toHaveBeenCalled();
  });

  test('a failed Gemini call saves nothing and returns 500', async () => {
    mockGenerateHeadline.mockRejectedValue(new Error('Gemini 503 overloaded'));
    const res = await run({ action: 'regenerate', content: CV, analysis: {} });

    expect(res.statusCode).toBe(500);
    expect(mockSaveGeneratedDoc).not.toHaveBeenCalled();
    expect(mockLogAiTransaction).not.toHaveBeenCalled();
    // the lock is always released
    expect(mockRedisDel).toHaveBeenCalledWith(`headline_lock:${SESSION_USER}`);
  });
});
