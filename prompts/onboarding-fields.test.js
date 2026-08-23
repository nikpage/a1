// prompts/onboarding-fields.test.js
//
// Proves the onboarding answers (utils/master-flags.js: `clarification`,
// `merge_note`, `fractional_engagements[]`) actually reach and steer the AI prompts, instead
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
      fractional_engagements: [
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

// The clarification rule is GONE from the analysis prompt: the questions that
// produced a clarification (why a short role ended, what a gap was) were removed
// because no output ever read the answer. What survives is the nesting rule.
describe('buildAnalysisPrompt — nested engagements are not job-hopping', () => {
  test('delta (teaser-fed) pass states the nesting rule and carries no clarification rule', () => {
    const p = buildAnalysisPrompt(MASTER_JSON, SAMPLE_JOB, true, TEASER)
      .find((m) => m.role === 'system').content;
    expect(p).toMatch(/work_experience\[\]\.fractional_engagements\[\]/);
    expect(p).toMatch(/never count the nested children as job-hopping/i);
    expect(p).not.toMatch(/CANDIDATE'S OWN ANSWER/);
    expect(p).not.toMatch(/carries a clarification/i);
  });

  test('standalone (no-teaser) path carries the same governing instruction (system message is shared)', () => {
    const p = buildAnalysisPrompt(MASTER_JSON, SAMPLE_JOB, true, null)
      .find((m) => m.role === 'system').content;
    expect(p).toMatch(/work_experience\[\]\.fractional_engagements\[\]/);
  });

  test('never-fabricate rule still binds (regression guard)', () => {
    const p = buildAnalysisPrompt(MASTER_JSON, SAMPLE_JOB, true, TEASER)
      .find((m) => m.role === 'system').content;
    expect(p).toMatch(/never a licence to invent one/i);
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
    expect(delta).toMatch(/150-250/);

    const standalone = buildAnalysisPrompt(MASTER_JSON, SAMPLE_JOB, true, null)
      .find((m) => m.role === 'user').content;
    expect(standalone).toContain('"target_cover_words"');
    expect(standalone).toMatch(/generation_framework\.target_cover_words/);
  });
});

describe('buildCvPrompt — fractional engagements render nested', () => {
  const analysis = {
    analysis: { scenario_tags: [], red_flags: ['8-month gap 2021'], ats_keywords_present: '', ats_keywords_missing: '' },
    job_match: { positioning_strategy: '' },
    generation_framework: { cv_blueprint: {} },
  };

  // The clarification rule is gone with the questions that fed it: nothing
  // writes a `clarification` onto the record any more.
  test('carries no clarification rule', () => {
    const p = buildCvPrompt(MASTER_JSON, analysis, 'professional').find((m) => m.role === 'user').content;
    expect(p).not.toMatch(/NEVER print the clarification/);
    expect(p).not.toMatch(/Clarifications steer selection/);
  });

  test('instructs a merged parent to render as one role with engagements nested beneath, not separate top-level jobs', () => {
    const p = buildCvPrompt(MASTER_JSON, analysis, 'professional').find((m) => m.role === 'user').content;
    expect(p).toMatch(/renders as ONE top-level role/);
    expect(p).toMatch(/NEVER separate top-level jobs/);
  });

  // 2026-08-23, Invity CV: "engagements appear beneath that single role"
  // specified no SHAPE, so six real engagements — SpecialAgents, Salsita,
  // wflow.com, Blockchain4Humanity, Aerum, BLOCKS, each with its own title in
  // the record — were dissolved into the umbrella's prose bullets. Ten years
  // read as one self-employed blob and the crypto advisory was invisible on a
  // CV written for a Bitcoin company.
  test('a nested engagement keeps its own employer, title and dates, in a stated shape', () => {
    const p = buildCvPrompt(MASTER_JSON, analysis, 'professional').find((m) => m.role === 'user').content;
    expect(p).toMatch(/A nested engagement still keeps its own employer, title and dates/);
    expect(p).toMatch(/Never dissolve an engagement into the parent's own bullets/);
    expect(p).toMatch(/never relabel a real employer as an unnamed "client"/);
    // The template must show the shape, not just describe it.
    expect(p).toMatch(/#####\s+\*\*\[Engagement Title[^\]]*\]\*\*\s*·\s*\[Client Name\]/);
  });

  test('engagements are chosen by what the job asks for, and dropping is not hiding', () => {
    const p = buildCvPrompt(MASTER_JSON, analysis, 'professional').find((m) => m.role === 'user').content;
    expect(p).toMatch(/an engagement that answers the ad earns its sub-entry even if it is old/);
    expect(p).toMatch(/Dropping is selection; hiding a real employer inside prose is not/);
  });

  test('the work_experience[] source-of-truth rule names the real nested key', () => {
    const p = buildCvPrompt(MASTER_JSON, analysis, 'professional').find((m) => m.role === 'user').content;
    expect(p).toMatch(/definitive source for all employment[\s\S]*fractional_engagements\[\]/);
  });

  test('existing "red flags handled, not advertised" rule is still present (guard against accidental deletion)', () => {
    const p = buildCvPrompt(MASTER_JSON, analysis, 'professional').find((m) => m.role === 'user').content;
    expect(p).toContain('Red flags are handled, not advertised');
  });
});

describe('buildCoverPrompt — length budget enforced', () => {
  const analysisWithTarget = {
    analysis: { red_flags: ['8-month gap 2021'] },
    job_match: {},
    generation_framework: { target_cover_words: '180' },
  };
  const analysisNoTarget = {
    analysis: { red_flags: [] },
    job_match: {},
    generation_framework: {},
  };

  // The clarification rule is gone from the prompt: a `clarification` in the
  // record is text the CANDIDATE wrote about their own gap, and it reaches the
  // writer as part of the record itself. Telling the writer how to spend it was
  // part of the rule stack that lost (2026-08-15).
  it('states the length budget and the letter furniture, without a clarification rule', () => {
    const [, user] = buildCoverPrompt(MASTER_JSON, analysisWithTarget, 'Formal');
    expect(user.content).toMatch(/LENGTH \(hard constraint\)/);
    expect(user.content).toMatch(/Open with a professional header/);
    expect(user.content).not.toMatch(/One clause, once, carrying a fact/);
  });

  test('states the 150-250 word hard budget and that it excludes date/salutation/signature', () => {
    const p = buildCoverPrompt(MASTER_JSON, analysisNoTarget, 'professional').find((m) => m.role === 'user').content;
    expect(p).toMatch(/150-250 words/);
    expect(p).toMatch(/does NOT include the date, salutation, or signature block/);
  });

  test('honours generation_framework.target_cover_words when present', () => {
    const p = buildCoverPrompt(MASTER_JSON, analysisWithTarget, 'professional').find((m) => m.role === 'user').content;
    // Stated as a NUMBER, not as a field to go and look up: the letter's brief no
    // longer carries generation_framework, so a pointer to it would point at
    // nothing (prompts/analysis-brief.js, coverBrief).
    expect(p).toContain('Aim for about 180 words');
    expect(p).not.toMatch(/Use `generation_framework\.target_cover_words`/);
  });

  test('a target outside the market band is ignored in favour of the band', () => {
    const wild = { ...analysisWithTarget, generation_framework: { target_cover_words: '900' } };
    const p = buildCoverPrompt(MASTER_JSON, wild, 'professional').find((m) => m.role === 'user').content;
    expect(p).not.toContain('Aim for about 900 words');
    expect(p).toMatch(/Aim for about \d{3} words/);
  });

  // The analysis no longer reaches the letter at all (2026-08-15), red_flags
  // included. The guard is now the reverse: nothing from the analysis object
  // may leak into the writer's context except the ad and the word band.
  test('no analysis guidance reaches the letter — the guard is now the reverse', () => {
    const p = buildCoverPrompt(MASTER_JSON, analysisWithTarget, 'professional').find((m) => m.role === 'user').content;
    expect(p).not.toContain('analysis.red_flags');
    expect(p).toMatch(/Aim for about \d{3} words/);
  });
});
