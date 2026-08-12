// prompts/job-target.test.js
//
// Regression cover for the bug this module fixes: the job ad never reached
// either generator, so the documents could not be written against the ad's own
// requirements. These assertions fail on the old prompts (no ad text anywhere
// in the built messages) and pass now.

import { describe, it, expect } from 'vitest';
import { targetJobBlock } from './job-target.js';
import { buildCvPrompt } from './cv-generator.js';
import { buildCoverPrompt } from './cover-letter.js';

const analysisWithJob = {
  job_extraction: {
    position_title: 'Senior Platform Engineer',
    company: 'Northwind',
    location: 'Prague, Czech Republic',
    seniority: 'Senior',
    must_have_requirements: ['5+ years Kubernetes in production'],
    required_skills: ['Terraform', 'Go'],
    responsibilities: ['Own the deployment pipeline'],
    desired_skills: ['Prometheus'],
    nice_to_have: ['Public speaking'],
    language_requirements: ['English C1'],
  },
};

describe('targetJobBlock', () => {
  it('renders every stated field of the ad', () => {
    const block = targetJobBlock(analysisWithJob);
    expect(block).toContain('Senior Platform Engineer');
    expect(block).toContain('Northwind');
    expect(block).toContain('Prague, Czech Republic');
    expect(block).toContain('- 5+ years Kubernetes in production');
    expect(block).toContain('- Terraform');
    expect(block).toContain('- Own the deployment pipeline');
    expect(block).toContain('- Prometheus');
    expect(block).toContain('- Public speaking');
    expect(block).toContain('- English C1');
  });

  it('omits fields the ad was silent on rather than printing empty labels', () => {
    const block = targetJobBlock({ job_extraction: { position_title: 'Barista' } });
    expect(block).toContain('Position: Barista');
    expect(block).not.toContain('Company:');
    expect(block).not.toContain('Must-have requirements:');
    expect(block).not.toContain('Required skills:');
  });

  it('returns nothing for a standalone review with no job ad', () => {
    expect(targetJobBlock({ analysis: { scenario_tags: ['Recent Grad'] } })).toBe('');
    expect(targetJobBlock(null)).toBe('');
    expect(targetJobBlock({ job_extraction: 'not an object' })).toBe('');
  });

  it('returns nothing when the extraction object carries no usable content', () => {
    expect(targetJobBlock({ job_extraction: { position_title: '', required_skills: [] } })).toBe('');
  });

  it('keeps the ad framed as a target, never as evidence about the candidate', () => {
    const block = targetJobBlock(analysisWithJob);
    expect(block).toContain('never evidence about the candidate');
    expect(block).toMatch(/requirement with no evidence stays unanswered/i);
  });
});

describe('the generators receive the ad', () => {
  // The ad's strings also occur inside the stringified analysis blob, so a bare
  // substring check would pass on the OLD prompts too. These assert on the
  // stated target-job section — the thing that was missing — and on the
  // requirement appearing in it, ahead of the "# Inputs" analysis dump.
  it('states the target job to the CV prompt, before the analysis dump', () => {
    const [, user] = buildCvPrompt('MASTER-CV-TEXT', analysisWithJob, 'Formal');
    const header = user.content.indexOf('# The target job');
    expect(header).toBeGreaterThan(-1);
    expect(user.content.indexOf('- 5+ years Kubernetes in production')).toBeGreaterThan(header);
    expect(header).toBeLessThan(user.content.indexOf('## Analysis ('));
  });

  it('states the target job to the cover-letter prompt, before the analysis dump', () => {
    const [, user] = buildCoverPrompt('MASTER-CV-TEXT', analysisWithJob, 'Formal');
    const header = user.content.indexOf('# The target job');
    expect(header).toBeGreaterThan(-1);
    expect(user.content.indexOf('Company: Northwind')).toBeGreaterThan(header);
    expect(header).toBeLessThan(user.content.indexOf('## Analysis ('));
  });

  it('leaves both prompts free of a target-job section when there is no ad', () => {
    const [, cvUser] = buildCvPrompt('MASTER-CV-TEXT', { analysis: {} }, 'Formal');
    const [, coverUser] = buildCoverPrompt('MASTER-CV-TEXT', { analysis: {} }, 'Formal');
    expect(cvUser.content).not.toContain('# The target job');
    expect(coverUser.content).not.toContain('# The target job');
  });
});
