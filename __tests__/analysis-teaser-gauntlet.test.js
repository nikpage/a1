// __tests__/analysis-teaser-gauntlet.test.js
//
// Pins the gauntlet contract added to the landing-page teaser scan: the prompt
// must ask for two BINARY pass/fail gates (ATS + 7-second recruiter skim), a
// solid/needs-work state that drives the closing branch, and 1-4 (not exactly 2)
// CV-specific clarifying questions. These fields are what TeaserDisplay renders
// the gauntlet from — without them the UI's gate rows go blank.
//
// Red on the old prompt (it had no ats_verdict/scan_verdict/cv_state and fixed
// nuance at "EXACTLY 2"), green on the new one.

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
    for (const key of ['ats_verdict', 'ats_reason', 'scan_verdict', 'scan_reason', 'cv_state']) {
      expect(p).toContain(key);
    }
  });

  test('verdict fields are constrained to pass/fail, not a free-form grade', () => {
    const p = userPrompt(false);
    // The instruction must force a binary token for each gate.
    expect(p).toMatch(/ats_verdict[\s\S]{0,120}EXACTLY "pass" or "fail"/);
    expect(p).toMatch(/scan_verdict[\s\S]{0,120}EXACTLY "pass" or "fail"/);
  });

  test('cv_state is constrained to solid/needs_work (drives the closing branch)', () => {
    const p = userPrompt(false);
    expect(p).toMatch(/cv_state[\s\S]{0,120}EXACTLY "solid" or "needs_work"/);
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
    // scope is capped so it cannot become an 8-item dump.
    expect(p).toMatch(/analysis\.scope:\s*2 to 4 values MAX/);
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
    expect(p).toMatch(/scan_snags[\s\S]{0,700}NEVER invent/);
    expect(p).toMatch(/ats_snags:\s*ARRAY of UP TO 3/);
    expect(p).toMatch(/scan_snags:\s*ARRAY of UP TO 3/);
  });

  test('scan_snags points are raw CV facts, and the question stays in the quote only', () => {
    const p = userPrompt(false);
    // The eye-lands framing is gone — points are the verbatim fact.
    expect(p).toMatch(/scan_snags[\s\S]{0,700}never "Eye lands on/);
    // The open question must not be duplicated into a snag detail.
    expect(p).toMatch(/scan_snags[\s\S]{0,700}Do NOT phrase any "detail" as a question/);
  });

  test('the existing teaser proof fields survive the rebuild', () => {
    const p = userPrompt(false);
    for (const key of ['hr_first_seconds', 'sample_rewrite', 'scope', 'overall_score', 'ats_score']) {
      expect(p).toContain(key);
    }
  });

  test('gates are present with or without a job ad (the gauntlet is CV-first)', () => {
    expect(userPrompt(true)).toContain('ats_verdict');
    expect(userPrompt(true)).toContain('scan_verdict');
  });
});
