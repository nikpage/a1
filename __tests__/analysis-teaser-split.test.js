// __tests__/analysis-teaser-split.test.js
//
// Proves the teaser/full split: when buildAnalysisPrompt is handed a teaser, it
// asks ONLY for the deep delta (never re-emits the teaser's carried fields), and
// mergeTeaserAndDelta glues teaser + delta into one complete analysis.

import { describe, test, expect } from 'vitest';
import { buildAnalysisPrompt } from '../prompts/analysis.js';
import { mergeTeaserAndDelta } from '../utils/openai.js';

const SAMPLE_CV = 'John Doe\nSoftware Engineer\n5 years Python experience\nAWS certified';
const SAMPLE_JOB = 'Senior Backend Engineer: Python, AWS, Kubernetes. 5+ years. Berlin.';

const TEASER = {
  cv_data: { Name: 'John Doe', Seniority: 'Mid', Industry: 'Software', Country: 'Germany' },
  analysis: {
    overall_score: '6',
    ats_score: '5',
    ats_verdict: 'fail',
    overall_commentary: 'Solid Python background, undersold.',
    career_arc: 'Engineer growing into backend depth.',
    red_flags: ['10-month gap 2022'],
  },
  job_match: { positioning_strategy: 'Lead with the AWS work.' },
  final_thought: 'Score 6: surface the cloud work higher.',
};

describe('buildAnalysisPrompt — delta mode (teaser supplied)', () => {
  const userPrompt = () =>
    buildAnalysisPrompt(SAMPLE_CV, SAMPLE_JOB, true, TEASER).find(m => m.role === 'user').content;

  test('embeds the teaser JSON as established context', () => {
    const p = userPrompt();
    expect(p).toContain('first-pass TEASER');
    expect(p).toContain('"overall_commentary": "Solid Python background, undersold."');
  });

  test('asks only for delta fields, NOT the carried teaser fields', () => {
    const p = userPrompt();
    // delta fields requested
    expect(p).toContain('candidate_core');
    expect(p).toContain('generation_framework');
    expect(p).toContain('skills_to_highlight');
    expect(p).toContain('action_items');
    // carried fields must NOT be in the output schema (no re-emit / re-spend)
    expect(p).not.toContain('"overall_commentary": ""');
    expect(p).not.toContain('"career_arc": ""');
    expect(p).not.toContain('"final_thought": ""');
    expect(p).not.toContain('"positioning_strategy": ""');
  });

  test('still drives job_extraction when a job ad is present', () => {
    const p = userPrompt();
    expect(p).toContain('job_extraction');
    expect(p).toContain('hard_skills');
  });

  test('no-teaser path is unchanged: full schema still emits carried fields', () => {
    const p = buildAnalysisPrompt(SAMPLE_CV, SAMPLE_JOB, true, null)
      .find(m => m.role === 'user').content;
    expect(p).toContain('"overall_commentary": ""');
    expect(p).toContain('"final_thought": ""');
    expect(p).toContain('"positioning_strategy": ""');
    expect(p).not.toContain('first-pass TEASER');
  });
});

describe('mergeTeaserAndDelta', () => {
  const DELTA = {
    candidate_core: 'Backend engineer with cloud depth.',
    summary: 'Python engineer ready for senior backend.',
    analysis: {
      scenario_tags: ['Standard Career Progression'],
      cv_format_analysis: 'One page, clean.',
      red_flags: ['10-month gap 2022', 'Two short tenures in a row'],
      ats_keywords_present: 'Python, AWS',
    },
    job_match: { keyword_match: '70%', career_scenario: 'Standard Career Progression' },
    generation_framework: { cv_blueprint: { target_length_pages: '1 page' } },
  };

  const merged = mergeTeaserAndDelta(TEASER, DELTA);

  test('carries teaser-only top-level fields through untouched', () => {
    expect(merged.final_thought).toBe('Score 6: surface the cloud work higher.');
    expect(merged.cv_data.Country).toBe('Germany');
  });

  test('adds the delta top-level fields', () => {
    expect(merged.candidate_core).toBe('Backend engineer with cloud depth.');
    expect(merged.summary).toBe('Python engineer ready for senior backend.');
    expect(merged.generation_framework.cv_blueprint.target_length_pages).toBe('1 page');
  });

  test('analysis is key-merged: teaser scores survive, delta wins on shared keys', () => {
    // teaser-only analysis keys preserved
    expect(merged.analysis.overall_score).toBe('6');
    expect(merged.analysis.ats_verdict).toBe('fail');
    expect(merged.analysis.overall_commentary).toBe('Solid Python background, undersold.');
    // delta-only analysis keys added
    expect(merged.analysis.scenario_tags).toEqual(['Standard Career Progression']);
    expect(merged.analysis.ats_keywords_present).toBe('Python, AWS');
    // shared key (red_flags): delta's FULL list replaces the teaser's preview
    expect(merged.analysis.red_flags).toEqual(['10-month gap 2022', 'Two short tenures in a row']);
  });

  test('job_match is key-merged: teaser positioning survives, delta adds match data', () => {
    expect(merged.job_match.positioning_strategy).toBe('Lead with the AWS work.');
    expect(merged.job_match.keyword_match).toBe('70%');
    expect(merged.job_match.career_scenario).toBe('Standard Career Progression');
  });
});
