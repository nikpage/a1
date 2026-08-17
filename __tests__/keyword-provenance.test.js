// __tests__/keyword-provenance.test.js
//
// `analysis.ats_keywords_present` is the one list that is BOTH safe to put on
// the CV (it feeds skills_to_highlight) and, by being "present", excluded from
// the deny-list checks 24/26 enforce. Nothing checked it. On the KUBO run
// (2026-08-16) "B2B", "Account Management" and "onboarding" reached Skills and
// the headline over a record evidencing none of them.
//
// The model now quotes the record for each term and the quote is checked
// deterministically. These tests are red on the old code, which had no
// proof field and no check.

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
});

import { describe, test, expect, vi } from 'vitest';
import { splitProvenKeywords } from '../utils/cv-validate.js';
import { buildAnalysisPrompt } from '../prompts/analysis.js';

vi.mock('../utils/key-manager.js', () => ({
  KeyManager: class { constructor() { this.keys = ['k']; } getNextKey() { return 'k'; } },
}));

const MASTER = JSON.stringify({
  identity: { name: 'Jana Nováková', country: 'Czechia' },
  experience: [
    {
      company: 'Acme s.r.o.',
      role: 'Account Manager',
      dates: '01/2019 - 08/2024',
      achievements: [{ text: 'Managed a team of eight and reduced churn by 30%.' }],
    },
  ],
});

describe('a "present" keyword must be proven by the record', () => {
  test('an unproven proof quote drops the term; a proven one is untouched', () => {
    const { proven, unproven } = splitProvenKeywords([
      { term: 'people management', proof: 'Managed a team of eight' },
      { term: 'B2B', proof: 'ran the B2B sales pipeline for enterprise clients' },
    ], MASTER);

    expect(proven.map((e) => e.term)).toEqual(['people management']);
    expect(unproven).toEqual(['B2B']);
  });

  test('inflection and word form do not cause a false drop', () => {
    const { proven, unproven } = splitProvenKeywords(
      [{ term: 'account management', proof: 'Account Manager' }],
      MASTER,
    );
    expect(unproven).toEqual([]);
    expect(proven).toHaveLength(1);
  });

  test('a term with no proof at all is dropped — there is nothing to check', () => {
    const { proven, unproven } = splitProvenKeywords(
      [{ term: 'onboarding' }, 'retention'],
      MASTER,
    );
    expect(proven).toEqual([]);
    expect(unproven).toEqual(['onboarding', 'retention']);
  });

  test('no record is no evidence: nothing is judged', () => {
    const present = [{ term: 'B2B', proof: 'nowhere' }];
    expect(splitProvenKeywords(present, '')).toEqual({ proven: present, unproven: [] });
  });
});

describe('the prompt asks for the proof, and the analysis prunes on it', () => {
  test('the schema carries term + proof', () => {
    const p = buildAnalysisPrompt(MASTER, 'Account Manager, B2B sales.', true).map((m) => m.content).join('\n');
    expect(p).toContain('"ats_keywords_present": [{ "term": "", "proof": "" }]');
    expect(p).toMatch(/copy it VERBATIM from the record/);
  });

  test('analyzeCvJob moves an unproven term into ats_keywords_missing', async () => {
    vi.doMock('axios', () => ({
      default: {
        post: vi.fn(async () => ({
          data: {
            model: 'gemini-3.5-flash',
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
            choices: [{ message: { content: JSON.stringify({
              analysis: {
                ats_keywords_present: [
                  { term: 'people management', proof: 'Managed a team of eight' },
                  { term: 'B2B', proof: 'ran the B2B sales pipeline' },
                ],
                ats_keywords_missing: ['CRM'],
              },
            }) } }],
          },
        })),
      },
    }));
    vi.resetModules();
    const { analyzeCvJob } = await import('../utils/openai.js');
    const { runWithAiContext } = await import('../utils/ai-meter.js');

    const res = await runWithAiContext({ context: 'test' }, () =>
      analyzeCvJob(MASTER, 'Account Manager, B2B sales, CRM required.', 'cv.pdf'));
    const out = JSON.parse(res.output).analysis;

    expect(out.ats_keywords_present.map((e) => e.term)).toEqual(['people management']);
    // Now on the deny-list checks 24/26 read.
    expect(out.ats_keywords_missing).toEqual(['CRM', 'B2B']);
    vi.doUnmock('axios');
  });

  test('with no job ad the dropped term is not turned into a gap', async () => {
    vi.doMock('axios', () => ({
      default: {
        post: vi.fn(async () => ({
          data: {
            model: 'gemini-3.5-flash',
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
            choices: [{ message: { content: JSON.stringify({
              analysis: {
                ats_keywords_present: [{ term: 'B2B', proof: 'ran the B2B sales pipeline' }],
                ats_keywords_missing: [],
              },
            }) } }],
          },
        })),
      },
    }));
    vi.resetModules();
    const { analyzeCvJob } = await import('../utils/openai.js');
    const { runWithAiContext } = await import('../utils/ai-meter.js');

    const res = await runWithAiContext({ context: 'test' }, () => analyzeCvJob(MASTER, '', 'cv.pdf'));
    const out = JSON.parse(res.output).analysis;

    expect(out.ats_keywords_present).toEqual([]);
    expect(out.ats_keywords_missing).toEqual([]);
    vi.doUnmock('axios');
  });
});
