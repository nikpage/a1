// __tests__/master-add-info.test.js
//
// POST /api/master-add-info — the "anything not on your CV?" box. What must hold:
//   - the record it reads and writes is the SESSION user's, never a user_id from
//     the body (the attack: pass someone else's id and edit their career record);
//   - when the AI comes back with blocking questions, NOTHING is saved — a
//     half-placed role in the canonical master is worse than none;
//   - every paid AI call is cost-logged, saved or not (the user was charged);
//   - the per-user lock blocks a double-submit and is always released.

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-add-info-secret';
  process.env.NODE_ENV = 'test';
  process.env.UPSTASH_REDIS_REST_URL = 'http://fake.redis';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';
});

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createRequest, createResponse } from 'node-mocks-http';

const mockRedisSet = vi.hoisted(() => vi.fn());
const mockRedisDel = vi.hoisted(() => vi.fn());
vi.mock('@upstash/redis', () => ({
  Redis: { fromEnv: () => ({ set: mockRedisSet, del: mockRedisDel }) },
}));

const mockGetMasterCv       = vi.hoisted(() => vi.fn());
const mockGetCV             = vi.hoisted(() => vi.fn());
const mockBuildOrMergeMaster = vi.hoisted(() => vi.fn());
const mockSaveMasterCv      = vi.hoisted(() => vi.fn());
const mockGetLatestAnalysis = vi.hoisted(() => vi.fn());
const mockLogAiTransaction  = vi.hoisted(() => vi.fn());
const mockAugmentMaster     = vi.hoisted(() => vi.fn());

vi.mock('../utils/database', () => ({
  getMasterCv: mockGetMasterCv,
  getCV: mockGetCV,
  saveMasterCv: mockSaveMasterCv,
  getLatestAnalysis: mockGetLatestAnalysis,
  logAiTransaction: mockLogAiTransaction,
}));
vi.mock('../utils/openai', () => ({ augmentMaster: mockAugmentMaster, buildOrMergeMaster: mockBuildOrMergeMaster }));
vi.mock('../lib/requireAuth', () => ({ default: (handler) => handler }));

import handler from '../pages/api/master-add-info.js';

const SESSION_USER = 'user-session-1';
const MASTER = { experience: [{ company: 'Beta Ltd', role: 'PM', dates: '2019-2022' }] };
const UPDATED = { experience: [{ company: 'Acme', role: 'Contractor', dates: '2023' }, ...MASTER.experience] };
const USAGE = { label: 'master-cv augment', model: 'gemini-2.5-flash-lite', inputTokens: 100, outputTokens: 40, thinkingTokens: 10, costUsd: 0.0001 };

function call(body, user_id = SESSION_USER) {
  const req = createRequest({ method: 'POST', body });
  req.user = { user_id };
  const res = createResponse();
  return { req, res, done: handler(req, res) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRedisSet.mockResolvedValue('OK');
  mockRedisDel.mockResolvedValue(1);
  mockGetMasterCv.mockResolvedValue(MASTER);
  mockGetCV.mockResolvedValue({ cv_data: 'Jane Roe — Product Manager, Beta Ltd 2019-2022' });
  mockBuildOrMergeMaster.mockResolvedValue({ output: MASTER, usages: [USAGE] });
  mockSaveMasterCv.mockResolvedValue({});
  mockGetLatestAnalysis.mockResolvedValue(null);
  mockLogAiTransaction.mockResolvedValue(undefined);
});

describe('POST /api/master-add-info', () => {
  test('saves the augmented master and reports what changed', async () => {
    mockAugmentMaster.mockResolvedValue({ output: UPDATED, questions: [], changes: ['Added Acme — Contractor, 2023'], usages: [USAGE] });

    const { res, done } = await call({ text: 'Six months contracting at Acme in 2023.' });
    await done;

    expect(res.statusCode).toBe(200);
    const data = res._getJSONData();
    expect(data.ok).toBe(true);
    expect(data.changes).toEqual(['Added Acme — Contractor, 2023']);
    expect(mockSaveMasterCv).toHaveBeenCalledWith(SESSION_USER, UPDATED);
    expect(Array.isArray(data.flags)).toBe(true);
  });

  test('uses the SESSION user_id, never the one in the body', async () => {
    mockAugmentMaster.mockResolvedValue({ output: UPDATED, questions: [], changes: [], usages: [USAGE] });

    const { done } = await call({ text: 'Six months contracting at Acme in 2023.', user_id: 'victim-user' });
    await done;

    expect(mockGetMasterCv).toHaveBeenCalledWith(SESSION_USER);
    expect(mockSaveMasterCv).toHaveBeenCalledWith(SESSION_USER, UPDATED);
    expect(mockGetMasterCv).not.toHaveBeenCalledWith('victim-user');
    expect(mockSaveMasterCv).not.toHaveBeenCalledWith('victim-user', expect.anything());
  });

  test('returns questions and saves NOTHING when the fact cannot be placed', async () => {
    mockAugmentMaster.mockResolvedValue({ output: UPDATED, questions: ['Which company was this at?'], changes: [], usages: [USAGE] });

    const { res, done } = await call({ text: 'I did a big turnaround project once.' });
    await done;

    expect(res.statusCode).toBe(200);
    const data = res._getJSONData();
    expect(data.ok).toBe(false);
    expect(data.questions).toEqual(['Which company was this at?']);
    expect(mockSaveMasterCv).not.toHaveBeenCalled();
    // The call was still paid for, so it is still cost-logged.
    expect(mockLogAiTransaction).toHaveBeenCalledTimes(1);
  });

  test('cost-logs every AI call with the model and token split from the usage', async () => {
    const verifyUsage = { ...USAGE, label: 'master-cv verify', model: 'gemini-2.5-flash-lite', inputTokens: 200, outputTokens: 5, thinkingTokens: 2 };
    mockAugmentMaster.mockResolvedValue({ output: UPDATED, questions: [], changes: [], usages: [USAGE, verifyUsage] });

    const { done } = await call({ text: 'Six months contracting at Acme in 2023.' });
    await done;

    expect(mockLogAiTransaction).toHaveBeenCalledTimes(2);
    expect(mockLogAiTransaction).toHaveBeenNthCalledWith(1, expect.objectContaining({
      user_id: SESSION_USER,
      model: 'gemini-2.5-flash-lite',
      cache_miss_tokens: 100,
      completion_tokens: 50,   // outputTokens + thinkingTokens
      thinking_tokens: 10,
      detail: { type: 'master-cv augment' },
    }));
    expect(mockLogAiTransaction).toHaveBeenNthCalledWith(2, expect.objectContaining({
      cache_miss_tokens: 200,
      completion_tokens: 7,
      thinking_tokens: 2,
      detail: { type: 'master-cv verify' },
    }));
  });

  test('rejects a second submission while one is in flight, and releases the lock after', async () => {
    mockAugmentMaster.mockResolvedValue({ output: UPDATED, questions: [], changes: [], usages: [USAGE] });
    const { done } = await call({ text: 'Six months contracting at Acme in 2023.' });
    await done;
    expect(mockRedisDel).toHaveBeenCalledWith(`master_add_lock:${SESSION_USER}`);

    mockRedisSet.mockResolvedValue(null); // lock already held
    const second = await call({ text: 'Six months contracting at Acme in 2023.' });
    await second.done;

    expect(second.res.statusCode).toBe(429);
    expect(mockAugmentMaster).toHaveBeenCalledTimes(1);
  });

  test('rejects empty / oversized text without paying for an AI call', async () => {
    const tooShort = await call({ text: 'hi' });
    await tooShort.done;
    expect(tooShort.res.statusCode).toBe(400);

    const tooLong = await call({ text: 'x'.repeat(4001) });
    await tooLong.done;
    expect(tooLong.res.statusCode).toBe(400);

    expect(mockAugmentMaster).not.toHaveBeenCalled();
  });

  // A null master_cv is recoverable: the background build can fail (leaving the
  // column null while the user's CV text is safely on file), and refusing here
  // stranded the user with a record nothing could ever be added to.
  test('builds the master on the spot when it is missing, then augments it', async () => {
    mockGetMasterCv.mockResolvedValue(null);
    mockAugmentMaster.mockResolvedValue({ output: UPDATED, questions: [], changes: ['Added Acme'], usages: [USAGE] });

    const { res, done } = await call({ text: 'Six months contracting at Acme in 2023.' });
    await done;

    expect(res.statusCode).toBe(200);
    expect(mockBuildOrMergeMaster).toHaveBeenCalledWith('Jane Roe — Product Manager, Beta Ltd 2019-2022');
    // The freshly built master is persisted, then the augmented one on top.
    expect(mockSaveMasterCv).toHaveBeenNthCalledWith(1, SESSION_USER, MASTER);
    expect(mockAugmentMaster).toHaveBeenCalledWith(MASTER, 'Six months contracting at Acme in 2023.', []);
    expect(mockSaveMasterCv).toHaveBeenNthCalledWith(2, SESSION_USER, UPDATED);
    // The build's calls are cost-logged too, not just the augment's.
    expect(mockLogAiTransaction).toHaveBeenCalledTimes(2);
  });

  test('409s only when there is no CV on file at all', async () => {
    mockGetMasterCv.mockResolvedValue(null);
    mockGetCV.mockResolvedValue(null);

    const { res, done } = await call({ text: 'Six months contracting at Acme in 2023.' });
    await done;

    expect(res.statusCode).toBe(409);
    expect(mockBuildOrMergeMaster).not.toHaveBeenCalled();
    expect(mockAugmentMaster).not.toHaveBeenCalled();
    expect(mockSaveMasterCv).not.toHaveBeenCalled();
  });
});
