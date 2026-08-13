// __tests__/update-master.test.js
//
// POST /api/update-master — the user editing their own record directly. What
// must hold:
//   - the record read and written is the SESSION user's, never a user_id from
//     the body (the attack: rewrite someone else's career record);
//   - a crafted body cannot put arbitrary JSON into master_cv, and cannot
//     hand-edit voice_samples (code-grounded verbatim quotes) or conflicts;
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
  identity: { name: 'Nik Page', contact: { email: 'n@example.com', links: [] }, country: 'Czech Republic', languages: [] },
  candidate_core: 'Product leader.',
  experience: [
    { company: 'Beta Ltd', role: 'PM', dates: '2019-2022', location: 'Prague', core_tags: [], achievements: [{ text: 'Shipped checkout', metric: '', skills_utilized: [] }] },
  ],
  education: [],
  certifications: [],
  parallel_experience: [],
  transferable_notes: [],
  voice_samples: ['I build things people actually use.'],
  gaps: [],
  conflicts: [{ field: 'role_overlap', old_value: 'a', new_value: 'b', where: 'experience' }],
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
        identity: { name: '  Nik Page  ', contact: { email: 'n@example.com' }, country: 'Poland' },
        candidate_core: 'Rewritten core.',
        experience: [{ company: 'Beta Ltd', role: 'Head of Product', dates: '2019-2023', achievements: [{ text: 'Shipped checkout', metric: '20% fewer drop-offs' }] }],
      },
      STORED
    );

    expect(out.identity.name).toBe('Nik Page');
    expect(out.identity.country).toBe('Poland');
    expect(out.candidate_core).toBe('Rewritten core.');
    expect(out.experience[0].role).toBe('Head of Product');
    expect(out.experience[0].dates).toBe('2019-2023');
    expect(out.experience[0].achievements[0].metric).toBe('20% fewer drop-offs');
    expect(out.experience[0].achievements[0].skills_utilized).toEqual([]);
  });

  test('drops unknown keys instead of writing them into the record', () => {
    const out = normaliseMaster(
      { experience: [], candidate_core: 'x', __proto__polluted: true, evil: { nested: 1 }, master_cv: 'nope' },
      STORED
    );
    expect(out.evil).toBeUndefined();
    expect(out.master_cv).toBeUndefined();
    expect(Object.keys(out).sort()).toEqual(
      ['candidate_core', 'certifications', 'conflicts', 'education', 'experience', 'gaps', 'identity', 'parallel_experience', 'transferable_notes', 'voice_samples'].sort()
    );
  });

  test('carries voice_samples and conflicts from the stored record, ignoring submitted ones', () => {
    const out = normaliseMaster(
      { experience: [], voice_samples: ['I am a fabricated quote.'], conflicts: [] },
      STORED
    );
    expect(out.voice_samples).toEqual(['I build things people actually use.']);
    expect(out.conflicts).toEqual(STORED.conflicts);
  });

  // The real defect: the editor renders no field for gaps, so the model's gap
  // OBJECTS rode through the deep copy of the whole record and were coerced by
  // String() into eight literal "[object Object]" strings, destroying them.
  describe('gaps survive a save the editor never rendered', () => {
    const withGaps = {
      ...STORED,
      gaps: [
        { field: 'experience[2].dates', note: 'no dates given for AVG' },
        'identity.contact.location',
      ],
    };

    test('never stringifies an object gap into a placeholder', () => {
      const out = normaliseMaster({ ...STORED, gaps: withGaps.gaps }, withGaps);
      expect(JSON.stringify(out.gaps)).not.toContain('[object Object]');
    });

    test('carries the stored gaps through verbatim', () => {
      const out = normaliseMaster({ ...STORED, gaps: withGaps.gaps }, withGaps);
      expect(out.gaps).toEqual(withGaps.gaps);
    });

    test('ignores gaps submitted by the editor, like conflicts', () => {
      const out = normaliseMaster({ ...STORED, gaps: ['injected by the client'] }, withGaps);
      expect(out.gaps).toEqual(withGaps.gaps);
    });
  });

  // str() used to render any non-scalar through String(), so a stray object in
  // ANY coerced field became the same placeholder. It is dropped now.
  test('drops an object where a scalar belongs rather than writing a placeholder', () => {
    const out = normaliseMaster(
      { ...STORED, candidate_core: { text: 'an object where prose belongs' } },
      STORED
    );
    expect(out.candidate_core).toBe('');
  });

  test('preserves nested contracts on a merged role', () => {
    const out = normaliseMaster(
      { experience: [{ company: 'Self', role: 'Consultant', contracts: [{ company: 'eBay', role: 'Advisor' }] }] },
      STORED
    );
    expect(out.experience[0].contracts).toHaveLength(1);
    expect(out.experience[0].contracts[0].company).toBe('eBay');
  });

  test('drops empty rows the editor left behind', () => {
    const out = normaliseMaster(
      {
        experience: [{ company: '', role: '', achievements: [{ text: '' }] }, { company: 'Acme', role: 'Dev' }],
        education: [{ institution: '', qualification: '' }],
        certifications: [{ name: '' }],
      },
      STORED
    );
    expect(out.experience).toHaveLength(1);
    expect(out.experience[0].company).toBe('Acme');
    expect(out.education).toEqual([]);
    expect(out.certifications).toEqual([]);
  });

  // The editor renders only part of the master. Anything it does not show is
  // absent from what it posts back, so dropping unknown keys DELETED real
  // content from the stored record on every save — the displayed record and the
  // record in the database silently diverged.
  test('carries stored fields the editor never rendered through a save', () => {
    const stored = {
      ...STORED,
      voice_guide: 'I write short. Verb first, no windup.',
      gaps: ['No dates for the 2015 role.'],
      source_notes: 'built from cv-v3.pdf',
      identity: { ...STORED.identity, nationality: 'British' },
      experience: [
        {
          ...STORED.experience[0],
          clarification: 'Contract, not permanent.',
          contracts: [{ company: 'Sub Ltd', role: 'Consultant', dates: '2020-2021' }],
          achievements: [{ text: 'Shipped checkout', metric: '', skills_utilized: [], source_quote: 'I shipped checkout' }],
        },
      ],
    };
    // What the editor actually posts: a deep copy of the whole record with the
    // rendered fields patched — so nested unknown fields ride along, while
    // top-level ones it never put in state (voice_guide, source_notes) do not.
    const edited = {
      identity: { name: 'Nik Page', contact: { email: 'n@example.com', links: [] }, country: 'Czech Republic', languages: [] },
      candidate_core: 'Product leader.',
      experience: [
        {
          company: 'Beta Ltd',
          role: 'PM',
          dates: '2019-2022',
          location: 'Prague',
          core_tags: [],
          clarification: 'Contract, not permanent.',
          contracts: [{ company: 'Sub Ltd', role: 'Consultant', dates: '2020-2021' }],
          achievements: [
            { text: 'Shipped checkout', metric: '', skills_utilized: [], source_quote: 'I shipped checkout' },
          ],
        },
      ],
      education: [],
      certifications: [],
      parallel_experience: [],
      transferable_notes: [],
      gaps: ['No dates for the 2015 role.'],
    };

    const out = normaliseMaster(edited, stored);

    expect(out.voice_guide).toBe('I write short. Verb first, no windup.');
    expect(out.source_notes).toBe('built from cv-v3.pdf');
    expect(out.identity.nationality).toBe('British');
    expect(out.gaps).toEqual(['No dates for the 2015 role.']);
    // Nested: role-level and achievement-level fields the editor never rendered.
    expect(out.experience[0].clarification).toBe('Contract, not permanent.');
    expect(out.experience[0].contracts[0].company).toBe('Sub Ltd');
    expect(out.experience[0].achievements[0].source_quote).toBe('I shipped checkout');
    // The edit itself still wins where the user actually typed something.
    expect(out.experience[0].company).toBe('Beta Ltd');
    expect(out.voice_samples).toEqual(STORED.voice_samples);
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
      master: { ...STORED, candidate_core: 'Rewritten core.' },
    });
    await done;

    expect(res.statusCode).toBe(200);
    expect(mockGetMasterCv).toHaveBeenCalledWith(SESSION_USER);
    const [savedUserId, savedMaster] = mockSaveMasterCv.mock.calls[0];
    expect(savedUserId).toBe(SESSION_USER);
    expect(savedMaster.candidate_core).toBe('Rewritten core.');
    expect(res._getJSONData().master.candidate_core).toBe('Rewritten core.');
  });

  test('a submitted voice_sample never reaches the database', async () => {
    const { done } = call({ master: { ...STORED, voice_samples: ['Forged quote.'] } });
    await done;
    expect(mockSaveMasterCv.mock.calls[0][1].voice_samples).toEqual(['I build things people actually use.']);
  });

  test('refuses an edit that would remove every role', async () => {
    const { res, done } = call({ master: { ...STORED, experience: [] } });
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
