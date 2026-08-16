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
  getAiSpendSince: vi.fn(async () => ({ total: 0, unpriced: 0 })),
}));
vi.mock('../utils/openai', () => ({ augmentMaster: mockAugmentMaster, buildOrMergeMaster: mockBuildOrMergeMaster }));
vi.mock('../lib/requireAuth', () => ({ default: (handler) => handler }));

import { aiContext } from '../utils/ai-meter.js';
import handler from '../pages/api/master-add-info.js';

const SESSION_USER = 'user-session-1';

// The AI cost context as it stood when a Gemini call was made — it decides
// whose ledger the spend lands in.
let aiContextSeen = null;
const MASTER = {
  work_experience: [
    { company: 'Beta Ltd', title: 'PM', start_date: '2019', end_date: '2022', bullets: [], fractional_engagements: [] },
  ],
};
const UPDATED = {
  work_experience: [
    { company: 'Beta Ltd', title: 'PM', start_date: '2019', end_date: '2022', bullets: [], fractional_engagements: [] },
    { company: 'Acme', title: 'Contractor', start_date: '2023', end_date: '2023', bullets: [], fractional_engagements: [] },
  ],
};
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
  mockBuildOrMergeMaster.mockImplementation(async () => {
    aiContextSeen = { ...aiContext() };
    return { output: MASTER, usages: [USAGE] };
  });
  mockSaveMasterCv.mockResolvedValue({});
  mockGetLatestAnalysis.mockResolvedValue(null);
  mockLogAiTransaction.mockResolvedValue(undefined);
  aiContextSeen = null;
  mockAugmentMaster.mockImplementation(async () => {
    aiContextSeen = { ...aiContext() };
    return { output: UPDATED, usages: [USAGE] };
  });
});

describe('POST /api/master-add-info', () => {
  test('saves the re-extracted master and hands it back', async () => {
    mockAugmentMaster.mockResolvedValue({ output: UPDATED, usages: [USAGE] });

    const { res, done } = await call({ text: 'Six months contracting at Acme in 2023.' });
    await done;

    expect(res.statusCode).toBe(200);
    const data = res._getJSONData();
    expect(data.ok).toBe(true);
    expect(data.master.work_experience).toHaveLength(2);
    expect(mockSaveMasterCv).toHaveBeenCalledWith(SESSION_USER, UPDATED);
    expect(Array.isArray(data.flags)).toBe(true);
  });

  test('uses the SESSION user_id, never the one in the body', async () => {
    mockAugmentMaster.mockResolvedValue({ output: UPDATED, usages: [USAGE] });

    const { done } = await call({ text: 'Six months contracting at Acme in 2023.', user_id: 'victim-user' });
    await done;

    expect(mockGetMasterCv).toHaveBeenCalledWith(SESSION_USER);
    expect(mockSaveMasterCv).toHaveBeenCalledWith(SESSION_USER, UPDATED);
    expect(mockGetMasterCv).not.toHaveBeenCalledWith('victim-user');
    expect(mockSaveMasterCv).not.toHaveBeenCalledWith('victim-user', expect.anything());
  });

  // The stored record and the new text are re-extracted TOGETHER, so there is
  // no "cannot place it" branch left to answer: placement is the extraction's
  // own job, made with the whole record in front of it.
  test('re-extracts against the stored record rather than patching it', async () => {
    mockAugmentMaster.mockResolvedValue({ output: UPDATED, usages: [USAGE] });

    const { done } = await call({ text: 'Six months contracting at Acme in 2023.' });
    await done;

    expect(mockAugmentMaster).toHaveBeenCalledWith(MASTER, 'Six months contracting at Acme in 2023.');
  });

  // The transactions row for each call is written by the meter inside
  // callGemini (pinned in __tests__/ai-meter.test.js), which is why an augment
  // that later fails to save is still billed in the ledger. What this route
  // owns is ATTRIBUTION — the context the calls run in decides whose spend it
  // is, and it must be the SESSION user, never one named in the body.
  test('runs its AI calls attributed to the session user, not the body user', async () => {
    const { done } = await call({ text: 'Six months contracting at Acme in 2023.', user_id: 'victim-user' });
    await done;

    expect(aiContextSeen).toMatchObject({ user_id: SESSION_USER, context: 'api:master-add-info' });
  });

  test('rejects a second submission while one is in flight, and releases the lock after', async () => {
    mockAugmentMaster.mockResolvedValue({ output: UPDATED, usages: [USAGE] });
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
    mockAugmentMaster.mockResolvedValue({ output: UPDATED, usages: [USAGE] });

    const { res, done } = await call({ text: 'Six months contracting at Acme in 2023.' });
    await done;

    expect(res.statusCode).toBe(200);
    expect(mockBuildOrMergeMaster).toHaveBeenCalledWith('Jane Roe — Product Manager, Beta Ltd 2019-2022');
    // The freshly built master is persisted, then the augmented one on top.
    expect(mockSaveMasterCv).toHaveBeenNthCalledWith(1, SESSION_USER, MASTER);
    expect(mockAugmentMaster).toHaveBeenCalledWith(MASTER, 'Six months contracting at Acme in 2023.');
    expect(mockSaveMasterCv).toHaveBeenNthCalledWith(2, SESSION_USER, UPDATED);
    // The build ran inside the same attributed context as the augment, so the
    // meter billed both to this user.
    expect(aiContextSeen).toMatchObject({ user_id: SESSION_USER });
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
