// __tests__/apply-voice.test.js
//
// applyVoice() — the pass most of the voice quality comes from, because a first
// draft drifts to generic business prose whatever the writing prompt says. Only
// Gemini is stubbed (an external boundary); the real function decides what to
// call, what to keep and what to throw away.
//
// It REWRITES THE WHOLE LETTER (CV_RULES.md, Layer 6 check 24). It used to
// return { quote, replacement } spans applied by literal match, which was safe
// and useless: what reads as machine-written is the letter's SHAPE — every
// sentence the same length, every paragraph the same weight — and no span
// replacement can split a paragraph or land a four-word sentence. The old tests
// pinned that mechanism; these pin the behaviour that replaced it.
//
// What must hold:
//   - the rewritten letter replaces the draft outright;
//   - a second pass runs ONLY while the letter is still measurably flat, and
//     never more than once — this pass is capped at two calls;
//   - a second pass that does not improve the shape is discarded;
//   - wreckage (a fragment, a JSON object, a padded essay) is discarded and the
//     draft kept, because everything else the rewrite could get wrong is caught
//     by the truth passes that run after it;
//   - every call is reported for cost logging, including on the failure path;
//   - no profile means no call and no spend.

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://fake.supabase';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fake-anon-key';
  process.env.UPSTASH_REDIS_REST_URL = 'http://fake.redis';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';
  process.env.GEMINI_API_KEYS = 'k1';
});

import { describe, test, expect, vi, beforeEach } from 'vitest';

const mockPost = vi.hoisted(() => vi.fn());
vi.mock('axios', () => ({ default: { post: mockPost } }));
vi.mock('@upstash/redis', () => ({
  Redis: { fromEnv: () => ({ incrbyfloat: async () => 0, expire: async () => 1 }) },
}));

const { applyVoice } = await import('../utils/openai.js');
const { coverShapeFaults } = await import('../utils/cv-validate.js');

const PROFILE = {
  list_a: ['Leads with the point; never sets up.'],
  list_b: [{ trait: 'swears', translation: 'States it flat, no hedging.' }],
  profile_text: '',
  samples: [{ text: 'I met an interior designer last week. She wanted advice. I gave her one sentence of it.' }],
};

// A letter with the machine's shape: nothing short, nothing varied. It is long
// enough to clear the usable-output floor, so what the tests exercise is the
// shape logic and not the length guard.
const FLAT = [
  '14.08.2026',
  '',
  'Dear Hiring Manager,',
  '',
  'I founded the user experience function at a large retail bank in Prague and ran it for four years with a team of eight designers.',
  'My work as a principal consultant has involved a range of high impact engagements across several different industries and company sizes.',
  'I grew monthly billing on the eBay account from under twenty thousand dollars to over one hundred thousand dollars in eighteen months.',
  'My approach centres on data driven decisions rather than intuition alone, which is what allowed those numbers to move in the first place.',
  '',
  'Sincerely,',
  '',
  '**Nik Page**',
].join('\n');

// The same letter with a human shape — short sentences, varied lengths.
const VARIED = [
  '14.08.2026',
  '',
  'Dear Hiring Manager,',
  '',
  'I founded the user experience function at a large retail bank in Prague and ran it for four years with a team of eight designers.',
  'That taught me one thing.',
  'Discovery is cheap and rework is not, which is the argument I have been making to clients ever since and the reason the eBay account grew.',
  '',
  'Monthly billing went from under twenty thousand dollars to over one hundred thousand.',
  'No magic. Data, and the discipline to act on it.',
  '',
  'Sincerely,',
  '',
  '**Nik Page**',
].join('\n');

// One Gemini reply, shaped like the OpenAI-compatible response the code reads.
// The rewrite pass returns PROSE, not JSON.
function reply(text) {
  return {
    data: {
      model: 'gemini-2.5-flash',
      usage: { prompt_tokens: 900, completion_tokens: 300, total_tokens: 1200 },
      choices: [{ message: { content: text } }],
    },
  };
}

beforeEach(() => {
  // reset, not clear: clearAllMocks leaves a queued mockResolvedValueOnce in
  // place, so one test's leftover reply lands in the next test's first call.
  mockPost.mockReset();
});

describe('applyVoice', () => {
  // The fixtures have to actually differ in shape or every test below is
  // asserting on nothing.
  test('the fixtures are what they claim: one flat, one not', () => {
    expect(coverShapeFaults(FLAT).length).toBeGreaterThan(0);
    expect(coverShapeFaults(VARIED)).toEqual([]);
  });

  test('the rewritten letter replaces the draft outright — not a patched clause', async () => {
    mockPost.mockResolvedValueOnce(reply(VARIED));

    const out = await applyVoice({ document: FLAT, profile: PROFILE });

    expect(out.content).toBe(VARIED);
    expect(out.content).toContain('That taught me one thing.');
    expect(out.gemini_usages).toHaveLength(1);
  });

  test('one call is enough when the rewrite fixed the shape', async () => {
    mockPost.mockResolvedValueOnce(reply(VARIED));

    await applyVoice({ document: FLAT, profile: PROFILE });

    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  test('a rewrite that is still flat gets one more pass, and never a third', async () => {
    // Both attempts come back flat. The pass must stop at two.
    mockPost.mockResolvedValue(reply(FLAT));

    const out = await applyVoice({ document: FLAT, profile: PROFILE });

    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(out.gemini_usages).toHaveLength(2);
  });

  test('the second pass is told what was measured, in numbers', async () => {
    mockPost.mockResolvedValue(reply(FLAT));

    await applyVoice({ document: FLAT, profile: PROFILE });

    const secondPrompt = mockPost.mock.calls[1][1].messages[1].content;
    expect(secondPrompt).toMatch(/Measured faults in the draft's shape/);
    expect(secondPrompt).toMatch(/shortest sentence in the letter is \d+ words/);
  });

  test('a second pass that does not improve the shape is discarded', async () => {
    // Both rewrites come back flat, so neither is an improvement on the other.
    // The FIRST one stands: the second is thrown away rather than shipped on the
    // grounds that it is newer.
    const first = FLAT.replace('Sincerely,', 'Yours,');
    const second = FLAT.replace('Sincerely,', 'Best,');
    mockPost.mockResolvedValueOnce(reply(first)).mockResolvedValueOnce(reply(second));

    const out = await applyVoice({ document: FLAT, profile: PROFILE });

    expect(out.content).toBe(first);
    expect(out.content).not.toBe(second);
  });

  test('the ad is given to the rewrite, so the voice is held to the target’s register', async () => {
    mockPost.mockResolvedValueOnce(reply(VARIED));

    await applyVoice({ document: FLAT, profile: PROFILE, jobText: 'We are a small, informal team and we hate corporate speak.' });

    const prompt = mockPost.mock.calls[0][1].messages[1].content;
    expect(prompt).toMatch(/how far the voice travels/i);
    expect(prompt).toContain('we hate corporate speak');
  });

  test('wreckage is discarded and the draft kept', async () => {
    // A fragment, well under the floor a letter has to clear.
    mockPost.mockResolvedValue(reply('Sure! Here is the rewritten letter.'));

    const out = await applyVoice({ document: FLAT, profile: PROFILE });

    expect(out.content).toBe(FLAT);
  });

  test('a JSON object is not a letter', async () => {
    mockPost.mockResolvedValue(reply(JSON.stringify({ unsupported: [{ quote: 'x', replacement: 'y' }] }).padEnd(300, ' ')));

    const out = await applyVoice({ document: FLAT, profile: PROFILE });

    expect(out.content).toBe(FLAT);
  });

  test('a padded rewrite is discarded — the letter may not grow', async () => {
    const padded = `${VARIED}\n\n${VARIED}\n\n${VARIED}`;
    mockPost.mockResolvedValue(reply(padded));

    const out = await applyVoice({ document: FLAT, profile: PROFILE });

    expect(out.content).toBe(FLAT);
  });

  test('a call that comes back empty leaves the document untouched', async () => {
    mockPost.mockResolvedValue(reply(''));

    const out = await applyVoice({ document: FLAT, profile: PROFILE });

    expect(out.content).toBe(FLAT);
    // The call still happened and is still reported, so it is still cost-logged.
    expect(out.gemini_usages.length).toBeGreaterThan(0);
  });

  test('spends nothing when there is no profile to match against', async () => {
    const none = await applyVoice({ document: FLAT, profile: null });
    const empty = await applyVoice({ document: FLAT, profile: { list_a: [], list_b: [], profile_text: '' } });
    // A profile whose only List B entry has no translation is also nothing to match.
    const untranslated = await applyVoice({ document: FLAT, profile: { list_a: [], list_b: [{ trait: 'swears', translation: '' }] } });

    expect(mockPost).not.toHaveBeenCalled();
    expect(none.content).toBe(FLAT);
    expect(empty.content).toBe(FLAT);
    expect(untranslated.content).toBe(FLAT);
  });
});
