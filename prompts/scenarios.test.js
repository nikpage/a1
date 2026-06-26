// prompts/scenarios.test.js
import { describe, it, expect } from 'vitest';
import {
  scenarioList,
  scenarioHandling,
  scenarioGenerationRules,
  SCENARIOS,
} from './scenarios.js';

describe('scenarioList', () => {
  it('omits job-relative scenarios when there is no job ad', () => {
    const list = scenarioList(false);
    expect(list).toContain('- Recent Grad');
    expect(list).toContain('- Senior Portfolio / Independent Consultant');
    expect(list).not.toContain('Overqualified');
    expect(list).not.toContain('Career Pivot');
  });

  it('includes job-relative scenarios when a job ad is present', () => {
    const list = scenarioList(true);
    expect(list).toContain('- Overqualified');
    expect(list).toContain('- Career Pivot');
    expect(list).toContain('- Senior Portfolio / Independent Consultant');
  });
});

describe('scenarioHandling', () => {
  it('gives handling text for every base scenario without a job ad', () => {
    const h = scenarioHandling(false);
    expect(h).toContain('Senior Portfolio / Independent Consultant:');
    expect(h).toContain('Older Applicant:');
    // job-relative handling must not leak into the no-job variant
    expect(h).not.toContain('Overqualified:');
  });
});

describe('scenarioGenerationRules', () => {
  it('returns only the rules for the chosen tags', () => {
    const out = scenarioGenerationRules(['Older Applicant']);
    expect(out).toContain('Older Applicant:');
    expect(out).toContain('Earlier Career');
    expect(out).not.toContain('Recent Grad:');
  });

  it('handles multiple tags', () => {
    const out = scenarioGenerationRules([
      'Senior Portfolio / Independent Consultant',
      'Older Applicant',
    ]);
    expect(out).toContain('Senior Portfolio / Independent Consultant:');
    expect(out).toContain('Older Applicant:');
  });

  it('accepts a single string tag', () => {
    expect(scenarioGenerationRules('Career Pivot')).toContain('Career Pivot:');
  });

  it('ignores unknown tags and trims whitespace', () => {
    expect(scenarioGenerationRules(['  Older Applicant  '])).toContain('Older Applicant:');
    expect(scenarioGenerationRules(['Not A Real Scenario'])).toBe('');
  });

  it('returns empty string for empty/missing input so the generator falls back', () => {
    expect(scenarioGenerationRules([])).toBe('');
    expect(scenarioGenerationRules(null)).toBe('');
    expect(scenarioGenerationRules(undefined)).toBe('');
  });

  it('every scenario in SCENARIOS has detect, handling and generation text', () => {
    for (const [name, s] of Object.entries(SCENARIOS)) {
      expect(s.detect, `${name}.detect`).toBeTruthy();
      expect(s.handling, `${name}.handling`).toBeTruthy();
      expect(s.generation, `${name}.generation`).toBeTruthy();
    }
  });
});
