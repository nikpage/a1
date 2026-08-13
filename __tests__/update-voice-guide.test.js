// __tests__/update-voice-guide.test.js
//
// POST /api/update-voice-guide — the ONLY path that can set `voice_guide`, the
// user's own statement of how they write. Before it existed the field was read
// by both generators, preserved by every save, and settable by nothing, so it
// stayed null and cover letters fell back to CV prose. What must hold:
//   - the record written is the SESSION user's, never a user_id from the body
//     (the attack: rewrite how someone else's documents are written);
//   - only the guide changes — no other field of the master is touched;
//   - an empty submission is a real CLEAR, not a silent no-op (saveMasterCv's
//     carry-forward must not resurrect the old prose);
//   - a non-string body is rejected rather than coerced to "[object Object]";
//   - no master record yet → 409, not a write that invents one.

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-voice-guide-secret';
  process.env.NODE_ENV = 'test';
});

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createRequest, createResponse } from 'node-mocks-http';

const mockGetMasterCv  = vi.hoisted(() => vi.fn());
const mockSaveMasterCv = vi.hoisted(() => vi.fn());

vi.mock('../utils/database', () => ({
  getMasterCv: mockGetMasterCv,
  saveMasterCv: mockSaveMasterCv,
}));
vi.mock('../lib/requireAuth', () => ({ default: (handler) => handler }));

import handler from '../pages/api/update-voice-guide.js';

const SESSION_USER = 'user-session-1';
const GUIDE = 'Short sentences. I open on the concrete thing, never on the claim.';
const MASTER = {
  candidate_core: 'Product leader.',
  experience: [{ company: 'Acme', role: 'PM', dates: '01/2020-Present' }],
  voice_samples: ['A sentence copied out of the CV.'],
  voice_guide: 'An older guide.',
};

function call(body, user_id = SESSION_USER) {
  const req = createRequest({ method: 'POST', body });
  req.user = { user_id };
  const res = createResponse();
  return { res, done: handler(req, res) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetMasterCv.mockResolvedValue(MASTER);
  mockSaveMasterCv.mockResolvedValue([{ user_id: SESSION_USER }]);
});

describe('POST /api/update-voice-guide', () => {
  test('saves the guide onto the session user\'s record and leaves every other field alone', async () => {
    const { res, done } = await call({ voice_guide: GUIDE });
    await done;

    expect(res.statusCode).toBe(200);
    const [user_id, saved] = mockSaveMasterCv.mock.calls[0];
    expect(user_id).toBe(SESSION_USER);
    expect(saved.voice_guide).toBe(GUIDE);
    expect(saved.candidate_core).toBe(MASTER.candidate_core);
    expect(saved.experience).toEqual(MASTER.experience);
    expect(saved.voice_samples).toEqual(MASTER.voice_samples);
    expect(res._getJSONData().master.voice_guide).toBe(GUIDE);
  });

  test('trims the submitted prose', async () => {
    const { done } = await call({ voice_guide: `  ${GUIDE}\n` });
    await done;
    expect(mockSaveMasterCv.mock.calls[0][1].voice_guide).toBe(GUIDE);
  });

  test('writes an explicit empty string so the guide can actually be cleared', async () => {
    const { res, done } = await call({ voice_guide: '   ' });
    await done;

    expect(res.statusCode).toBe(200);
    const saved = mockSaveMasterCv.mock.calls[0][1];
    // The KEY must be present and empty: saveMasterCv reads its absence as "this
    // write doesn't mention the guide" and carries the stored one forward.
    expect(Object.prototype.hasOwnProperty.call(saved, 'voice_guide')).toBe(true);
    expect(saved.voice_guide).toBe('');
  });

  test('ignores a user_id in the body — the session decides whose record is written', async () => {
    const { done } = await call({ voice_guide: GUIDE, user_id: 'victim-user' });
    await done;

    expect(mockGetMasterCv).toHaveBeenCalledWith(SESSION_USER);
    expect(mockSaveMasterCv.mock.calls[0][0]).toBe(SESSION_USER);
  });

  test('rejects a non-string guide instead of coercing it', async () => {
    const { res, done } = await call({ voice_guide: { evil: true } });
    await done;

    expect(res.statusCode).toBe(400);
    expect(mockSaveMasterCv).not.toHaveBeenCalled();
  });

  test('rejects prose over the length cap', async () => {
    const { res, done } = await call({ voice_guide: 'x'.repeat(4001) });
    await done;

    expect(res.statusCode).toBe(400);
    expect(mockSaveMasterCv).not.toHaveBeenCalled();
  });

  test('409s when there is no master record to attach the guide to', async () => {
    mockGetMasterCv.mockResolvedValue(null);
    const { res, done } = await call({ voice_guide: GUIDE });
    await done;

    expect(res.statusCode).toBe(409);
    expect(mockSaveMasterCv).not.toHaveBeenCalled();
  });

  test('rejects a non-POST method', async () => {
    const req = createRequest({ method: 'GET' });
    req.user = { user_id: SESSION_USER };
    const res = createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(mockSaveMasterCv).not.toHaveBeenCalled();
  });
});
