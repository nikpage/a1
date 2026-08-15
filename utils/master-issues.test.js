// utils/master-issues.test.js
import { describe, it, expect } from 'vitest';
import { computeMasterIssues } from './master-issues.js';
import { resolveFlag } from './master-flags.js';

// A fixed "now" so window/duration math is deterministic regardless of when the
// suite runs. The real test CV (Nik Page) was uploaded against mid-2026.
const NOW = new Date('2026-06-28T00:00:00Z');

// Write a role the way the extraction emits it, from a single "start - end"
// string, so the fixtures below stay readable.
const role = (company, title, dates, location = 'Prague, CZ', engagements = []) => {
  const [start_date = '', end_date = ''] = String(dates).split(/\s+-\s+/);
  return { company, title, start_date, end_date, location, bullets: [], fractional_engagements: engagements };
};

// The real test CV, in the shape the extraction now produces: the client
// engagements that ran inside the consultancy's span are NESTED under it, which
// is the structural call the overlap question used to ask the user to make.
const realMaster = {
  work_experience: [
    role('Nik Page Experience Strategy & Design', 'Product Creator & Experience Designer', 'August 2016 - Present', 'Prague, CZ', [
      role('Salsita Software', 'Sr. Product & Account Manager', 'November 2022 - October 2023'),
      role('wflow.com', 'Head of Product Research & Design', 'January 2022 - October 2022'),
      role('Blockchain & Fintech Ventures', 'Executive Strategy & Experience Advisor', 'May 2018 - July 2020'),
    ]),
    role('Česká spořitelna', 'Head of Experience Design', 'July 2014 - August 2016'),
    role('Česká spořitelna', 'UX Team Founder', 'October 2012 - July 2014'),
    role('ČSOB & Airbank', 'Managing Consultant (QA Strategy)', '2011'),
    role('AVG & ZOOM International', 'Manager, QA Labs & UX', '2008 - 2010'),
  ],
};

describe('computeMasterIssues — the nested record answers what the overlap question used to ask', () => {
  it('asks nothing about the consultancy overlap: the record already states it', () => {
    const issues = computeMasterIssues(realMaster, NOW);
    expect(issues.some((i) => i.kind === 'overlap')).toBe(false);
    expect(issues.some((i) => i.type === 'structural')).toBe(false);
  });

  it('does not ask why a nested engagement was short — the nesting is the answer', () => {
    // Salsita ran 11 months and wflow 9. Standing alone those are short tenures
    // worth a question; sitting inside the consultancy they are client work.
    const issues = computeMasterIssues(realMaster, NOW);
    const shortCompanies = issues
      .filter((i) => i.kind === 'short_tenure')
      .map((i) => i.question);
    expect(shortCompanies.join(' ')).not.toMatch(/Salsita|wflow/);
  });
});

describe('computeMasterIssues — isolated detectors', () => {
  it('flags a genuine short tenure not covered by any ongoing role', () => {
    const m = {
      work_experience: [
        role('Acme', 'PM', 'March 2024 - October 2024', 'Berlin'), // 7 months
        role('Globex', 'PM', 'January 2020 - February 2024', 'Berlin'),
      ],
    };
    const issues = computeMasterIssues(m, NOW);
    const short = issues.find((i) => i.kind === 'short_tenure');
    expect(short).toBeTruthy();
    expect(short.target.index).toBe(0);
    expect(short.question).toMatch(/7 months/);
  });

  it('flags a real employment gap and attaches it to the role after the gap', () => {
    const m = {
      work_experience: [
        role('New Co', 'Lead', 'June 2023 - Present', 'Berlin'),
        role('Old Co', 'Lead', 'January 2018 - January 2021', 'Berlin'), // gap 2021->2023
      ],
    };
    const issues = computeMasterIssues(m, NOW);
    const gap = issues.find((i) => i.kind === 'gap');
    expect(gap).toBeTruthy();
    expect(gap.target.index).toBe(0); // the return-to-work role
  });

  it('does not flag short tenure for year-only dates (too coarse to call)', () => {
    const m = { work_experience: [role('X', 'Y', '2011', 'Z')] };
    const issues = computeMasterIssues(m, NOW);
    expect(issues.some((i) => i.kind === 'short_tenure')).toBe(false);
  });

  it('returns nothing for an empty or master-less input', () => {
    expect(computeMasterIssues(null, NOW)).toEqual([]);
    expect(computeMasterIssues({ work_experience: [] }, NOW)).toEqual([]);
  });

  // The index a question carries is an index into the FLAT role list, so a
  // question about a nested engagement must point at it, not at its umbrella.
  it('indexes nested engagements in record order, umbrella first', () => {
    const m = {
      work_experience: [
        role('Umbrella', 'Principal', 'January 2015 - Present', 'Prague', [
          role('Client A', 'Advisor', 'March 2024 - October 2024'),
        ]),
        role('Later Co', 'Lead', 'January 2010 - December 2014'),
      ],
    };
    const issues = computeMasterIssues(m, NOW);
    // Index 0 is the umbrella, 1 the engagement inside it, 2 the next top-level
    // role — so nothing can be asked about the wrong company.
    expect(issues.every((i) => i.target.index !== 1)).toBe(true);
  });
});

describe('computeMasterIssues — an answered question is not asked again', () => {
  const m = {
    work_experience: [
      role('Acme', 'PM', 'March 2024 - October 2024', 'Berlin'),
      role('Globex', 'PM', 'January 2020 - February 2024', 'Berlin'),
    ],
  };

  it('drops the question once the user has answered it', () => {
    const before = computeMasterIssues(m, NOW);
    const short = before.find((i) => i.kind === 'short_tenure');
    expect(short).toBeTruthy();

    const after = resolveFlag(m, short, { decision: 'option', value: 'Contract ended as planned' });
    const issues = computeMasterIssues(after, NOW);
    expect(issues.some((i) => i.id === short.id)).toBe(false);
  });

  it('stores the answer outside work_experience, so it cannot reach a CV bullet', () => {
    const short = computeMasterIssues(m, NOW).find((i) => i.kind === 'short_tenure');
    const after = resolveFlag(m, short, { decision: 'option', value: 'Contract ended as planned' });
    expect(after.clarifications[0].note).toBe('Contract ended as planned');
    expect(JSON.stringify(after.work_experience)).not.toContain('Contract ended as planned');
  });
});

describe('computeMasterIssues — ordering and the opts-object signature', () => {
  const m = {
    work_experience: [
      role('New Co', 'Lead', 'June 2023 - Present', 'Berlin'),
      role('Short Co', 'PM', 'January 2021 - June 2021', 'Berlin'),
      role('Old Co', 'Lead', 'January 2016 - January 2020', 'Berlin'),
    ],
  };

  it('accepts the opts-object call form as well as the legacy positional Date', () => {
    expect(computeMasterIssues(m, { now: NOW })).toEqual(computeMasterIssues(m, NOW));
  });

  it('asks about a gap before it asks why a short role ended', () => {
    const kinds = computeMasterIssues(m, NOW).map((i) => i.kind);
    expect(kinds).toContain('gap');
    expect(kinds).toContain('short_tenure');
    expect(kinds.indexOf('gap')).toBeLessThan(kinds.indexOf('short_tenure'));
  });
});

describe('computeMasterIssues — analysis context/suggestion attachment', () => {
  const m = {
    work_experience: [
      role('Acme', 'PM', 'March 2024 - October 2024', 'Berlin'),
      role('Globex', 'PM', 'January 2020 - February 2024', 'Berlin'),
    ],
  };

  it('attaches context and a verbatim-option suggestion when the analysis names the option', () => {
    const analysis = {
      analysis: {
        red_flags: ['The seven-month stint at Acme looks like a Contract / fixed-term role ended, not a departure.'],
      },
    };
    const issues = computeMasterIssues(m, { now: NOW, analysis });
    const short = issues.find((i) => i.kind === 'short_tenure');
    expect(short.context).toMatch(/Acme/);
    expect(short.suggestion).toBe('Contract / fixed-term role ended');
  });

  it('omits context and suggestion when nothing in the analysis names the entry', () => {
    const analysis = { analysis: { red_flags: ['The CV is two pages long.'] } };
    const issues = computeMasterIssues(m, { now: NOW, analysis });
    const short = issues.find((i) => i.kind === 'short_tenure');
    expect(short.context).toBeUndefined();
    expect(short.suggestion).toBeUndefined();
  });
});
