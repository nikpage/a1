// __tests__/master-cv-json.test.js
//
// The master build/merge runs on the overloaded flash-lite pool, which sometimes
// wraps its JSON in a chatty preamble or a trailing note. A strict JSON.parse on
// the whole reply then threw, the background worker swallowed it as "build
// failed", and the user was charged for a master that never got saved. These pin
// the tolerant parse: a wrapped-but-valid master is rescued; genuinely
// unparseable output still fails loudly.
//
// Red on the old code (strict JSON.parse(stripJsonFences) threw on the preamble);
// green on the new parseJsonLoose fallback.

vi.hoisted(() => {
  process.env.GEMINI_API_KEYS = 'key1';
  Math.random = () => 0;
});

import { describe, test, expect, vi, beforeEach } from 'vitest';

const mockAxiosPost = vi.hoisted(() => vi.fn());

vi.mock('axios', () => ({ default: { post: mockAxiosPost } }));

// Mock only the prompt builders (sacred files, irrelevant to JSON handling).
vi.mock('../prompts/master-cv.js', () => ({
  buildMasterCvPrompt: () => [{ role: 'user', content: 'build master' }],
  buildMasterVerifyPrompt: () => [{ role: 'user', content: 'verify master' }],
}));

import { buildOrMergeMaster } from '../utils/openai.js';

function geminiResp(content) {
  return {
    data: {
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      model: 'gemini-2.5-flash-lite',
    },
  };
}

beforeEach(() => vi.clearAllMocks());

describe('buildOrMergeMaster — tolerant JSON parse', () => {
  test('rescues a valid master wrapped in a lite-model preamble and trailing note', async () => {
    // "led checkout redesign" is a real substring of the source, so the verify
    // pass's verbatim guard keeps it — proving we got the real parsed object back.
    const masterJson = '{"candidate_core":"PM","voice_samples":["led checkout redesign"]}';
    mockAxiosPost
      .mockResolvedValueOnce(
        geminiResp('Sure! Here is the JSON you asked for:\n' + masterJson + '\nLet me know if you need changes.')
      )
      .mockResolvedValueOnce(geminiResp('{}')); // verify pass: no corrections

    const { output } = await buildOrMergeMaster('Jane Roe led checkout redesign at Acme');

    expect(output).toEqual({ candidate_core: 'PM', voice_samples: ['led checkout redesign'] });
  });

  test('still throws when the build output has no JSON at all', async () => {
    mockAxiosPost.mockResolvedValueOnce(geminiResp('I cannot help with that.'));

    await expect(buildOrMergeMaster('some cv text')).rejects.toThrow(/invalid JSON/i);
  });
});
