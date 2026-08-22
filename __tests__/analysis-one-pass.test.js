// __tests__/analysis-one-pass.test.js
//
// The analysis is ONE call that selects and frames (prompts/analysis.js).
//
// It used to be three: a landing-page teaser reading the raw uploaded PDF for
// first impressions, then a 'blueprint' delta and a 'review' delta built on it.
// The review half critiqued a document the app regenerates from the master
// record on every run — "your CV is too long", "move this above the fold" — so
// nobody could act on it, and the teaser served visitors who no longer exist.
//
// These tests are red on the old code: it made two analysis calls per run and
// emitted quick_wins / action_items / jobs_extracted.

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
});

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { buildAnalysisPrompt } from '../prompts/analysis.js';

const mockCallGemini = vi.hoisted(() => vi.fn());
vi.mock('../utils/key-manager.js', () => ({
  KeyManager: class { constructor() { this.keys = ['k']; } getNextKey() { return 'k'; } },
}));

const CV = JSON.stringify({
  identity: { name: 'Jane Doe', country: 'Germany' },
  experience: [{ company: 'Acme', role: 'Head of Ops', dates: '01/2019 - 08/2024' }],
});
const JOB = 'Operations Director, Contoso, Munich. Requires SAP and lean manufacturing.';

const userOf = (msgs) => msgs.find((m) => m.role === 'user').content;
const allOf = (msgs) => msgs.map((m) => m.content).join('\n');

describe('the analysis prompt selects and frames', () => {
  test('emits ONE schema — no teaser, no mode, no second half', () => {
    const p = userOf(buildAnalysisPrompt(CV, JOB, true));
    // Everything the generators and the validator consume is in this one shape.
    for (const field of [
      '"cv_data"', '"job_data"', '"scenario_tags"', '"red_flags"',
      '"career_arc"', '"parallel_experience"', '"transferable_skills"',
      '"ats_keywords_present"', '"ats_keywords_missing"',
      '"positioning_strategy"', '"cv_blueprint"', '"section_order"',
      '"headline_draft"', '"summary_draft"', '"top_three_achievements"',
      '"skills_to_highlight"', '"target_cover_words"', '"job_extraction"',
    ]) {
      expect(p, `${field} missing from the one-pass schema`).toContain(field);
    }
  });

  test('asks for nothing that critiques an existing document', () => {
    const p = allOf(buildAnalysisPrompt(CV, JOB, true));
    expect(p).not.toContain('quick_wins');
    expect(p).not.toContain('action_items');
    expect(p).not.toContain('jobs_extracted');
    // The teaser's first-impression block is gone with it.
    expect(p).not.toContain('hr_first_seconds');
    expect(p).not.toContain('scan_verdict');
    expect(p).not.toContain('ats_snags');
  });

  test('states that selection, not review, is the job — and names what drives it', () => {
    const p = allOf(buildAnalysisPrompt(CV, JOB, true));
    expect(p).toMatch(/SELECTION and FRAMING, not review/);
    expect(p).toMatch(/Relevance beats recency/);
    expect(p).toMatch(/REGISTER the ad is written in/);
    // Dropping real work is a legitimate outcome now that a record, not a
    // document, is the source.
    expect(p).toMatch(/earlier_career/);
    expect(p).toMatch(/Dropping real work is selection, not falsification/);
  });

  test('the scenario is the first decision and still governs the framing', () => {
    const p = userOf(buildAnalysisPrompt(CV, JOB, true));
    expect(p).toContain('STRICT SCENARIO LIST');
    expect(p).toContain('SCENARIO HANDLING');
    expect(p).toMatch(/This is the FIRST decision/);
  });

  test('with no job ad every job-relative field stays neutral', () => {
    const p = userOf(buildAnalysisPrompt(CV, '', false));
    expect(p).toContain('NO JOB AD PROVIDED');
    expect(p).toMatch(/ats_keywords_missing MUST be an empty array/);
    expect(p).not.toContain('"job_extraction"');
  });

  test('the invariant survives the rewrite: reframe, never add', () => {
    const p = allOf(buildAnalysisPrompt(CV, JOB, true));
    expect(p).toContain('REFRAME vs ADD');
    expect(p).toMatch(/never INSERT experience it does not/);
    expect(p).toContain('NESTED ENGAGEMENTS');
  });
});

describe('analyzeCvJob makes exactly one call', () => {
  beforeEach(() => { mockCallGemini.mockReset(); });

  test('one Gemini call, and the ad rides out on the record for the letter', async () => {
    // The real callGemini runs; only the outside world (the HTTP transport) is
    // stubbed, so this counts ACTUAL dispatches to Gemini.
    vi.doMock('axios', () => ({
      default: {
        post: vi.fn(async () => ({
          data: {
            model: 'gemini-3.5-flash',
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
            choices: [{ message: { content: JSON.stringify({ analysis: { scenario_tags: ['Standard Career Progression'] } }) } }],
          },
        })),
      },
    }));
    vi.resetModules();
    const axios = (await import('axios')).default;
    const { analyzeCvJob } = await import('../utils/openai.js');
    const { runWithAiContext } = await import('../utils/ai-meter.js');

    const res = await runWithAiContext({ context: 'test' }, () => analyzeCvJob(CV, JOB, 'cv.pdf'));

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(res.gemini_usages).toHaveLength(1);
    // The employer's own words reach the letter from here, not from the worker.
    expect(JSON.parse(res.output).job_text).toBe(JOB);
    vi.doUnmock('axios');
  });
});
