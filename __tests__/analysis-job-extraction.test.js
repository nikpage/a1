// __tests__/analysis-job-extraction.test.js

import { describe, test, expect } from 'vitest';
import { buildAnalysisPrompt } from '../prompts/analysis.js';

const SAMPLE_CV = 'John Doe\nSoftware Engineer\n5 years Python experience\nAWS certified';
const SAMPLE_JOB = 'We need a Senior Backend Engineer with Python, AWS, and Kubernetes skills. Must have 5+ years experience. Nice to have: Terraform, Go. Full-time position in Berlin.';

describe('buildAnalysisPrompt — job_extraction schema', () => {
  test('with hasJobText=true: prompt contains job_extraction schema keys', () => {
    const messages = buildAnalysisPrompt(SAMPLE_CV, SAMPLE_JOB, true);
    const userPrompt = messages.find(m => m.role === 'user').content;

    expect(userPrompt).toContain('job_extraction');
    expect(userPrompt).toContain('position_title');
    expect(userPrompt).toContain('hard_skills');
    expect(userPrompt).toContain('soft_skills');
    expect(userPrompt).toContain('must_have_requirements');
    expect(userPrompt).toContain('nice_to_have');
    expect(userPrompt).toContain('keywords_for_ats');
    expect(userPrompt).toContain('responsibilities');
    expect(userPrompt).toContain('language_requirements');
    expect(userPrompt).toContain('employment_type');
    expect(userPrompt).toContain('salary');
  });

  test('with hasJobText=true: prompt includes "never invent" instruction for job_extraction', () => {
    const messages = buildAnalysisPrompt(SAMPLE_CV, SAMPLE_JOB, true);
    const userPrompt = messages.find(m => m.role === 'user').content;

    expect(userPrompt).toMatch(/never invent/i);
    expect(userPrompt).toContain('job_extraction');
  });

  test('with hasJobText=false: prompt does NOT contain job_extraction schema (CV-only analysis unaffected)', () => {
    const messages = buildAnalysisPrompt(SAMPLE_CV, '', false);
    const userPrompt = messages.find(m => m.role === 'user').content;

    expect(userPrompt).not.toContain('job_extraction');
    expect(userPrompt).not.toContain('keywords_for_ats');
  });

  test('with hasJobText=false: existing fields (job_data, job_match, ats_keywords) still present', () => {
    const messages = buildAnalysisPrompt(SAMPLE_CV, '', false);
    const userPrompt = messages.find(m => m.role === 'user').content;

    // These downstream-used fields must survive regardless of hasJobText
    expect(userPrompt).toContain('job_data');
    expect(userPrompt).toContain('job_match');
    expect(userPrompt).toContain('ats_keywords_present');
    expect(userPrompt).toContain('ats_keywords_missing');
  });

  test('with hasJobText=true: job description is included in the prompt', () => {
    const messages = buildAnalysisPrompt(SAMPLE_CV, SAMPLE_JOB, true);
    const userPrompt = messages.find(m => m.role === 'user').content;

    expect(userPrompt).toContain('JOB DESCRIPTION:');
    expect(userPrompt).toContain(SAMPLE_JOB);
  });

  test('with hasJobText=false: job description section is absent', () => {
    const messages = buildAnalysisPrompt(SAMPLE_CV, '', false);
    const userPrompt = messages.find(m => m.role === 'user').content;

    expect(userPrompt).not.toContain('JOB DESCRIPTION:');
  });
});
