// utils/master-issues.test.js
import { describe, it, expect } from 'vitest';
import { computeMasterIssues } from './master-issues.js';

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
