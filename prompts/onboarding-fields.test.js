// prompts/onboarding-fields.test.js
//
// Proves the onboarding answers (utils/master-flags.js: `clarification`,
// `merge_note`, `contracts[]`) actually reach and steer the AI prompts, instead
// of sitting inert inside JSON.stringify(master) with no instruction attached.

import { describe, test, expect } from 'vitest';
import { buildAnalysisPrompt } from './analysis.js';
import { buildCvPrompt } from './cv-generator.js';
import { buildCoverPrompt } from './cover-letter.js';

const MASTER_JSON = JSON.stringify({
  identity: { name: 'Jane Doe', country: 'Germany' },
  experience: [
    {
      company: 'Acme Corp',
      role: 'Product Manager',
      dates: '2022 - Present',
      location: 'Berlin, Germany',
      clarification: 'Took 8 months off in 2021 to care for a family member.',
    },
    {
      company: 'Consulting Group',
      role: 'Independent Consultant',
      dates: '2018 - 2021',
      location: 'Remote',
      merge_note: 'Both engagements delivered concurrently under this consultancy.',
      contracts: [
        { company: 'Client A', role: 'Interim PM', dates: '2019 - 2020' },
        { company: 'Client B', role: 'Interim PM', dates: '2020 - 2021' },
      ],
    },
  ],
});

const SAMPLE_JOB = 'Senior Product Manager: 5+ years, Berlin.';

const TEASER = {
  cv_data: { Name: 'Jane Doe', Seniority: 'Senior', Industry: 'Product', Country: 'Germany' },
  analysis: { overall_score: '7', ats_score: '6', red_flags: [] },
  job_match: { positioning_strategy: 'Lead with the consultancy scope.' },
  final_thought: 'Score 7.',
};

describe('buildAnalysisPrompt — clarifications are candidate-authoritative', () => {
  test('delta (teaser-fed) pass instructs the model to treat clarification/merge_note as authoritative and not re-flag explained gaps', () => {
    const p = buildAnalysisPrompt(MASTER_JSON, SAMPLE_JOB, true, TEASER)
      .find((m) => m.role === 'system').content;
    expect(p).toMatch(/clarification/);
    expect(p).toMatch(/merge_note/);
    expect(p).toMatch(/CANDIDATE'S OWN ANSWER/);
    expect(p).toMatch(/do NOT report it as an open red flag/i);
    expect(p).toMatch(/contracts\[\]/);
    expect(p).toMatch(/never count the nested children as job-hopping/i);
  });

  test('standalone (no-teaser) path carries the same governing instruction (system message is shared)', () => {
    const p = buildAnalysisPrompt(MASTER_JSON, SAMPLE_JOB, true, null)
      .find((m) => m.role === 'system').content;
    expect(p).toMatch(/clarification/);
    expect(p).toMatch(/contracts\[\]/);
  });

  test('never-fabricate rule still binds for clarifications (regression guard)', () => {
    const p = buildAnalysisPrompt(MASTER_JSON, SAMPLE_JOB, true, TEASER)
      .find((m) => m.role === 'system').content;
    expect(p).toMatch(/never licenses inventing a new one/i);
  });

  test('existing REFRAME vs ADD rule is still present (guard against accidental deletion)', () => {
    const p = buildAnalysisPrompt(MASTER_JSON, SAMPLE_JOB, true, TEASER)
      .find((m) => m.role === 'system').content;
    expect(p).toContain('REFRAME vs ADD');
    expect(p).toContain('never INSERT experience it does not');
  });

  test('generation_framework blueprint emits target_cover_words in both delta and standalone JSON skeletons', () => {
    const delta = buildAnalysisPrompt(MASTER_JSON, SAMPLE_JOB, true, TEASER)
      .find((m) => m.role === 'user').content;
    expect(delta).toContain('"target_cover_words"');
    expect(delta).toMatch(/generation_framework\.target_cover_words/);
    expect(delta).toMatch(/250-350/);

    const standalone = buildAnalysisPrompt(MASTER_JSON, SAMPLE_JOB, true, null)
      .find((m) => m.role === 'user').content;
    expect(standalone).toContain('"target_cover_words"');
    expect(standalone).toMatch(/generation_framework\.target_cover_words/);
  });
});

describe('buildCvPrompt — clarifications steer selection/framing, never print; contracts render nested', () => {
  const analysis = {
    analysis: { scenario_tags: [], red_flags: ['8-month gap 2021'], ats_keywords_present: '', ats_keywords_missing: '' },
    job_match: { positioning_strategy: '' },
    generation_framework: { cv_blueprint: {} },
  };

  test('instructs the writer to use clarification/merge_note for selection only, never to print them', () => {
    const p = buildCvPrompt(MASTER_JSON, analysis, 'professional').find((m) => m.role === 'user').content;
    expect(p).toMatch(/clarification/);
    expect(p).toMatch(/merge_note/);
    expect(p).toMatch(/NEVER print the clarification or merge_note text itself/);
  });

  test('instructs a merged parent to render as one role with contracts nested beneath, not separate top-level jobs', () => {
    const p = buildCvPrompt(MASTER_JSON, analysis, 'professional').find((m) => m.role === 'user').content;
    expect(p).toMatch(/renders? as ONE role/);
    expect(p).toMatch(/never as separate top-level jobs/);
  });

  test('the experience[] source-of-truth rule now explicitly covers contracts[]', () => {
    const p = buildCvPrompt(MASTER_JSON, analysis, 'professional').find((m) => m.role === 'user').content;
    expect(p).toMatch(/definitive source for all employment[\s\S]*contracts\[\]/);
  });

  test('existing "red flags handled, not advertised" rule is still present (guard against accidental deletion)', () => {
    const p = buildCvPrompt(MASTER_JSON, analysis, 'professional').find((m) => m.role === 'user').content;
    expect(p).toContain('Red flags are handled, not advertised');
  });
});

describe('buildCoverPrompt — clarifications defuse in one clause; length budget enforced', () => {
  const analysisWithTarget = {
    analysis: { red_flags: ['8-month gap 2021'] },
    job_match: {},
    generation_framework: { target_cover_words: '260' },
  };
  const analysisNoTarget = {
    analysis: { red_flags: [] },
    job_match: {},
    generation_framework: {},
  };

  test('instructs the writer that a clarification may defuse a relevant gap in one brief clause, never a whole paragraph', () => {
    const p = buildCoverPrompt(MASTER_JSON, analysisWithTarget, 'professional').find((m) => m.role === 'user').content;
    expect(p).toMatch(/clarification/);
    // The "one clause, once" limit now lives in the Layer 4 red-flag rule
    // (prompts/cv-rules.js coverRedFlagRule), which the letter always carries;
    // the clarification rule below it supplies the candidate's own words.
    expect(p).toMatch(/One clause, once, carrying a fact/);
    expect(p).toMatch(/never the opening, never the close/);
    expect(p).toMatch(/Never invent a reason the clarification does not state/);
  });

  test('states the 250-350 word hard budget and that it excludes date/salutation/signature', () => {
    const p = buildCoverPrompt(MASTER_JSON, analysisNoTarget, 'professional').find((m) => m.role === 'user').content;
    expect(p).toMatch(/250-350 words/);
    expect(p).toMatch(/does NOT include the date, salutation, or signature block/);
  });

  test('honours generation_framework.target_cover_words when present', () => {
    const p = buildCoverPrompt(MASTER_JSON, analysisWithTarget, 'professional').find((m) => m.role === 'user').content;
    expect(p).toMatch(/generation_framework\.target_cover_words/);
    // the analysis object is also serialized into the prompt, so the value itself is present
    expect(p).toContain('"target_cover_words": "260"');
  });

  test('existing red_flags guidance is still present (guard against accidental deletion)', () => {
    const p = buildCoverPrompt(MASTER_JSON, analysisWithTarget, 'professional').find((m) => m.role === 'user').content;
    expect(p).toContain('analysis.red_flags');
  });
});
