// __tests__/update-master.test.js
//
// POST /api/update-master — the user editing their own record directly. What
// must hold:
//   - the record read and written is the SESSION user's, never a user_id from
//     the body (the attack: rewrite someone else's career record);
//   - a crafted body cannot put arbitrary JSON into master_cv, and cannot
//     hand-edit voice_guide (the user's own style guide, written elsewhere);
//   - an edit that would empty the career record is refused;
//   - the edited record actually reaches saveMasterCv, and the recomputed flags
//     come back with it.
//
// normaliseMaster is exercised directly too — it is the gate, so its rules are
// pinned rather than inferred from the route's output alone.

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
});

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createRequest, createResponse } from 'node-mocks-http';

const mockGetMasterCv = vi.hoisted(() => vi.fn());
const mockSaveMasterCv = vi.hoisted(() => vi.fn());
const mockGetLatestAnalysis = vi.hoisted(() => vi.fn());

vi.mock('../utils/database', () => ({
  getMasterCv: mockGetMasterCv,
  saveMasterCv: mockSaveMasterCv,
  getLatestAnalysis: mockGetLatestAnalysis,
}));
vi.mock('../lib/requireAuth', () => ({ default: (handler) => handler }));

import handler from '../pages/api/update-master.js';
import { normaliseMaster } from '../utils/master-schema.js';

const SESSION_USER = 'user-session-1';

const STORED = {
  profile: {
    name: 'Nik Page',
    headline: 'Product leader',
    location: 'Prague, CZ',
    summary: 'I build things people actually use.',
    contact: { phone: '', email: 'n@example.com', linkedin: '', website: '' },
    top_skills: [],
    languages: [],
    certifications: [],
    honors_and_awards: [],
  },
  work_experience: [
    { company: 'Beta Ltd', title: 'PM', start_date: '2019', end_date: '2022', location: 'Prague', bullets: ['Shipped checkout'], fractional_engagements: [] },
  ],
  advisory_and_community: [],
  speaking_and_lecturing: [],
  publications_and_patents: [],
  education: [],
  voice_guide: 'I write short. Verb first, no windup.',
};

function call(body, user_id = SESSION_USER) {
  const req = createRequest({ method: 'POST', body });
  req.user = { user_id };
  const res = createResponse();
  return { res, done: handler(req, res) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetMasterCv.mockResolvedValue(JSON.parse(JSON.stringify(STORED)));
  mockSaveMasterCv.mockResolvedValue([{ user_id: SESSION_USER }]);
  mockGetLatestAnalysis.mockResolvedValue(null);
});

describe('normaliseMaster', () => {
  test('keeps the edit and coerces it onto the schema', () => {
    const out = normaliseMaster(
      {
        profile: { name: '  Nik Page  ', location: 'Warsaw, PL', contact: { email: 'n@example.com' } },
        work_experience: [{ company: 'Beta Ltd', title: 'Head of Product', start_date: '2019', end_date: '2023', bullets: ['  Shipped checkout  '] }],
      },
      STORED
    );

    expect(out.profile.name).toBe('Nik Page');
    expect(out.profile.location).toBe('Warsaw, PL');
    expect(out.work_experience[0].title).toBe('Head of Product');
    expect(out.work_experience[0].end_date).toBe('2023');
    expect(out.work_experience[0].bullets).toEqual(['Shipped checkout']);
    expect(out.work_experience[0].fractional_engagements).toEqual([]);
  });

  test('drops unknown keys instead of writing them into the record', () => {
    const out = normaliseMaster(
      { work_experience: [], evil: { nested: 1 }, master_cv: 'nope', candidate_core: 'gone' },
      STORED
    );
    expect(out.evil).toBeUndefined();
    expect(out.master_cv).toBeUndefined();
    expect(out.candidate_core).toBeUndefined();
    expect(Object.keys(out).sort()).toEqual(
      ['advisory_and_community', 'education', 'profile', 'publications_and_patents', 'role_overlaps', 'speaking_and_lecturing', 'voice_guide', 'work_experience'].sort()
    );
  });

  test('carries voice_guide from the stored record, ignoring a submitted one', () => {
    const out = normaliseMaster(
      { work_experience: [], voice_guide: 'injected by the client' },
      STORED
    );
    expect(out.voice_guide).toBe('I write short. Verb first, no windup.');
  });

  // str() used to render any non-scalar through String(), so a stray object in
  // ANY coerced field became a literal "[object Object]" that survived every
  // filter and replaced real content. It is dropped now.
  test('drops an object where a scalar belongs rather than writing a placeholder', () => {
    const out = normaliseMaster(
      { ...STORED, profile: { ...STORED.profile, headline: { text: 'an object where prose belongs' } } },
      STORED
    );
    expect(out.profile.headline).toBe('');
    expect(JSON.stringify(out)).not.toContain('[object Object]');
  });

  test('keeps the engagements nested under an umbrella role', () => {
    const out = normaliseMaster(
      { work_experience: [{ company: 'Self', title: 'Consultant', fractional_engagements: [{ company: 'eBay', title: 'Advisor' }] }] },
      STORED
    );
    expect(out.work_experience[0].fractional_engagements).toHaveLength(1);
    expect(out.work_experience[0].fractional_engagements[0].company).toBe('eBay');
  });

  // The record nests exactly one level. A second level submitted by a client is
  // flattened away rather than stored, so the shape the readers walk is the
  // shape the prompt promised.
  test('refuses a second level of nesting', () => {
    const out = normaliseMaster(
      {
        work_experience: [
          {
            company: 'Self',
            title: 'Consultant',
            fractional_engagements: [
              { company: 'eBay', title: 'Advisor', fractional_engagements: [{ company: 'Deeper', title: 'Nope' }] },
            ],
          },
        ],
      },
      STORED
    );
    expect(out.work_experience[0].fractional_engagements[0].fractional_engagements).toEqual([]);
    expect(JSON.stringify(out)).not.toContain('Deeper');
  });

  test('drops empty rows the editor left behind', () => {
    const out = normaliseMaster(
      {
        work_experience: [{ company: '', title: '', bullets: [''] }, { company: 'Acme', title: 'Dev' }],
        education: [{ institution: '', qualification: '' }],
        speaking_and_lecturing: [{ event: '', topic: '' }],
      },
      STORED
    );
    expect(out.work_experience).toHaveLength(1);
    expect(out.work_experience[0].company).toBe('Acme');
    expect(out.education).toEqual([]);
    expect(out.speaking_and_lecturing).toEqual([]);
  });

  test('rejects a non-object', () => {
    expect(() => normaliseMaster(null, STORED)).toThrow(/master object is required/);
    expect(() => normaliseMaster([], STORED)).toThrow(/master object is required/);
  });
});

describe('POST /api/update-master', () => {
  test('saves the edited record for the SESSION user, ignoring a user_id in the body', async () => {
    const { res, done } = call({
      user_id: 'someone-elses-id',
      master: { ...STORED, profile: { ...STORED.profile, headline: 'Rewritten headline.' } },
    });
    await done;

    expect(res.statusCode).toBe(200);
    expect(mockGetMasterCv).toHaveBeenCalledWith(SESSION_USER);
    const [savedUserId, savedMaster] = mockSaveMasterCv.mock.calls[0];
    expect(savedUserId).toBe(SESSION_USER);
    expect(savedMaster.profile.headline).toBe('Rewritten headline.');
    expect(res._getJSONData().master.profile.headline).toBe('Rewritten headline.');
  });

  test('a submitted voice_guide never reaches the database', async () => {
    const { done } = call({ master: { ...STORED, voice_guide: 'Forged guide.' } });
    await done;
    expect(mockSaveMasterCv.mock.calls[0][1].voice_guide).toBe('I write short. Verb first, no windup.');
  });

  test('refuses an edit that would remove every role', async () => {
    const { res, done } = call({ master: { ...STORED, work_experience: [] } });
    await done;
    expect(res.statusCode).toBe(400);
    expect(res._getJSONData().error).toMatch(/every role/);
    expect(mockSaveMasterCv).not.toHaveBeenCalled();
  });

  test('409 when there is no record to edit yet', async () => {
    mockGetMasterCv.mockResolvedValue(null);
    const { res, done } = call({ master: STORED });
    await done;
    expect(res.statusCode).toBe(409);
    expect(mockSaveMasterCv).not.toHaveBeenCalled();
  });

  test('400 when no master is supplied', async () => {
    const { res, done } = call({});
    await done;
    expect(res.statusCode).toBe(400);
    expect(mockSaveMasterCv).not.toHaveBeenCalled();
  });

  test('405 on GET', async () => {
    const req = createRequest({ method: 'GET' });
    req.user = { user_id: SESSION_USER };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
    expect(mockSaveMasterCv).not.toHaveBeenCalled();
  });

  test('500 when the save fails, and the failure is not reported as success', async () => {
    mockSaveMasterCv.mockRejectedValue(new Error('db down'));
    const { res, done } = call({ master: STORED });
    await done;
    expect(res.statusCode).toBe(500);
    expect(res._getJSONData().ok).toBeUndefined();
  });
});
