// __tests__/master-build-retry.test.js
//
// Regression: a 200 response carrying malformed JSON used to throw straight out
// of buildOrMergeMaster, dropping the paid build to a null master_cv. The build
// must now retry the call on a parse failure so a one-off bad payload recovers.
// RED on old code (single attempt → throws); GREEN after the retry.

vi.hoisted(() => {
  process.env.GEMINI_API_KEYS = 'key1,key2';
  Math.random = () => 0;
});

import { describe, test, expect, vi, beforeEach } from 'vitest';

const mockAxiosPost = vi.hoisted(() => vi.fn());
vi.mock('axios', () => ({ default: { post: mockAxiosPost } }));

vi.mock('../prompts/master-cv.js', () => ({
  buildMasterCvPrompt: () => [{ role: 'user', content: 'build master' }],
  buildMasterVerifyPrompt: () => [{ role: 'user', content: 'verify master' }],
}));

import { buildOrMergeMaster } from '../utils/openai.js';

const resp = (content) => ({
  data: {
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
    model: 'gemini-2.5-flash-lite',
  },
});

const BAD = resp('Sorry, here is your master CV: (no json at all)');
const GOOD_MASTER = resp('{"candidate_core":"Nik Page","voice_samples":[]}');
const VERIFY_OK = resp('{}');

beforeEach(() => vi.clearAllMocks());

describe('buildOrMergeMaster — retry on malformed JSON', () => {
  test('one bad JSON payload, then a good one → build succeeds (old code threw)', async () => {
    mockAxiosPost
      .mockResolvedValueOnce(BAD)          // build attempt 1: unparseable
      .mockResolvedValueOnce(GOOD_MASTER)  // build attempt 2: valid
      .mockResolvedValue(VERIFY_OK);       // verify pass

    const result = await buildOrMergeMaster('Nik Page\nProduct Leader');

    expect(result.output.candidate_core).toBe('Nik Page');
    // 2 build attempts + at least the verify call
    expect(mockAxiosPost.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  test('every build payload malformed → throws after exhausting retries', async () => {
    mockAxiosPost.mockResolvedValue(BAD);

    await expect(buildOrMergeMaster('Nik Page')).rejects.toThrow(/invalid JSON/i);
    // exactly the 3 build attempts, then it gives up before verify
    expect(mockAxiosPost).toHaveBeenCalledTimes(3);
  });

  test('every paid attempt is surfaced in usages for cost logging', async () => {
    mockAxiosPost
      .mockResolvedValueOnce(BAD)
      .mockResolvedValueOnce(GOOD_MASTER)
      .mockResolvedValue(VERIFY_OK);

    const result = await buildOrMergeMaster('Nik Page');

    // both build calls (the failed one + the good one) must be logged, not just the winner
    expect(result.usages.length).toBeGreaterThanOrEqual(2);
  });
});
