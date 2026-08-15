// prompts/scenarios.test.js
import { describe, it, expect } from 'vitest';
import {
  scenarioList,
  scenarioHandling,
  scenarioGenerationRules,
  scenarioCoverRules,
  detectOlderApplicant,
  withOlderApplicant,
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

  // The override is what actually builds the section, so the bulleted form and
  // its cap have to reach the generator from here, not only from Layer 1.
  it('builds the Earlier Career section as a capped bulleted list', () => {
    const out = scenarioGenerationRules(['Older Applicant']);
    expect(out).toContain('ONE BULLET PER ROLE');
    expect(out).toContain('AT MOST SIX bullets');
    expect(out).toMatch(/print a location ONLY where the master records one/);
    expect(out).not.toMatch(/no bullets/i);
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

  // The override's target is the cumulative figure a screening sort acts on
  // before it reads anything. A duration scoped to one role is evidence of depth
  // — banning it stripped out the very thing the override exists to protect.
  it('bans career totals but keeps role-scoped durations', () => {
    const out = scenarioGenerationRules(['Older Applicant']);
    expect(out).toMatch(/CUMULATIVE career total/);
    expect(out).toMatch(/SINGLE role, project or engagement stays/);
    expect(out).not.toMatch(/or any career total anywhere/);
  });

  it('every scenario in SCENARIOS has detect, handling and generation text', () => {
    for (const [name, s] of Object.entries(SCENARIOS)) {
      expect(s.detect, `${name}.detect`).toBeTruthy();
      expect(s.handling, `${name}.handling`).toBeTruthy();
      expect(s.generation, `${name}.generation`).toBeTruthy();
    }
  });
});

// The real case this was written for: a 1994→Present career whose teaser tags were
// [Senior Portfolio / Independent Consultant, Employment Gap] — two slots, both
// taken, so the age mitigations never reached the generator.
// The record nests and dates live in start_date/end_date, so fixtures are
// written the way the extraction emits them.
const wx = (list) => ({ work_experience: list.map((r) => {
  const [start = '', end = ''] = String(r.dates || '').split(/\s*-\s*/);
  return { company: r.company, title: r.title || '', start_date: start, end_date: end, bullets: [], fractional_engagements: [] };
}) });

const seniorMaster = wx([
  { company: 'Own practice', dates: '08/2016 - Present' },
  { company: 'Bank', dates: '07/2014 - 08/2016' },
  { company: 'Various Employers', dates: '01/1994 - 09/2012' },
]);

describe('detectOlderApplicant', () => {
  const now = new Date('2026-08-11T00:00:00Z');

  it('fires when the earliest role starts more than 15 years before the latest end', () => {
    expect(detectOlderApplicant(seniorMaster, now)).toBe(true);
  });

  it('treats an ongoing role as ending now', () => {
    const m = wx([{ company: 'X', dates: '2005 - Present' }]);
    expect(detectOlderApplicant(m, now)).toBe(true);
  });

  it('does not fire on a span of exactly 15 years', () => {
    const m = wx([
        { company: 'B', dates: '03/2015 - 06/2020' },
        { company: 'A', dates: '01/2005 - 02/2015' },
      ]);
    expect(detectOlderApplicant(m, now)).toBe(false);
  });

  it('does not fire on a short recent history', () => {
    const m = wx([{ company: 'X', dates: '01/2021 - Present' }]);
    expect(detectOlderApplicant(m, now)).toBe(false);
  });

  it('returns false when there is no usable master', () => {
    expect(detectOlderApplicant(null, now)).toBe(false);
    expect(detectOlderApplicant(wx([]), now)).toBe(false);
    expect(detectOlderApplicant(wx([{ company: 'X', dates: '' }]), now)).toBe(false);
  });
});

describe('withOlderApplicant', () => {
  const now = new Date('2026-08-11T00:00:00Z');

  it('survives the Layer 4 two-tag cap when the model already chose two', () => {
    const tags = withOlderApplicant(
      ['Senior Portfolio / Independent Consultant', 'Employment Gap'],
      seniorMaster,
      now,
    );
    expect(tags.slice(0, 2)).toEqual([
      'Senior Portfolio / Independent Consultant',
      'Older Applicant',
    ]);
    expect(scenarioGenerationRules(tags)).toContain('Older Applicant:');
  });

  it('leaves the tags untouched when the dates do not trigger it', () => {
    const m = wx([{ company: 'X', dates: '01/2021 - Present' }]);
    expect(withOlderApplicant(['Career Pivot'], m, now)).toEqual(['Career Pivot']);
  });

  it('does not duplicate a tag the model already chose', () => {
    const tags = withOlderApplicant(['Older Applicant'], seniorMaster, now);
    expect(tags).toEqual(['Older Applicant']);
  });

  it('adds it as the only tag when the analysis chose none', () => {
    expect(withOlderApplicant([], seniorMaster, now)).toEqual(['Older Applicant']);
  });
});

describe('scenarioCoverRules', () => {
  it('every scenario carries a cover rule distinct from its CV rule', () => {
    for (const [name, s] of Object.entries(SCENARIOS)) {
      expect(typeof s.cover, name).toBe('string');
      expect(s.cover.length, name).toBeGreaterThan(40);
      expect(s.cover, name).not.toBe(s.generation);
    }
  });

  it('renders the letter rule, not the CV rule, for the chosen tag', () => {
    const out = scenarioCoverRules(['Older Applicant']);
    expect(out).toContain('Older Applicant:');
    expect(out).toContain(SCENARIOS['Older Applicant'].cover);
    expect(out).not.toContain(SCENARIOS['Older Applicant'].generation);
    // CV-only mitigations must not leak into a letter that has no sections.
    expect(out).not.toMatch(/Strip graduation years|markdown structure/);
  });

  it('caps at two active overrides', () => {
    const out = scenarioCoverRules(['Older Applicant', 'Career Pivot', 'Overqualified']);
    expect(out).toContain('Older Applicant:');
    expect(out).toContain('Career Pivot:');
    expect(out).not.toContain('Overqualified:');
  });

  it('bars the cumulative total and years-of-experience in the letter too', () => {
    expect(scenarioCoverRules(['Older Applicant'])).toMatch(/25\+ years|cumulative/i);
    expect(scenarioCoverRules(['Under-qualified'])).toMatch(/NO years of experience/i);
  });

  it('is empty for unknown, empty or missing tags', () => {
    expect(scenarioCoverRules(['Not A Real Scenario'])).toBe('');
    expect(scenarioCoverRules([])).toBe('');
    expect(scenarioCoverRules(null)).toBe('');
    expect(scenarioCoverRules(undefined)).toBe('');
  });

  it('accepts a bare string and trims whitespace, like the CV renderer', () => {
    expect(scenarioCoverRules('Career Pivot')).toContain('Career Pivot:');
    expect(scenarioCoverRules(['  Job Returner  '])).toContain('Job Returner:');
  });
});
