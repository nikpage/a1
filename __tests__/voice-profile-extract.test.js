// __tests__/voice-profile-extract.test.js
//
// buildVoiceProfile() coerces the model's JSON into the stored shape. It used to
// return only { list_a, list_b, confidence } and drop `registers` on the floor —
// so the field the panel shows back ("Read as: work email; blog post") was
// EMPTY on every profile ever built, and permanently: the save route preserves
// the stored registers rather than taking the client's, so nothing could ever
// put them back. Red on the old code.
//
// Only the network (axios) and Supabase are mocked; buildVoiceProfile and its
// coercion are the real ones.

vi.hoisted(() => {
  process.env.GEMINI_API_KEYS = 'key1';
});

import { describe, test, expect, vi, beforeEach } from 'vitest';

const mockAxiosPost = vi.hoisted(() => vi.fn());

vi.mock('axios', () => ({ default: { post: mockAxiosPost } }));
vi.mock('../utils/database.js', () => ({
  logAiTransaction: vi.fn(),
  getAiSpendSince: vi.fn().mockResolvedValue({ total: 0, unpriced: 0 }),
}));

const MODEL_JSON = JSON.stringify({
  registers: [
    { sample: 1, register: 'work email', distance: 'close to cover-letter prose' },
    { sample: 2, register: 'personal message', distance: 'far' },
    { sample: 3, register: '', distance: 'far' }, // no register named — dropped
  ],
  list_a: ['Averages 12-word sentences, then drops a 3-word one.', '   '],
  list_b: [
    { trait: 'swears when emphatic', translation: 'states it flat, no hedging' },
    { trait: 'emoji', translation: '' }, // untranslated — must never reach a generator
  ],
  confidence: 'Three samples, two registers.',
});

let buildVoiceProfile, runWithAiContext;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  mockAxiosPost.mockResolvedValue({
    data: {
      choices: [{ message: { content: MODEL_JSON } }],
      usage: { prompt_tokens: 1000, completion_tokens: 200, total_tokens: 1250 },
      model: 'gemini-3.5-flash',
    },
  });
  ({ buildVoiceProfile } = await import('../utils/openai.js'));
  ({ runWithAiContext } = await import('../utils/ai-meter.js'));
});

describe('buildVoiceProfile', () => {
  test('carries the registers the extraction read off the samples', async () => {
    const { profile } = await runWithAiContext({ user_id: 'u1', context: 'test' }, () =>
      buildVoiceProfile([{ text: 'a' }, { text: 'b' }, { text: 'c' }])
    );

    expect(profile.registers).toEqual([
      { sample: 1, register: 'work email', distance: 'close to cover-letter prose' },
      { sample: 2, register: 'personal message', distance: 'far' },
    ]);
  });

  test('still returns the two lists and the confidence note, blanks dropped', async () => {
    const { profile } = await runWithAiContext({ user_id: 'u1', context: 'test' }, () =>
      buildVoiceProfile([{ text: 'a' }])
    );

    expect(profile.list_a).toEqual(['Averages 12-word sentences, then drops a 3-word one.']);
    expect(profile.list_b).toEqual([
      { trait: 'swears when emphatic', translation: 'states it flat, no hedging' },
    ]);
    expect(profile.confidence).toBe('Three samples, two registers.');
  });
});
