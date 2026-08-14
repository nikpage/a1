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
//   - the FIX pass: one call, literal quotes, only the divergences repaired.
//   - the ROUTE: session user only, samples too thin refused, hand edits kept.
//   - NO LABEL QUESTION: the register is read off the text, never asked for.

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
} from '../prompts/voice-profile.js';
import { buildVoiceRewritePrompt } from '../prompts/voice-check.js';
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
  registers: [
    { sample: 1, register: 'work email', distance: 'close to a letter' },
    { sample: 2, register: 'personal message', distance: 'far' },
  ],
  samples: [
    { text: 'We shipped the migration on Friday. It broke nothing. The team stayed late twice.' },
    { text: 'look mate the thing is fucking useless, i binned it' },
  ],
};

describe('buildVoiceProfilePrompt', () => {
  test('reads the register off the text instead of being told it', () => {
    const [, user] = buildVoiceProfilePrompt({ samples: [{ text: 'hey so anyway' }] });
    expect(user.content).toMatch(/work out FROM THE WRITING ITSELF what kind of writing it is/);
    expect(user.content).toMatch(/Nobody has told you: infer it/);
    expect(user.content).toContain('"registers"');
  });

  test('carries no label for the user to have set — the sample is just its text', () => {
    const [, user] = buildVoiceProfilePrompt({
      samples: [{ label: 'personal', text: 'hey so anyway' }],
    });
    // A label passed in by an old caller must not become an instruction.
    expect(user.content).not.toMatch(/WHAT IT IS:/);
    expect(user.content).not.toMatch(/DISTANCE FROM BUSINESS PROSE:/);
  });

  test('demands 15-25 actionable observations, split into the two lists, and translations for List B', () => {
    const [, user] = buildVoiceProfilePrompt({ samples: [{ text: 'x' }] });
    expect(user.content).toMatch(/15 to 25 observations/);
    expect(user.content).toMatch(/LIST A — carries across registers/);
    expect(user.content).toMatch(/LIST B — register-bound\. NEVER applied directly/);
    expect(user.content).toMatch(/Translate, never delete/);
    // Not scores, not tags — a written profile.
    expect(user.content).toMatch(/No scores, no ratings, no tag lists/);
  });

  test('says out loud when only one sample was given, so the model reports what it could not test', () => {
    const [, one] = buildVoiceProfilePrompt({ samples: [{ text: 'x' }] });
    const [, two] = buildVoiceProfilePrompt({ samples: [{ text: 'x' }, { text: 'y' }] });
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

  test('takes the samples in the order they were pasted', () => {
    const out = voiceExcerptBlock(PROFILE);
    expect(out.indexOf('We shipped the migration')).toBeLessThan(out.indexOf('look mate'));
  });

  test('uses at most two samples', () => {
    const out = voiceExcerptBlock({
      samples: [{ text: 'first one' }, { text: 'second one' }, { text: 'third one' }],
    });
    expect(out).toContain('first one');
    expect(out).toContain('second one');
    expect(out).not.toContain('third one');
  });

  test('truncates a long sample rather than pasting pages of it', () => {
    const out = voiceExcerptBlock({ samples: [{ text: 'w '.repeat(2000) }] }, 100);
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

describe('the voice rewrite prompt — one call, the whole letter', () => {
  test('numbers the profile lines and never includes a raw register-bound trait', () => {
    const [, user] = buildVoiceRewritePrompt({ document: 'A letter.', profile: PROFILE });
    expect(user.content).toMatch(/1\. Averages 12-word sentences/);
    expect(user.content).toContain('States it flatly, with no hedging, when emphatic.');
    expect(user.content).not.toContain('Swears when emphatic');
  });

  // The whole reason this pass changed: a clause-level repair cannot reach the
  // shape, and the shape is what reads as machine-written.
  test('it asks for a real rewrite of the shape, not a light edit', () => {
    const [, user] = buildVoiceRewritePrompt({ document: 'A letter.', profile: PROFILE });
    expect(user.content).toMatch(/Rewrite it properly/);
    expect(user.content).toMatch(/split or merge the paragraphs/);
    expect(user.content).toMatch(/A light edit is the wrong answer/);
    expect(user.content).toMatch(/Vary sentence length hard/);
    // And it returns a letter, not the old span contract.
    expect(user.content).toMatch(/Return the rewritten letter only/);
    expect(user.content).not.toContain('"unsupported"');
    expect(user.content).not.toMatch(/must appear VERBATIM/);
  });

  test('the facts are locked even though everything else may move', () => {
    const [, user] = buildVoiceRewritePrompt({ document: 'A letter.', profile: PROFILE });
    expect(user.content).toMatch(/The fact lock \(absolute\)/);
    expect(user.content).toMatch(/Add nothing/);
    expect(user.content).toMatch(/Do not sharpen a fact/);
    expect(user.content).toMatch(/never invent a scene, a memory, a year or a mood/i);
  });

  test('the candidate’s own writing is included so the cadence can be heard', () => {
    const [, user] = buildVoiceRewritePrompt({ document: 'A letter.', profile: PROFILE });
    expect(user.content).toMatch(/RHYTHM REFERENCE/);
    expect(user.content).toContain(PROFILE.samples[0].text.slice(0, 40));
    // Manner only — the fence survives the change of mechanism.
    expect(user.content).toMatch(/take NOTHING else from it/);
  });

  test('the ad sets how far the voice travels; with no ad the block is absent', () => {
    const [, withAd] = buildVoiceRewritePrompt({ document: 'x', profile: PROFILE, jobText: 'We are informal and hate corporate speak.' });
    expect(withAd.content).toMatch(/how far the voice travels/);
    expect(withAd.content).toContain('hate corporate speak');
    expect(withAd.content).toMatch(/Holding it in never means flattening it into business prose/);

    const [, without] = buildVoiceRewritePrompt({ document: 'x', profile: PROFILE });
    expect(without.content).not.toMatch(/how far the voice travels/);
  });

  test('measured shape faults are stated as numbers, not as advice', () => {
    const [, user] = buildVoiceRewritePrompt({
      document: 'x',
      profile: PROFILE,
      shapeFaults: ['The shortest sentence in the letter is 14 words.'],
    });
    expect(user.content).toMatch(/Measured faults in the draft's shape/);
    expect(user.content).toContain('The shortest sentence in the letter is 14 words.');

    const [, none] = buildVoiceRewritePrompt({ document: 'x', profile: PROFILE });
    expect(none.content).not.toMatch(/Measured faults/);
  });

  test('lets the profile win over convention and does not police informality', () => {
    const [, user] = buildVoiceRewritePrompt({ document: 'x', profile: PROFILE });
    expect(user.content).toMatch(/slightly too casual is a better outcome/);
    expect(user.content).toMatch(/Do not sand it into business prose/);
  });

  test('adds the tidy-up licence only when the user asked for it', () => {
    const [, off] = buildVoiceRewritePrompt({ document: 'x', profile: PROFILE });
    const [, on] = buildVoiceRewritePrompt({ document: 'x', profile: { ...PROFILE, options: { cleanup: true } } });
    expect(off.content).not.toMatch(/tidied while keeping their voice/);
    expect(on.content).toMatch(/tidied while keeping their voice/);
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
      profile: {
        registers: [{ sample: 1, register: 'work email', distance: 'close' }],
        list_a: ['Short sentences.'],
        list_b: [{ trait: 'swears', translation: 'flat assertion' }],
        confidence: 'One register only.',
      },
      gemini_usage: USAGE,
    });
  });

  test('extracts, saves under the SESSION user, and cost-logs the call', async () => {
    const { res, done } = await call({
      action: 'extract',
      user_id: 'victim-user',
      samples: [{ text: LONG }],
    });
    await done;

    expect(res.statusCode).toBe(200);
    expect(mockSaveVoiceProfile.mock.calls[0][0]).toBe(SESSION_USER);
    const saved = mockSaveVoiceProfile.mock.calls[0][1];
    expect(saved.list_a).toEqual(['Short sentences.']);
    expect(saved.samples[0].text).toBe(LONG);
    // The register comes from the extraction, not from the user.
    expect(saved.registers).toEqual([{ sample: 1, register: 'work email', distance: 'close' }]);

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
    const { res, done } = await call({ action: 'extract', samples: [{ text: 'Too short.' }] });
    await done;

    expect(res.statusCode).toBe(400);
    expect(mockBuildVoiceProfile).not.toHaveBeenCalled();
  });

  test("keeps the user's hand-written lines across a re-extract", async () => {
    mockGetVoiceProfile.mockResolvedValue({ profile_text: 'I never use exclamation marks.', options: { cleanup: true } });
    const { done } = await call({ action: 'extract', samples: [{ text: LONG }] });
    await done;

    const saved = mockSaveVoiceProfile.mock.calls[0][1];
    expect(saved.profile_text).toBe('I never use exclamation marks.');
    expect(saved.options.cleanup).toBe(true);
  });

  test('save keeps the stored samples — an edit cannot rewrite what was pasted', async () => {
    mockGetVoiceProfile.mockResolvedValue({
      samples: [{ text: LONG }],
      registers: [{ sample: 1, register: 'work email', distance: 'close' }],
    });
    const { res, done } = await call({
      action: 'save',
      profile: {
        list_a: ['Edited by hand.'],
        list_b: [],
        profile_text: 'No exclamation marks.',
        samples: [{ text: 'injected' }],
        registers: [{ sample: 1, register: 'injected register', distance: 'x' }],
      },
    });
    await done;

    expect(res.statusCode).toBe(200);
    const saved = mockSaveVoiceProfile.mock.calls[0][1];
    expect(saved.list_a).toEqual(['Edited by hand.']);
    expect(saved.samples[0].text).toBe(LONG);
    // Neither the samples nor the read registers are editable from a save.
    expect(saved.registers[0].register).toBe('work email');
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
