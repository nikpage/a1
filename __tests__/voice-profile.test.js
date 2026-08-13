// __tests__/voice-profile.test.js
//
// The voice feature, at the points where it can silently fail:
//
//   - the LIST B SPLIT: a register-bound habit (profanity, "look,", rhetorical
//     questions) must NEVER reach a generator raw. Only its translation does.
//     If that leaks, the product swears in a cover letter.
//   - the EXCERPT FENCE: sample text is handed to the writer for rhythm, so the
//     instruction barring it from carrying facts has to be present and absolute.
//   - the SEPARATION from the master: voice text must not be in the evidence set
//     the truth-verify pass and Layer 6 validator check claims against.
//   - the CHECK/FIX pass: it must report literal quotes and repair only those.
//   - the ROUTE: session user only, samples too thin refused, hand edits kept.

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-voice-profile-secret';
  process.env.NODE_ENV = 'test';
});

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createRequest, createResponse } from 'node-mocks-http';
import {
  buildVoiceProfilePrompt,
  voiceProfileBlock,
  voiceExcerptBlock,
  SAMPLE_LABELS,
} from '../prompts/voice-profile.js';
import { buildVoiceCheckPrompt, buildVoiceFixPrompt } from '../prompts/voice-check.js';
import { buildCoverPrompt } from '../prompts/cover-letter.js';

const PROFILE = {
  list_a: [
    'Averages 12-word sentences, then drops a 3-word one to land the point.',
    'Leads with the point; never sets up.',
  ],
  list_b: [
    { trait: 'Swears when emphatic — "fucking useless"', translation: 'States it flatly, with no hedging, when emphatic.' },
    { trait: 'Opens pivots with "Look,"', translation: 'Uses a short declarative sentence to pivot.' },
  ],
  profile_text: 'I never use exclamation marks.',
  options: { cleanup: false },
  samples: [
    { label: 'work_doc', text: 'We shipped the migration on Friday. It broke nothing. The team stayed late twice.' },
    { label: 'personal', text: 'look mate the thing is fucking useless, i binned it' },
  ],
};

describe('buildVoiceProfilePrompt', () => {
  test('labels each sample and tells the model how far that register is from business prose', () => {
    const [, user] = buildVoiceProfilePrompt({
      samples: [{ label: 'personal', text: 'hey so anyway' }],
    });
    expect(user.content).toContain(SAMPLE_LABELS.personal);
    expect(user.content).toMatch(/DISTANCE FROM BUSINESS PROSE: a lot/);
  });

  test('demands 15-25 actionable observations, split into the two lists, and translations for List B', () => {
    const [, user] = buildVoiceProfilePrompt({ samples: [{ label: 'public', text: 'x' }] });
    expect(user.content).toMatch(/15 to 25 observations/);
    expect(user.content).toMatch(/LIST A — carries across registers/);
    expect(user.content).toMatch(/LIST B — register-bound\. NEVER applied directly/);
    expect(user.content).toMatch(/Translate, never delete/);
    // Not scores, not tags — a written profile.
    expect(user.content).toMatch(/No scores, no ratings, no tag lists/);
  });

  test('says out loud when only one sample was given, so the model reports what it could not test', () => {
    const [, one] = buildVoiceProfilePrompt({ samples: [{ label: 'public', text: 'x' }] });
    const [, two] = buildVoiceProfilePrompt({
      samples: [{ label: 'public', text: 'x' }, { label: 'work_doc', text: 'y' }],
    });
    expect(one.content).toMatch(/Only one sample was supplied/);
    expect(two.content).not.toMatch(/Only one sample was supplied/);
  });
});

describe('voiceProfileBlock — what the generator is actually given', () => {
  const block = voiceProfileBlock(PROFILE);

  test('passes List A and the TRANSLATIONS through', () => {
    expect(block).toContain('Averages 12-word sentences');
    expect(block).toContain('States it flatly, with no hedging, when emphatic.');
    expect(block).toContain('Uses a short declarative sentence to pivot.');
  });

  test('never hands the raw register-bound trait to the writer', () => {
    // The whole point of the split: this is the leak that puts profanity in a
    // cover letter.
    expect(block).not.toMatch(/fucking/i);
    expect(block).not.toContain('Swears when emphatic');
    expect(block).not.toContain('Opens pivots with "Look,"');
  });

  test("puts the user's own lines above the extracted ones", () => {
    expect(block).toContain('I never use exclamation marks.');
    expect(block).toMatch(/outrank everything above/);
  });

  test('states that it governs manner only and cannot license a fact', () => {
    expect(block).toMatch(/never WHAT is true/);
    expect(block).toMatch(/can never license a fact/);
    // Slightly-too-casual beats template — the spec's explicit preference.
    expect(block).toMatch(/slightly too casual is a better outcome/);
  });

  test('renders nothing at all when there is no profile', () => {
    expect(voiceProfileBlock(null)).toBe('');
    expect(voiceProfileBlock({ list_a: [], list_b: [], profile_text: '' })).toBe('');
  });

  test('drops a List B trait whose translation is missing', () => {
    const out = voiceProfileBlock({ list_a: ['x'], list_b: [{ trait: 'swears', translation: '' }] });
    expect(out).not.toContain('swears');
  });

  test('includes the cleanup instruction only when the option is on', () => {
    expect(block).not.toMatch(/Cleanup requested/);
    expect(voiceProfileBlock({ ...PROFILE, options: { cleanup: true } })).toMatch(/Cleanup requested/);
  });
});

describe('voiceExcerptBlock', () => {
  test('bars the excerpt from carrying anything but rhythm', () => {
    const out = voiceExcerptBlock(PROFILE);
    expect(out).toMatch(/RHYTHM REFERENCE ONLY/);
    expect(out).toMatch(/take NOTHING else from it/);
    expect(out).toMatch(/Not a fact, not a claim, not a number/);
    expect(out).toMatch(/the master record is right/);
  });

  test('prefers the register closest to a letter', () => {
    const out = voiceExcerptBlock(PROFILE);
    // work_doc outranks personal, so the work sample leads.
    expect(out.indexOf('We shipped the migration')).toBeLessThan(out.indexOf('look mate'));
  });

  test('truncates a long sample rather than pasting pages of it', () => {
    const out = voiceExcerptBlock({ samples: [{ label: 'public', text: 'w '.repeat(2000) }] }, 100);
    expect(out).toContain('…');
    expect(out.length).toBeLessThan(600);
  });

  test('renders nothing without samples', () => {
    expect(voiceExcerptBlock({ samples: [] })).toBe('');
    expect(voiceExcerptBlock(null)).toBe('');
  });
});

describe('buildCoverPrompt with a voice profile', () => {
  const analysis = { job_match: {}, analysis: {} };

  test('carries the profile and an excerpt into the letter prompt', () => {
    const [, user] = buildCoverPrompt('{"identity":{"name":"A"}}', analysis, 'Formal', '', '', 'auto', new Date(), PROFILE);
    expect(user.content).toContain('Averages 12-word sentences');
    expect(user.content).toContain('States it flatly, with no hedging, when emphatic.');
    expect(user.content).toMatch(/RHYTHM REFERENCE ONLY/);
  });

  test('never leaks a raw register-bound trait into the letter prompt', () => {
    const [, user] = buildCoverPrompt('{}', analysis, 'Formal', '', '', 'auto', new Date(), PROFILE);
    expect(user.content).not.toContain('Swears when emphatic');
  });

  test('omits the whole block when the user has no profile', () => {
    const [, user] = buildCoverPrompt('{}', analysis, 'Formal', '', '', 'auto', new Date(), null);
    expect(user.content).not.toMatch(/RHYTHM REFERENCE ONLY/);
    expect(user.content).not.toMatch(/The candidate's own writing voice/);
  });
});

describe('voice check and fix prompts', () => {
  test('the check numbers the profile lines and demands a verbatim quote per miss', () => {
    const [, user] = buildVoiceCheckPrompt({ document: 'A letter.', profile: PROFILE });
    expect(user.content).toMatch(/1\. Averages 12-word sentences/);
    // Translations are numbered too; raw traits are not present to be numbered.
    expect(user.content).toContain('States it flatly, with no hedging, when emphatic.');
    expect(user.content).not.toContain('Swears when emphatic');
    expect(user.content).toMatch(/quotes the offending text EXACTLY/);
    expect(user.content).toMatch(/An empty list is a valid and useful answer/);
  });

  test('the check is told that drift to business prose is the target and mild informality is not a miss', () => {
    const [, user] = buildVoiceCheckPrompt({ document: 'x', profile: PROFILE });
    expect(user.content).toMatch(/Drift toward generic business writing is the failure you exist to catch/);
    expect(user.content).toMatch(/Mild informality is NOT a miss/);
  });

  test('the fix pass repairs only the flagged spans and may not add a fact', () => {
    const [, user] = buildVoiceFixPrompt({
      document: 'A letter.',
      profile: PROFILE,
      misses: [{ profile_line: 2, miss: 'opens with setup', quote: 'I am writing to apply' }],
    });
    expect(user.content).toContain('TEXT: "I am writing to apply"');
    expect(user.content).toMatch(/must appear VERBATIM/);
    expect(user.content).toMatch(/never add a fact, a number, a skill, a duration or a claim/);
    expect(user.content).toMatch(/Change nothing that was not flagged/);
    // Same span/replacement contract as the truth-verify pass, so corrections
    // can be applied by literal match and anything invented is discarded.
    expect(user.content).toContain('"unsupported"');
  });
});

// ── The route ───────────────────────────────────────────────────────────────
const mockGetVoiceProfile  = vi.hoisted(() => vi.fn());
const mockSaveVoiceProfile = vi.hoisted(() => vi.fn());
const mockLogAiTransaction = vi.hoisted(() => vi.fn());
const mockBuildVoiceProfile = vi.hoisted(() => vi.fn());

vi.mock('../utils/database', () => ({
  getVoiceProfile: mockGetVoiceProfile,
  saveVoiceProfile: mockSaveVoiceProfile,
  logAiTransaction: mockLogAiTransaction,
}));
vi.mock('../utils/openai', () => ({ buildVoiceProfile: mockBuildVoiceProfile }));
vi.mock('../lib/requireAuth', () => ({ default: (handler) => handler }));

const { default: handler } = await import('../pages/api/voice-profile.js');

const SESSION_USER = 'user-session-1';
const LONG = 'I shipped the migration on Friday and it broke nothing at all.'.repeat(10);
const USAGE = {
  label: 'voice profile',
  model: 'gemini-3.5-flash',
  inputTokens: 2000,
  outputTokens: 800,
  thinkingTokens: 100,
  costUsd: 0.01,
};

function call(body, user_id = SESSION_USER) {
  const req = createRequest({ method: 'POST', body });
  req.user = { user_id };
  const res = createResponse();
  return { res, done: handler(req, res) };
}

describe('POST /api/voice-profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetVoiceProfile.mockResolvedValue(null);
    mockSaveVoiceProfile.mockResolvedValue([{ user_id: SESSION_USER }]);
    mockBuildVoiceProfile.mockResolvedValue({
      profile: { list_a: ['Short sentences.'], list_b: [{ trait: 'swears', translation: 'flat assertion' }], confidence: 'One register only.' },
      gemini_usage: USAGE,
    });
  });

  test('extracts, saves under the SESSION user, and cost-logs the call', async () => {
    const { res, done } = await call({
      action: 'extract',
      user_id: 'victim-user',
      samples: [{ label: 'work_doc', text: LONG }],
    });
    await done;

    expect(res.statusCode).toBe(200);
    expect(mockSaveVoiceProfile.mock.calls[0][0]).toBe(SESSION_USER);
    const saved = mockSaveVoiceProfile.mock.calls[0][1];
    expect(saved.list_a).toEqual(['Short sentences.']);
    expect(saved.samples[0].label).toBe('work_doc');

    // The cost-logging rule has no exceptions: model, tokens, thinking tokens.
    expect(mockLogAiTransaction).toHaveBeenCalledWith(expect.objectContaining({
      user_id: SESSION_USER,
      model: USAGE.model,
      cache_miss_tokens: USAGE.inputTokens,
      completion_tokens: USAGE.outputTokens + USAGE.thinkingTokens,
      thinking_tokens: USAGE.thinkingTokens,
    }));
  });

  test('refuses a sample too thin to carry a pattern', async () => {
    const { res, done } = await call({ action: 'extract', samples: [{ label: 'work_doc', text: 'Too short.' }] });
    await done;

    expect(res.statusCode).toBe(400);
    expect(mockBuildVoiceProfile).not.toHaveBeenCalled();
  });

  test("keeps the user's hand-written lines across a re-extract", async () => {
    mockGetVoiceProfile.mockResolvedValue({ profile_text: 'I never use exclamation marks.', options: { cleanup: true } });
    const { done } = await call({ action: 'extract', samples: [{ label: 'work_doc', text: LONG }] });
    await done;

    const saved = mockSaveVoiceProfile.mock.calls[0][1];
    expect(saved.profile_text).toBe('I never use exclamation marks.');
    expect(saved.options.cleanup).toBe(true);
  });

  test('save keeps the stored samples — an edit cannot rewrite what was pasted', async () => {
    mockGetVoiceProfile.mockResolvedValue({ samples: [{ label: 'work_doc', text: LONG }] });
    const { res, done } = await call({
      action: 'save',
      profile: { list_a: ['Edited by hand.'], list_b: [], profile_text: 'No exclamation marks.', samples: [{ label: 'other', text: 'injected' }] },
    });
    await done;

    expect(res.statusCode).toBe(200);
    const saved = mockSaveVoiceProfile.mock.calls[0][1];
    expect(saved.list_a).toEqual(['Edited by hand.']);
    expect(saved.samples[0].text).toBe(LONG);
  });

  test('save drops a List B row whose translation was emptied', async () => {
    const { done } = await call({
      action: 'save',
      profile: { list_a: [], list_b: [{ trait: 'swears', translation: '   ' }], profile_text: '' },
    });
    await done;

    expect(mockSaveVoiceProfile.mock.calls[0][1].list_b).toEqual([]);
  });

  test('an unknown action changes nothing', async () => {
    const { res, done } = await call({ action: 'nonsense' });
    await done;

    expect(res.statusCode).toBe(400);
    expect(mockSaveVoiceProfile).not.toHaveBeenCalled();
  });

  test('rejects a non-POST method', async () => {
    const req = createRequest({ method: 'GET' });
    req.user = { user_id: SESSION_USER };
    const res = createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});
