// __tests__/apply-voice.test.js
//
// applyVoice() — the check-then-repair pass that most of the voice quality comes
// from, because a first draft drifts to generic business prose whatever the
// prompt says. Only Gemini is stubbed (an external boundary); the real function
// decides what to call, what to apply and what to discard.
//
// What must hold:
//   - a clean draft costs ONE call, not two (no fix pass with nothing to fix);
//   - misses drive a fix pass, applied by literal string match;
//   - a "fix" quoting text the letter does not contain is DISCARDED, so the
//     repair pass cannot rewrite the letter out from under the fact-checker;
//   - every call is reported for cost logging, including on the failure paths;
//   - any failure returns the document untouched — a letter in the wrong voice
//     still beats no letter.

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

const PROFILE = {
  list_a: ['Leads with the point; never sets up.'],
  list_b: [{ trait: 'swears', translation: 'States it flat, no hedging.' }],
  profile_text: '',
};

const DOC = 'I am writing to express my interest in the role.\n\nI shipped the migration in 2024.';

// One Gemini reply, shaped like the OpenAI-compatible response the code reads.
function reply(payload) {
  return {
    data: {
      model: 'gemini-2.5-flash',
      usage: { prompt_tokens: 100, completion_tokens: 40, total_tokens: 150 },
      choices: [{ message: { content: JSON.stringify(payload) } }],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('applyVoice', () => {
  test('a draft that matches the profile costs one call and is returned untouched', async () => {
    mockPost.mockResolvedValueOnce(reply({ misses: [] }));

    const out = await applyVoice({ document: DOC, profile: PROFILE });

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(out.content).toBe(DOC);
    expect(out.misses).toEqual([]);
    expect(out.gemini_usages).toHaveLength(1);
  });

  test('repairs a flagged span and leaves the rest of the letter alone', async () => {
    mockPost
      .mockResolvedValueOnce(reply({
        misses: [{ profile_line: 1, miss: 'opens with setup', quote: 'I am writing to express my interest in the role.' }],
      }))
      .mockResolvedValueOnce(reply({
        unsupported: [{
          quote: 'I am writing to express my interest in the role.',
          replacement: 'I shipped a migration that broke nothing. That is the job you are hiring for.',
          reason: 'voice: leads with the point',
        }],
      }));

    const out = await applyVoice({ document: DOC, profile: PROFILE });

    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(out.content).toContain('I shipped a migration that broke nothing.');
    expect(out.content).not.toContain('I am writing to express my interest');
    // Untouched text stays byte-identical — this is a span repair, not a rewrite.
    expect(out.content).toContain('I shipped the migration in 2024.');
    expect(out.applied).toHaveLength(1);
    expect(out.gemini_usages).toHaveLength(2);
  });

  test('discards a repair whose quote is not verbatim in the letter', async () => {
    mockPost
      .mockResolvedValueOnce(reply({ misses: [{ profile_line: 1, miss: 'flat', quote: 'I am writing to express my interest in the role.' }] }))
      .mockResolvedValueOnce(reply({
        unsupported: [{
          quote: 'a sentence that is not in the letter at all',
          replacement: 'I led a team of 40 across three countries.',
          reason: 'voice',
        }],
      }));

    const out = await applyVoice({ document: DOC, profile: PROFILE });

    // The invented claim never lands: the literal-match gate drops it.
    expect(out.content).toBe(DOC);
    expect(out.content).not.toContain('team of 40');
    expect(out.applied).toEqual([]);
  });

  test('a failed check returns the document untouched and still reports the call', async () => {
    mockPost.mockResolvedValueOnce({ data: { model: 'gemini-2.5-flash', usage: {}, choices: [{ message: { content: 'not json' } }] } });

    const out = await applyVoice({ document: DOC, profile: PROFILE });

    expect(out.content).toBe(DOC);
    expect(out.gemini_usages).toHaveLength(1);
  });

  test('a failed fix keeps the draft and reports both calls', async () => {
    mockPost
      .mockResolvedValueOnce(reply({ misses: [{ profile_line: 1, miss: 'x', quote: 'I shipped the migration in 2024.' }] }))
      .mockResolvedValueOnce({ data: { model: 'gemini-2.5-flash', usage: {}, choices: [{ message: { content: '{{{' } }] } });

    const out = await applyVoice({ document: DOC, profile: PROFILE });

    expect(out.content).toBe(DOC);
    expect(out.gemini_usages).toHaveLength(2);
    expect(out.misses).toHaveLength(1);
  });

  test('spends nothing when there is no profile to check against', async () => {
    const none = await applyVoice({ document: DOC, profile: null });
    const empty = await applyVoice({ document: DOC, profile: { list_a: [], list_b: [], profile_text: '' } });
    // A profile whose only List B entry has no translation is also nothing to check.
    const untranslated = await applyVoice({ document: DOC, profile: { list_a: [], list_b: [{ trait: 'swears', translation: '' }] } });

    expect(mockPost).not.toHaveBeenCalled();
    expect(none.content).toBe(DOC);
    expect(empty.content).toBe(DOC);
    expect(untranslated.content).toBe(DOC);
  });
});
