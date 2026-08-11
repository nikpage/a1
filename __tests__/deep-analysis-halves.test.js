// __tests__/deep-analysis-halves.test.js
//
// The deep pass is two independent calls: 'blueprint' (what the generators
// execute) and 'review' (what the user reads). Under Promise.all, one failing
// call threw away the other's finished, already-paid-for output and the caller
// fell all the way back to the teaser — which is how a live analysis lost its
// assessment, red flags, quick wins and action items while the blueprint had
// succeeded. Only axios, the external boundary, is stubbed here.

vi.hoisted(() => {
  process.env.GEMINI_API_KEYS = 'key1';
  Math.random = () => 0;
});

import { describe, test, expect, vi, beforeEach } from 'vitest';

const mockAxiosPost = vi.hoisted(() => vi.fn());
vi.mock('axios', () => ({ default: { post: mockAxiosPost } }));

import { analyzeCvJob } from '../utils/openai.js';

const TEASER = {
  cv_data: { Name: 'John Doe' },
  analysis: { overall_score: '6', career_arc: 'Engineer growing into backend depth.' },
};

const BLUEPRINT = {
  generation_framework: { cv_blueprint: { section_order: ['Summary'], summary_draft: 'Backend engineer.' } },
};
const REVIEW = {
  analysis: { red_flags: ['10-month gap 2022'] },
  action_items: { cv: { critical: ['Date the earlier roles.'] } },
};

// The realistic failure is output truncated at the token cap: a 200 response
// whose content is JSON that stops mid-object. Rejecting outright would instead
// exercise callGemini's transient-retry backoff, which is not what is under test.
function truncated() {
  return {
    data: {
      choices: [{ message: { content: '{"analysis": {"red_flags": ["gap 2022"' } }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      model: 'gemini-2.5-flash',
    },
  };
}

// The prompt builder marks which half it is asking for, so the stub can answer
// each call with its own payload rather than one shared blob.
function reply(obj) {
  return {
    data: {
      choices: [{ message: { content: JSON.stringify(obj) } }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      model: 'gemini-2.5-flash',
    },
  };
}

// The two halves announce themselves in their own prompt text; the blueprint
// call is the one that says it produces the rewrite blueprint.
function isBlueprintCall(body) {
  return JSON.stringify(body).includes('REWRITE BLUEPRINT');
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('deep analysis — one half failing', () => {
  test('review returns truncated JSON → blueprint still reaches the caller', async () => {
    mockAxiosPost.mockImplementation(async (_url, body) =>
      isBlueprintCall(body) ? reply(BLUEPRINT) : truncated()
    );

    const res = await analyzeCvJob('cv text', 'job text that is comfortably long enough', 'cv.pdf', TEASER);
    const out = JSON.parse(res.output);

    expect(out.generation_framework.cv_blueprint.summary_draft).toBe('Backend engineer.');
    // The teaser's own fields still ride through the merge.
    expect(out.analysis.career_arc).toBe('Engineer growing into backend depth.');
    // Only the call that completed is cost-logged.
    expect(res.gemini_usages).toHaveLength(1);
  });

  test('blueprint returns truncated JSON → review still reaches the caller', async () => {
    mockAxiosPost.mockImplementation(async (_url, body) =>
      isBlueprintCall(body) ? truncated() : reply(REVIEW)
    );

    const res = await analyzeCvJob('cv text', 'job text that is comfortably long enough', 'cv.pdf', TEASER);
    const out = JSON.parse(res.output);

    expect(out.action_items.cv.critical).toEqual(['Date the earlier roles.']);
    expect(res.gemini_usages).toHaveLength(1);
  });

  test('both halves fail → throws, so the caller keeps the teaser', async () => {
    mockAxiosPost.mockImplementation(async () => truncated());

    await expect(
      analyzeCvJob('cv text', 'job text that is comfortably long enough', 'cv.pdf', TEASER)
    ).rejects.toThrow();
  });

  test('both halves succeed → both are merged and both are cost-logged', async () => {
    mockAxiosPost.mockImplementation(async (_url, body) =>
      reply(isBlueprintCall(body) ? BLUEPRINT : REVIEW)
    );

    const res = await analyzeCvJob('cv text', 'job text that is comfortably long enough', 'cv.pdf', TEASER);
    const out = JSON.parse(res.output);

    expect(out.generation_framework.cv_blueprint.summary_draft).toBe('Backend engineer.');
    expect(out.action_items.cv.critical).toEqual(['Date the earlier roles.']);
    expect(res.gemini_usages).toHaveLength(2);
  });
});
