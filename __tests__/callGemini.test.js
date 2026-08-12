// __tests__/callGemini.test.js — tests for 2.3: shared callGemini helper with 429 rotation
// Tested through generateCV (simplest public interface that delegates to callGemini).

vi.hoisted(() => {
  process.env.GEMINI_API_KEYS = 'key1,key2';
  // Force KeyManager to start at index 0 for deterministic ordering
  Math.random = () => 0;
});

import { describe, test, expect, vi, beforeEach } from 'vitest';

const mockAxiosPost = vi.hoisted(() => vi.fn());

vi.mock('axios', () => ({
  default: { post: mockAxiosPost },
}));

vi.mock('../prompts/cv-generator.js', () => ({
  buildCvPrompt: () => [{ role: 'user', content: 'build me a cv' }],
}));

vi.mock('../prompts/cover-letter.js', () => ({
  buildCoverPrompt: () => [{ role: 'user', content: 'build me a cover letter' }],
}));

vi.mock('../prompts/analysis.js', () => ({
  buildAnalysisPrompt: () => [{ role: 'user', content: 'analyse this' }],
}));

import { generateCV } from '../utils/openai.js';

const SUCCESS_RESPONSE = {
  data: {
    choices: [{ message: { content: 'Great CV content' } }],
    usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
    model: 'gemini-3.5-flash',
  },
};

function make429Error() {
  const err = new Error('Rate limited');
  err.response = { status: 429, data: { message: 'Rate limit exceeded' } };
  return err;
}

function make500Error() {
  const err = new Error('Internal server error');
  err.response = { status: 500, data: { message: 'Server error' } };
  return err;
}

// generateCV makes TWO Gemini calls: the writing call, then the verify pass
// that strips claims the master doesn't support. Key rotation is what these
// tests are about, so they count the WRITING calls only — the verify call runs
// on its own model and must not be mistaken for a retry.
const writingCalls = () =>
  mockAxiosPost.mock.calls.filter(([, body]) => body?.model === 'gemini-2.5-flash').length;

// A clean verify verdict: nothing unsupported, document passes through as-is.
const CLEAN_VERIFY_RESPONSE = {
  data: {
    choices: [{ message: { content: '{"unsupported":[]}' } }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    model: 'gemini-2.5-flash-lite',
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('2.3 — callGemini 429 key rotation', () => {
  test('happy path: first key succeeds → result returned without error', async () => {
    mockAxiosPost
      .mockResolvedValueOnce(SUCCESS_RESPONSE)
      .mockResolvedValueOnce(CLEAN_VERIFY_RESPONSE);

    const result = await generateCV({ cv: 'cv text', analysis: {}, tone: 'Formal' });

    expect(result.content).toBe('Great CV content');
    expect(writingCalls()).toBe(1);
  });

  test('first key returns 429, second key succeeds → result returned', async () => {
    mockAxiosPost
      .mockRejectedValueOnce(make429Error())
      .mockResolvedValueOnce(SUCCESS_RESPONSE)
      .mockResolvedValueOnce(CLEAN_VERIFY_RESPONSE);

    const result = await generateCV({ cv: 'cv text', analysis: {}, tone: 'Formal' });

    expect(result.content).toBe('Great CV content');
    // the 429'd attempt plus the successful one, both on the writing model
    expect(writingCalls()).toBe(2);
  });

  test('both keys return 429 → error thrown with .isRateLimit === true', async () => {
    mockAxiosPost.mockRejectedValue(make429Error());

    await expect(
      generateCV({ cv: 'cv text', analysis: {}, tone: 'Formal' })
    ).rejects.toMatchObject({ isRateLimit: true });

    // callGemini makes up to 6 attempts (max(keys, 6)) so a transient overload
    // is ridden out; a 429 rotates the key with no backoff.
    expect(mockAxiosPost).toHaveBeenCalledTimes(6);
  });

  // 500 is a TRANSIENT status: it is retried with backoff rather than thrown at
  // once. One 500 then a success must produce a normal result.
  test('a transient 500 is retried, not thrown immediately', async () => {
    mockAxiosPost
      .mockRejectedValueOnce(make500Error())
      .mockResolvedValueOnce(SUCCESS_RESPONSE)
      .mockResolvedValueOnce(CLEAN_VERIFY_RESPONSE);

    const result = await generateCV({ cv: 'cv text', analysis: {}, tone: 'Formal' });

    expect(result.content).toBe('Great CV content');
    expect(writingCalls()).toBe(2);
  });

  // A genuinely non-retryable status (400) is surfaced on the first attempt,
  // with Gemini's own reason rather than the opaque axios message.
  test('a non-transient error (400) is thrown at once with Gemini\'s reason', async () => {
    const err = new Error('Request failed with status code 400');
    err.response = { status: 400, data: { error: { message: 'Bad request: bad model' } } };
    mockAxiosPost.mockRejectedValue(err);

    await expect(
      generateCV({ cv: 'cv text', analysis: {}, tone: 'Formal' })
    ).rejects.toMatchObject({ status: 400, message: 'Gemini 400 Bad request: bad model' });

    expect(writingCalls()).toBe(1);
  });
});
