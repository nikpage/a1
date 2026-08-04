// utils/master-issues.test.js
import { describe, it, expect } from 'vitest';
import { computeMasterIssues } from './master-issues.js';
import { resolveFlag } from './master-flags.js';

// A fixed "now" so window/duration math is deterministic regardless of when the
// suite runs. The real test CV (Nik Page) was uploaded against mid-2026.
const NOW = new Date('2026-06-28T00:00:00Z');

// The actual master experience extracted from the real test CV, verbatim dates.
const realMaster = {
  experience: [
    { company: 'Salsita Software', role: 'Sr. Product & Account Manager', dates: 'November 2022 - October 2023', location: 'Prague, Czechia' },
    { company: 'wflow.com', role: 'Head of Product Research & Design', dates: 'January 2022 - October 2022', location: 'Prague, Czechia' },
    { company: 'Nik Page Experience Strategy & Design', role: 'Product Creator & Experience Designer', dates: 'August 2016 - Present', location: 'Prague, Czechia' },
    { company: 'Blockchain & Fintech Ventures', role: 'Executive Strategy & Experience Advisor', dates: 'May 2018 - July 2020', location: 'Prague, Czechia' },
    { company: 'Česká spořitelna', role: 'Head of Experience Design', dates: 'July 2014 - August 2016', location: 'Prague, Czechia' },
    { company: 'Česká spořitelna', role: 'UX Team Founder', dates: 'October 2012 - July 2014', location: 'Prague, Czechia' },
    { company: 'ČSOB & Airbank', role: 'Managing Consultant (QA Strategy)', dates: '2011', location: 'Prague, Czechia' },
    { company: 'AVG & ZOOM International', role: 'Manager, QA Labs & UX', dates: '2008 - 2010', location: 'Prague, Czechia' },
  ],
};

describe('computeMasterIssues — real CV', () => {
  it('first asks ONE thing: were the overlapping roles delivered under the consultancy?', () => {
    const issues = computeMasterIssues(realMaster, NOW);
    expect(issues).toHaveLength(1);
    const [issue] = issues;
    expect(issue.kind).toBe('overlap');
    expect(issue.type).toBe('structural'); // a merge decision, not a free-text note
    expect(issue.target.index).toBe(2); // the Nik Page consultancy
    expect(issue.merge.child_indexes).toEqual(expect.arrayContaining([0, 1, 3]));
  });

  it('while the overlap is unanswered, Salsita/wflow are NOT yet short-tenure-flagged', () => {
    const issues = computeMasterIssues(realMaster, NOW);
    const shortIdx = issues.filter((i) => i.kind === 'short_tenure').map((i) => i.target.index);
    expect(shortIdx).toEqual([]);
  });

  it('finds no gaps — the ongoing consultancy fills the recent timeline', () => {
    const issues = computeMasterIssues(realMaster, NOW);
    expect(issues.some((i) => i.kind === 'gap')).toBe(false);
  });

  // The exact dependency: a short tenure is resolved ONLY if the job is grouped
  // under the consultancy. If the user says "separate", the short stints stand.
  it('answering "separate" surfaces Salsita (11mo) and wflow (9mo) as short tenures', () => {
    const sep = JSON.parse(JSON.stringify(realMaster));
    sep.experience[2].clarification = 'Held concurrently as separate roles.';
    const issues = computeMasterIssues(sep, NOW);
    expect(issues.some((i) => i.kind === 'overlap')).toBe(false); // not re-asked
    const shortIdx = issues.filter((i) => i.kind === 'short_tenure').map((i) => i.target.index).sort();
    expect(shortIdx).toEqual([0, 1]); // Salsita + wflow; Blockchain (26mo) is not short
  });

  it('grouping under the consultancy (children nested away) leaves nothing to ask', () => {
    // applyStructuralMerge removes the children from experience[] and nests them
    // under the parent — simulate the post-merge master: only the consultancy and
    // the older standalone roles remain.
    const merged = {
      experience: [
        { ...realMaster.experience[2], contracts: [realMaster.experience[0], realMaster.experience[1], realMaster.experience[3]] },
        realMaster.experience[4],
        realMaster.experience[5],
        realMaster.experience[6],
        realMaster.experience[7],
      ],
    };
    expect(computeMasterIssues(merged, NOW)).toHaveLength(0);
  });
});

describe('computeMasterIssues — isolated detectors', () => {
  it('flags a genuine short tenure not covered by any ongoing role', () => {
    const m = {
      experience: [
        { company: 'Acme', role: 'PM', dates: 'March 2024 - October 2024', location: 'Berlin' }, // 7 months
        { company: 'Globex', role: 'PM', dates: 'January 2020 - February 2024', location: 'Berlin' },
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
      experience: [
        { company: 'New Co', role: 'Lead', dates: 'June 2023 - Present', location: 'Berlin' },
        { company: 'Old Co', role: 'Lead', dates: 'January 2018 - January 2021', location: 'Berlin' }, // gap 2021->2023
      ],
    };
    const issues = computeMasterIssues(m, NOW);
    const gap = issues.find((i) => i.kind === 'gap');
    expect(gap).toBeTruthy();
    expect(gap.target.index).toBe(0); // the return-to-work role
  });

  it('does not flag short tenure for year-only dates (too coarse to call)', () => {
    const m = { experience: [{ company: 'X', role: 'Y', dates: '2011', location: 'Z' }] };
    const issues = computeMasterIssues(m, NOW);
    expect(issues.some((i) => i.kind === 'short_tenure')).toBe(false);
  });

  it('returns nothing for an empty or master-less input', () => {
    expect(computeMasterIssues(null, NOW)).toEqual([]);
    expect(computeMasterIssues({ experience: [] }, NOW)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// TASK 1 — hierarchical recompute. The API (pages/api/resolve-flag.js) and the
// component (components/MasterFlagFixer.js) no longer trust a snapshot taken at
// page load; every resolve recomputes computeMasterIssues() against the
// UPDATED master. These tests exercise that recompute through the real mutation
// function (utils/master-flags resolveFlag), not a hand-rolled substitute.
// ---------------------------------------------------------------------------
describe('computeMasterIssues — hierarchical recompute via the real resolveFlag()', () => {
  it('REGRESSION: merging the overlap removes the child short-tenure questions it was suppressing', () => {
    const before = computeMasterIssues(realMaster, NOW);
    const overlap = before.find((i) => i.kind === 'overlap');
    expect(overlap).toBeTruthy();
    expect(before.filter((i) => i.kind === 'short_tenure')).toHaveLength(0); // suppressed while open

    // Resolve it exactly the way the app does: real resolveFlag(), not a
    // hand-built master.
    const updated = resolveFlag(realMaster, overlap, { decision: 'merge', value: 'Contracts under my consultancy.' });
    const after = computeMasterIssues(updated, NOW);

    // The three children (Salsita, wflow, Blockchain — indexes 0/1/3) are
    // nested away as `contracts`; they no longer exist as top-level experience
    // rows, so NOTHING can ever ask about their short tenure again.
    expect(after.some((i) => i.kind === 'short_tenure')).toBe(false);
    expect(after.some((i) => i.kind === 'gap')).toBe(false);

    // The umbrella role appears EXACTLY once afterwards: applyStructuralMerge
    // folds the children into the parent's own existing row rather than adding a
    // second copy of it. A duplicate would trivially overlap itself and raise a
    // spurious overlap question that no answer could ever clear.
    expect(updated.experience.filter((e) => e.company === overlap.merge.parent.company)).toHaveLength(1);
    expect(after.some((i) => i.kind === 'overlap')).toBe(false);
  });

  it('answering "separate" via the real resolveFlag() lifts the suppression and surfaces the short stints', () => {
    const before = computeMasterIssues(realMaster, NOW);
    const overlap = before.find((i) => i.kind === 'overlap');

    const updated = resolveFlag(realMaster, overlap, { decision: 'separate', value: 'Held concurrently as separate roles.' });
    const after = computeMasterIssues(updated, NOW);

    expect(after.some((i) => i.kind === 'overlap')).toBe(false); // settled, not re-asked
    const shortIdx = after.filter((i) => i.kind === 'short_tenure').map((i) => i.target.index).sort();
    expect(shortIdx).toEqual([0, 1]); // Salsita + wflow surface; Blockchain (26mo) is not short
  });
});

// ---------------------------------------------------------------------------
// TASK 1 — ranking + the new options-object call signature.
// ---------------------------------------------------------------------------
describe('computeMasterIssues — ordering and the opts-object signature', () => {
  // Three independent, non-interacting issues (an overlap, a gap, and a short
  // tenure) so ordering can be asserted on the exact id sequence.
  const orderingMaster = {
    experience: [
      { company: 'Overlap Parent', role: 'Owner', dates: 'January 2018 - Present', location: 'X' },        // 0
      { company: 'Overlap Child', role: 'Contractor', dates: 'January 2019 - June 2019', location: 'X' },   // 1 (suppressed short; child of overlap)
      { company: 'Short A', role: 'PM', dates: 'January 2012 - June 2012', location: 'X' },                 // 2 (5mo, standalone short tenure)
      { company: 'Short B', role: 'PM', dates: 'March 2013 - August 2013', location: 'X' },                 // 3 (5mo, standalone short tenure; also the gap boundary)
    ],
  };

  it('REGRESSION: the opts-object call form ({ now }) works — the legacy positional-Date form is preserved alongside it', () => {
    // Old signature was `computeMasterIssues(master, now = new Date())`: a plain
    // options object passed as the second arg is not a Date, so `now.getFullYear`
    // would throw. The new signature must accept both without erroring.
    expect(() => computeMasterIssues(orderingMaster, { now: NOW })).not.toThrow();
    const viaOptsObject = computeMasterIssues(orderingMaster, { now: NOW });
    const viaLegacyDate = computeMasterIssues(orderingMaster, NOW);
    expect(viaOptsObject).toEqual(viaLegacyDate);
    expect(viaOptsObject.length).toBeGreaterThan(0);
  });

  it('ranks overlap first, then gap, then short_tenure', () => {
    const issues = computeMasterIssues(orderingMaster, { now: NOW });
    const kinds = issues.map((i) => i.kind);
    expect(kinds).toContain('overlap');
    expect(kinds).toContain('gap');
    expect(kinds).toContain('short_tenure');

    const overlapPos = kinds.indexOf('overlap');
    const gapPos = kinds.indexOf('gap');
    const shortPos = kinds.indexOf('short_tenure');
    expect(overlapPos).toBeLessThan(gapPos);
    expect(gapPos).toBeLessThan(shortPos);

    // computeMasterIssues does NOT truncate — callers/tests see the full set.
    expect(issues.map((i) => i.id)).toEqual(['overlap-0', 'gap-3', 'gap-0', 'short-2', 'short-3']);
  });
});

// ---------------------------------------------------------------------------
// TASK 2 — analysis-assisted context/suggestion, purely textual, never AI.
// ---------------------------------------------------------------------------
describe('computeMasterIssues — analysis context/suggestion attachment', () => {
  it('attaches context + a merge suggestion to the overlap issue when the analysis text names the roles and proposes "delivered under"', () => {
    const analysis = {
      analysis: {
        scan_snags: [],
        hr_first_seconds: '',
        nuance_clarifications: [
          'Salsita Software and wflow.com sit directly above the Nik Page Experience Strategy & Design consultancy, and both were plausibly delivered under that ongoing engagement rather than held separately.',
        ],
        red_flags: [],
      },
    };
    const issues = computeMasterIssues(realMaster, { now: NOW, analysis });
    const overlap = issues.find((i) => i.kind === 'overlap');
    expect(overlap.context).toBe(
      'Salsita Software and wflow.com sit directly above the Nik Page Experience Strategy & Design consultancy, and both were plausibly delivered under that ongoing engagement rather than held separately.'
    );
    expect(overlap.suggestion).toBe('merge');
  });

  it('attaches context + a verbatim-option suggestion to a short-tenure issue when the analysis names the option', () => {
    const m = {
      experience: [
        { company: 'Acme', role: 'PM', dates: 'March 2024 - October 2024', location: 'Berlin' },
        { company: 'Globex', role: 'PM', dates: 'January 2020 - February 2024', location: 'Berlin' },
      ],
    };
    const analysis = {
      analysis: {
        scan_snags: [{ point: 'Acme | Mar 2024 – Oct 2024', detail: 'Company restructuring / layoff ended this 7-month stint at Acme.' }],
        hr_first_seconds: '',
        nuance_clarifications: [],
        red_flags: [],
      },
    };
    const issues = computeMasterIssues(m, { now: NOW, analysis });
    const short = issues.find((i) => i.kind === 'short_tenure');
    expect(short.context).toBe('Acme | Mar 2024 – Oct 2024 — Company restructuring / layoff ended this 7-month stint at Acme.');
    expect(short.suggestion).toBe('Company restructuring / layoff');
  });

  it('omits context/suggestion when nothing in the analysis text names the entry (no fabrication)', () => {
    const m = {
      experience: [
        { company: 'Acme', role: 'PM', dates: 'March 2024 - October 2024', location: 'Berlin' },
        { company: 'Globex', role: 'PM', dates: 'January 2020 - February 2024', location: 'Berlin' },
      ],
    };
    const analysis = {
      analysis: {
        nuance_clarifications: ['This candidate has strong SQL skills.'], // unrelated to any entry
      },
    };
    const issues = computeMasterIssues(m, { now: NOW, analysis });
    const short = issues.find((i) => i.kind === 'short_tenure');
    expect(short.context).toBeUndefined();
    expect(short.suggestion).toBeUndefined();
  });

  it('a malformed or absent analysis leaves issues exactly as they are today, and never throws', () => {
    const baseline = computeMasterIssues(realMaster, { now: NOW });

    expect(() => computeMasterIssues(realMaster, { now: NOW, analysis: 'not even json {' })).not.toThrow();
    expect(computeMasterIssues(realMaster, { now: NOW, analysis: 'not even json {' })).toEqual(baseline);

    expect(() => computeMasterIssues(realMaster, { now: NOW, analysis: null })).not.toThrow();
    expect(computeMasterIssues(realMaster, { now: NOW, analysis: null })).toEqual(baseline);

    expect(() => computeMasterIssues(realMaster, { now: NOW, analysis: { analysis: { scan_snags: 'not-an-array' } } })).not.toThrow();
    expect(computeMasterIssues(realMaster, { now: NOW, analysis: { analysis: { scan_snags: 'not-an-array' } } })).toEqual(baseline);

    expect(() => computeMasterIssues(realMaster, { now: NOW, analysis: {} })).not.toThrow();
    expect(computeMasterIssues(realMaster, { now: NOW, analysis: {} })).toEqual(baseline);
  });
});
