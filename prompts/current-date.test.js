// prompts/current-date.test.js
//
// Proves the real current date actually reaches every time-reasoning prompt.
// Without it the model anchors "now" to its training cutoff and reads real past
// dates as future. The clock is INJECTED here — never the ambient one — so the
// assertions pin an exact string and are capable of failing.

import { describe, test, expect } from 'vitest';
import { currentDateBlock, currentDateReminder, formatLongDate } from './current-date.js';
import { buildAnalysisTeaserPrompt } from './analysis-teaser.js';
import { buildAnalysisPrompt } from './analysis.js';
import { buildMasterCvPrompt } from './master-cv.js';
import { buildCvPrompt } from './cv-generator.js';
import { buildCoverPrompt } from './cover-letter.js';

// Local-time constructor: the helper reads local calendar fields, so this is
// 5 March 2024 regardless of the machine's timezone.
//
// The injected clock is deliberately NOT the real today. Pinning it to the real
// current date would let every wiring assertion pass even if the `now` parameter
// were ignored entirely and the default clock used — a test incapable of failing.
const FIXED = new Date(2024, 2, 5, 12, 0, 0);
const TODAY = '5 March 2024';

const CV_TEXT = 'Jane Doe — Product Manager, Acme Corp, Jan 2022 - Jan 2026, Berlin, Germany.';
const JOB_TEXT = 'Senior Product Manager: 5+ years, Berlin.';
const MASTER = {
  identity: { name: 'Jane Doe', country: 'Germany' },
  experience: [
    { company: 'Acme Corp', role: 'Product Manager', dates: 'Jan 2022 - Jan 2026', location: 'Berlin, Germany' },
  ],
};
const MASTER_JSON = JSON.stringify(MASTER);
const TEASER = {
  cv_data: { Name: 'Jane Doe', Seniority: 'Senior', Industry: 'Product', Country: 'Germany' },
  analysis: { scenario_tags: [], scan_verdict: 'pass', red_flags: [] },
  job_match: { positioning_strategy: 'Lead with the Acme scope.' },
};
const ANALYSIS = {
  analysis: { scenario_tags: [], red_flags: [], ats_keywords_present: '', ats_keywords_missing: '' },
  job_match: { positioning_strategy: '' },
  generation_framework: { cv_blueprint: {} },
};

const joined = (msgs) => msgs.map((m) => m.content).join('\n');

describe('currentDateBlock / formatLongDate', () => {
  test('renders the injected date in unambiguous long form', () => {
    expect(formatLongDate(FIXED)).toBe(TODAY);
    expect(formatLongDate(new Date(2026, 0, 1))).toBe('1 January 2026');
    expect(formatLongDate(new Date(2025, 11, 31))).toBe('31 December 2025');
  });

  test('states today and binds recency/gap/tenure/current judgments to it', () => {
    const b = currentDateBlock(FIXED);
    expect(b).toContain(`TODAY'S DATE IS ${TODAY}`);
    expect(b).toMatch(/recency, gaps, tenure length/i);
    expect(b).toMatch(/current.*ongoing/i);
    expect(b).toMatch(/is in the PAST/);
    expect(b).toMatch(/never describe or flag it as future/i);
  });

  test('defaults to the real clock when no date is injected', () => {
    expect(currentDateBlock()).toContain(formatLongDate(new Date()));
  });

  test('a different injected date produces a different block (the clock is really used)', () => {
    expect(currentDateBlock(new Date(2024, 2, 5))).toContain('5 March 2024');
    expect(currentDateBlock(new Date(2026, 7, 10))).not.toContain(TODAY);
  });
});

describe('every time-reasoning prompt carries the injected current date', () => {
  test('teaser (with and without a job ad)', () => {
    expect(joined(buildAnalysisTeaserPrompt(CV_TEXT, JOB_TEXT, true, '', FIXED))).toContain(`TODAY'S DATE IS ${TODAY}`);
    expect(joined(buildAnalysisTeaserPrompt(CV_TEXT, '', false, '', FIXED))).toContain(`TODAY'S DATE IS ${TODAY}`);
  });

  test('deep analysis — teaser-fed delta (blueprint and review) and standalone paths', () => {
    const blueprint = buildAnalysisPrompt(MASTER_JSON, JOB_TEXT, true, TEASER, 'blueprint', FIXED);
    const review = buildAnalysisPrompt(MASTER_JSON, JOB_TEXT, true, TEASER, 'review', FIXED);
    const standalone = buildAnalysisPrompt(MASTER_JSON, JOB_TEXT, true, null, 'blueprint', FIXED);
    for (const msgs of [blueprint, review, standalone]) {
      expect(joined(msgs)).toContain(`TODAY'S DATE IS ${TODAY}`);
      expect(joined(msgs)).toMatch(/is in the PAST/);
    }
  });

  test('master CV build and merge prompts', () => {
    expect(joined(buildMasterCvPrompt({ rawInput: CV_TEXT, now: FIXED })))
      .toContain(`TODAY'S DATE IS ${TODAY}`);
    expect(joined(buildMasterCvPrompt({ rawInput: CV_TEXT, now: FIXED })))
      .toContain(`TODAY'S DATE IS ${TODAY}`);
  });



  test('CV generator', () => {
    expect(joined(buildCvPrompt(MASTER_JSON, ANALYSIS, 'professional', '', '', 'auto', FIXED)))
      .toContain(`TODAY'S DATE IS ${TODAY}`);
  });

  test('cover letter (it dates the letter and reasons about gaps)', () => {
    expect(joined(buildCoverPrompt(MASTER_JSON, ANALYSIS, 'professional', '', '', 'auto', FIXED)))
      .toContain(`TODAY'S DATE IS ${TODAY}`);
  });

  test('prompts fall back to the real clock when no date is passed (production call shape)', () => {
    const today = formatLongDate(new Date());
    expect(joined(buildAnalysisTeaserPrompt(CV_TEXT, '', false))).toContain(today);
    expect(joined(buildAnalysisPrompt(MASTER_JSON, '', false))).toContain(today);
    expect(joined(buildMasterCvPrompt({ rawInput: CV_TEXT }))).toContain(today);
    expect(joined(buildCvPrompt(MASTER_JSON, ANALYSIS, 'professional'))).toContain(today);
    expect(joined(buildCoverPrompt(MASTER_JSON, ANALYSIS, 'professional'))).toContain(today);
  });
});

// Guard: the date insertion must not have displaced any existing rule in the
// sacred prompt files (same pattern as onboarding-fields.test.js).
describe('existing key rules survive the date insertion (guard against accidental deletion)', () => {
  test('analysis.js keeps its governing rules and both output skeletons', () => {
    const delta = buildAnalysisPrompt(MASTER_JSON, JOB_TEXT, true, TEASER, 'blueprint', FIXED);
    const sys = delta.find((m) => m.role === 'system').content;
    expect(sys).toContain('REFRAME vs ADD');
    expect(sys).toContain('never INSERT experience it does not');
    expect(sys).toContain('NESTED ENGAGEMENTS');
    expect(sys).toMatch(/WRITING QUALITY \(non-negotiable\)/);
    expect(sys).toMatch(/LANGUAGE & FACTS/);

    expect(delta.find((m) => m.role === 'user').content).toContain('"target_cover_words"');
    const review = buildAnalysisPrompt(MASTER_JSON, JOB_TEXT, true, TEASER, 'review', FIXED)
      .find((m) => m.role === 'user').content;
    expect(review).toContain('"overall_score"');
    expect(review).toContain('DO NOT RECOMPUTE OR RE-EMIT these');
    const standalone = buildAnalysisPrompt(MASTER_JSON, JOB_TEXT, true, null, 'blueprint', FIXED)
      .find((m) => m.role === 'user').content;
    expect(standalone).toContain('STRICT SCENARIO LIST');
    expect(standalone).toContain('JSON OUTPUT SCHEMA');
  });

  test('analysis-teaser.js keeps its tone law, two-stage scan and output shape', () => {
    const user = buildAnalysisTeaserPrompt(CV_TEXT, JOB_TEXT, true, '', FIXED)
      .find((m) => m.role === 'user').content;
    expect(user).toContain('TONE LAW');
    expect(user).toContain('THE TWO-STAGE SCAN');
    expect(user).toContain('NO REPETITION');
    expect(user).toContain('"hr_first_seconds"');
    expect(user).toContain('SCENARIO LIST:');
    expect(user).toContain(CV_TEXT);
  });

  test('master-cv.js keeps the extraction task and the pinned output shape', () => {
    const build = joined(buildMasterCvPrompt({ rawInput: CV_TEXT, now: FIXED }));
    expect(build).toContain('precise data extraction specialist');
    expect(build).toContain('EXACT OUTPUT SHAPE');
    expect(build).toContain('"work_experience"');
    expect(build).toContain('"fractional_engagements"');
    expect(build).toContain('Do not ask any.');
    expect(build).toContain(CV_TEXT);
  });

  test('cv-generator.js keeps its red-flag, blueprint and no-fabrication rules', () => {
    const user = buildCvPrompt(MASTER_JSON, ANALYSIS, 'professional', '', '', 'auto', FIXED)
      .find((m) => m.role === 'user').content;
    expect(user).toContain('# The document\'s furniture');
    expect(user).toContain('Red flags are handled, not advertised');
    expect(user).toContain('T1 — Never fabricate');
    expect(user).toMatch(/changing a date is forbidden/);
  });

  test('cover-letter.js keeps its length budget and date/salutation format rules', () => {
    const user = buildCoverPrompt(MASTER_JSON, ANALYSIS, 'professional', '', '', 'auto', FIXED)
      .find((m) => m.role === 'user').content;
    expect(user).toContain('# The letter\'s furniture');
    expect(user).toMatch(/250-350 words/);
    expect(user).toContain('Start with the date on its own line at the top');
    expect(user).toContain('voice_samples');
  });
});

// The full date block can sit thousands of words above the CV text. These pin the
// SHORT restatement that sits immediately beside the dates being read, so the
// hardening cannot be silently dropped from a prompt later.
describe('currentDateReminder sits next to the dated text', () => {
  const FIXED2 = FIXED;

  it('renders the injected date, and a different clock changes it', () => {
    expect(currentDateReminder(FIXED2)).toContain('today is 5 March 2024');
    expect(currentDateReminder(new Date(2026, 7, 10))).toContain('today is 10 August 2026');
    expect(currentDateReminder(new Date(2026, 7, 10))).not.toContain('5 March 2024');
  });

  it('states that a past date is not the future', () => {
    expect(currentDateReminder(FIXED2)).toMatch(/already happened/i);
    expect(currentDateReminder(FIXED2)).toMatch(/never call it future/i);
  });

  // NOTE: the injected clock here is deliberately NOT today. Today is 10 August
  // 2026, so asserting on today's date would pass even if the parameter were
  // ignored and the default clock used — a test that cannot fail.
  it('every prompt that carries dated text also carries the reminder', () => {
    const PAST = new Date(2024, 2, 5);
    const has = (msgs) => JSON.stringify(msgs).includes('Reminder: today is 5 March 2024');
    expect(has(buildAnalysisTeaserPrompt('CV', '', false, '', PAST))).toBe(true);
    expect(has(buildAnalysisPrompt('CV', '', false, null, 'blueprint', PAST))).toBe(true);
    expect(has(buildCvPrompt('CV', {}, 'direct', '', '', 'auto', PAST))).toBe(true);
    expect(has(buildCoverPrompt('CV', {}, 'direct', '', '', 'auto', PAST))).toBe(true);
    expect(has(buildMasterCvPrompt({ rawInput: 'raw cv', now: PAST }))).toBe(true);
  });

  it('the teaser states the date in the SYSTEM message too, not only the instructions', () => {
    const sys = buildAnalysisTeaserPrompt('CV', '', false, '', FIXED2).find((m) => m.role === 'system');
    expect(sys.content).toContain(`TODAY'S DATE IS ${TODAY}`);
  });
});
