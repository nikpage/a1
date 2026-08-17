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
    const [uid, saved] = mockSaveMasterCv.mock.calls.at(-1);
    expect(uid).toBe(SESSION_USER);
    expect(saved.work_experience.map((r) => r.company)).toEqual(['Beta Ltd', 'Acme']);
    expect(Array.isArray(data.flags)).toBe(true);
  });

  test('uses the SESSION user_id, never the one in the body', async () => {
    mockAugmentMaster.mockResolvedValue({ output: UPDATED, usages: [USAGE] });

    const { done } = await call({ text: 'Six months contracting at Acme in 2023.', user_id: 'victim-user' });
    await done;

    expect(mockGetMasterCv).toHaveBeenCalledWith(SESSION_USER);
    expect(mockSaveMasterCv).toHaveBeenCalledWith(SESSION_USER, expect.anything());
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
    expect(mockSaveMasterCv.mock.calls[1][1].work_experience.map((r) => r.company))
      .toEqual(['Beta Ltd', 'Acme']);
    // The build ran inside the same attributed context as the augment, so the
    // meter billed both to this user.
    expect(aiContextSeen).toMatchObject({ user_id: SESSION_USER });
  });

  // THE DEFECT THIS ROUTE SHIPPED WITH. augmentMaster runs the BUILD prompt —
  // pure re-extraction — over the whole stored record plus the note, so the
  // model re-transcribes an entire career every time somebody adds two lines.
  // Its return value was saved as-is. A real run of it compressed a role's
  // bullets, dropped the only two client names an entry had, and retitled
  // another role, and all of it landed in the canonical record.
  //
  // The stored record is now the base and the output is read for ADDITIONS
  // only. Red on the old code, which saved `result.output` verbatim.
  test('a degraded re-extraction cannot delete or rewrite what is already recorded', async () => {
    const stored = {
      profile: { name: 'Jane Roe', headline: 'Product Lead', top_skills: ['Discovery'], certifications: [] },
      work_experience: [
        {
          company: 'EDP', title: 'Consultant', start_date: '1997', end_date: '2000', location: 'San Francisco, US',
          bullets: ['Contract QA consulting. Clients included:', 'Pacific Bell', 'Canon'],
          fractional_engagements: [],
        },
        {
          company: 'Beta Ltd', title: 'PM', start_date: '2019', end_date: '2022', location: 'Prague, CZ',
          bullets: ['Ran discovery.', 'Led a team of six.'],
          fractional_engagements: [],
        },
      ],
      speaking_and_lecturing: [
        { event: 'WebExpo', role: 'Speaker', topic: 'Emergent Service Design', location: 'Prague', year: '2013' },
      ],
      publications_and_patents: ['Getting to Happy'],
      education: [{ institution: 'Heald College', qualification: 'Informatics', dates: '1992 - 1994', location: '' }],
      role_overlaps: [],
    };
    // What a cheap model actually does to 13k characters of JSON: a title
    // rewritten, an entry's client names gone, a bullet lost, a talk's topic
    // truncated, a publication and a qualification dropped — plus the one real
    // addition the person asked for.
    const degraded = {
      profile: { name: 'Jane Roe', headline: 'Senior Product Leader', top_skills: ['Discovery', 'AI Strategy'], certifications: [] },
      work_experience: [
        {
          company: 'EDP', title: 'Contract QA Consultant', start_date: '1997', end_date: '2000', location: 'San Francisco, US',
          bullets: ['Provided software quality assurance consulting across client accounts.'],
          fractional_engagements: [],
        },
        {
          company: 'Beta Ltd', title: 'PM', start_date: '2019', end_date: '2022', location: 'Prague, CZ',
          bullets: ['Ran discovery.', 'Shipped an AI assistant.'],
          fractional_engagements: [],
        },
        {
          company: 'Acme', title: 'Contractor', start_date: '2023', end_date: '2023', location: '',
          bullets: ['Six months of contract delivery.'], fractional_engagements: [],
        },
      ],
      speaking_and_lecturing: [
        { event: 'WebExpo', role: 'Speaker', topic: 'Design', location: 'Prague', year: '2013' },
      ],
      publications_and_patents: [],
      education: [],
      role_overlaps: [{ umbrella_index: 0, role_index: 1 }],
    };
    mockGetMasterCv.mockResolvedValue(stored);
    mockAugmentMaster.mockResolvedValue({ output: degraded, usages: [USAGE] });

    const { res, done } = await call({ text: 'Six months contracting at Acme in 2023.' });
    await done;

    expect(res.statusCode).toBe(200);
    const saved = mockSaveMasterCv.mock.calls.at(-1)[1];

    // Nothing recorded was lost or reworded.
    const edp = saved.work_experience.find((r) => r.company === 'EDP');
    expect(edp.title).toBe('Consultant');
    expect(edp.bullets).toEqual(expect.arrayContaining(['Pacific Bell', 'Canon']));
    expect(saved.work_experience.find((r) => r.company === 'Beta Ltd').bullets)
      .toEqual(expect.arrayContaining(['Led a team of six.']));
    expect(saved.speaking_and_lecturing[0].topic).toBe('Emergent Service Design');
    expect(saved.publications_and_patents).toEqual(['Getting to Happy']);
    expect(saved.education).toHaveLength(1);
    expect(saved.profile.headline).toBe('Product Lead');

    // The addition the person actually asked for still lands.
    expect(saved.work_experience.map((r) => r.company)).toEqual(['EDP', 'Beta Ltd', 'Acme']);
    expect(saved.work_experience.find((r) => r.company === 'Beta Ltd').bullets)
      .toContain('Shipped an AI assistant.');
    expect(saved.profile.top_skills).toContain('AI Strategy');

    // The overlap questions belong to the person, not to a re-extraction.
    expect(saved.role_overlaps).toEqual([]);

    // And the record handed back to the page is the saved one.
    expect(res._getJSONData().master.work_experience).toHaveLength(3);
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
