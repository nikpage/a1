// __tests__/analysis-teaser-gauntlet.test.js
//
// Pins the gauntlet contract added to the landing-page teaser scan: the prompt
// must ask for two BINARY pass/fail gates (ATS + 7-second recruiter skim) and
// 1-4 (not exactly 2) CV-specific clarifying questions. These fields are what
// TeaserDisplay renders the gauntlet from — without them the UI's gate rows go
// blank. It also pins the teaser's LEANNESS: the heavy fields (cv_state,
// sample_rewrite, scores) were cut so a landing visitor stays cheap, and the
// deep pass owns them.

import { describe, test, expect } from 'vitest';
import { buildAnalysisTeaserPrompt } from '../prompts/analysis-teaser.js';

const SAMPLE_CV = 'Jane Roe\nSenior Product Manager\nAcme (2018-2023)\nLed checkout redesign, cut cart abandonment 18%';

function userPrompt(hasJob) {
  const messages = buildAnalysisTeaserPrompt(SAMPLE_CV, hasJob ? 'PM role, Berlin' : '', hasJob);
  return messages.find((m) => m.role === 'user').content;
}

describe('buildAnalysisTeaserPrompt — gauntlet gates', () => {
  test('schema exposes both binary gates and the solid/needs-work state', () => {
    const p = userPrompt(false);
    for (const key of ['ats_verdict', 'ats_reason', 'scan_verdict', 'scan_reason']) {
      expect(p).toContain(key);
    }
  });

  test('verdict fields are constrained to pass/fail, not a free-form grade', () => {
    const p = userPrompt(false);
    // The instruction must force a binary token for each gate.
    expect(p).toMatch(/ats_verdict[\s\S]{0,120}EXACTLY "pass" or "fail"/);
    expect(p).toMatch(/scan_verdict[\s\S]{0,120}EXACTLY "pass" or "fail"/);
  });

  // The teaser was later cut to ONLY the fields TeaserDisplay renders, so the
  // heavy fields below are no longer asked for here — the deep pass owns them.
  // This pins that leanness (it is what keeps the landing visitor cheap).
  test('teaser does not ask for the deep pass\'s fields', () => {
    const p = userPrompt(false);
    for (const key of ['cv_state', 'sample_rewrite', 'overall_score', 'ats_score', 'action_items']) {
      expect(p).not.toContain(key);
    }
  });

  test('clarifying questions are now 1-4, no longer hard-fixed at exactly 2', () => {
    const p = userPrompt(false);
    expect(p).toContain('nuance_clarifications');
    expect(p).toMatch(/nuance_clarifications:\s*1 to 4/);
    // The old "EXACTLY 2 short questions" wording must be gone.
    expect(p).not.toMatch(/EXACTLY 2 short questions/);
  });

  test('prompt forbids restating the same finding across sections', () => {
    const p = userPrompt(false);
    expect(p).toMatch(/NO REPETITION/);
    expect(p).toMatch(/cover DIFFERENT ground/);
    // Named sections must be the ones that actually repeat each other.
    expect(p).toMatch(/scan_snags, hr_first_seconds and nuance_clarifications/);
  });

  test('both gates expose fail-point arrays (ats_snags + scan_snags) for the per-card fail blocks', () => {
    const p = userPrompt(false);
    // Each gate's fail card renders its own up-to-3 walk-through points, so the
    // prompt must ask for BOTH arrays — the old prompt had no ats_snags.
    expect(p).toContain('ats_snags');
    expect(p).toContain('scan_snags');
    // Never-fabricate guard must be explicit on each (the whole product dies if
    // we invent fail points), and each is capped at 3, not a fixed count.
    expect(p).toMatch(/ats_snags[\s\S]{0,700}NEVER invent/);
    expect(p).toMatch(/scan_snags[\s\S]{0,1100}NEVER invent/);
    expect(p).toMatch(/ats_snags:\s*ARRAY of UP TO 3/);
    expect(p).toMatch(/scan_snags:\s*ARRAY of UP TO 3/);
  });

  test('scan_snags points are raw CV facts, and the question stays in the quote only', () => {
    const p = userPrompt(false);
    // The eye-lands framing is gone — points are the verbatim fact.
    expect(p).toMatch(/scan_snags[\s\S]{0,1100}never "Eye lands on/);
    // The open question must not be duplicated into a snag detail.
    expect(p).toMatch(/scan_snags[\s\S]{0,1100}Do NOT phrase any "detail" as a question/);
  });

  test('the existing teaser proof fields survive the rebuild', () => {
    const p = userPrompt(false);
    for (const key of ['hr_first_seconds', 'buried_credentials', 'scenario_tags', 'cv_data']) {
      expect(p).toContain(key);
    }
  });

  test('gates are present with or without a job ad (the gauntlet is CV-first)', () => {
    expect(userPrompt(true)).toContain('ats_verdict');
    expect(userPrompt(true)).toContain('scan_verdict');
  });
});
