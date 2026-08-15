// utils/master-issues.test.js
import { describe, it, expect } from 'vitest';
import { computeMasterIssues } from './master-issues.js';

// Write a role the way the extraction emits it, from a single "start - end"
// string, so the fixtures below stay readable.
const role = (company, title, dates, location = 'Prague, CZ', engagements = []) => {
  const [start_date = '', end_date = ''] = String(dates).split(/\s+-\s+/);
  return { company, title, start_date, end_date, location, bullets: [], fractional_engagements: engagements };
};

describe('computeMasterIssues — the only question is the overlap', () => {
  // Flat record: nothing nested, the build reported the pair instead.
  const flatMaster = {
    work_experience: [
      role('Nik Page Experience Strategy & Design', 'Product Creator', 'August 2016 - Present'),
      role('Salsita Software', 'Sr. Product Manager', 'November 2022 - October 2023'),
      role('Česká spořitelna', 'Head of Experience Design', 'July 2014 - August 2016'),
    ],
    role_overlaps: [{ umbrella_index: 0, role_index: 1, answer: '' }],
  };

  it('asks the reported pair, once, as an overlap flag targeting the role', () => {
    const issues = computeMasterIssues(flatMaster);
    const overlaps = issues.filter((i) => i.kind === 'overlap');
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].type).toBe('overlap');
    expect(overlaps[0].question_index).toBe(0);
    expect(overlaps[0].target).toEqual({ section: 'experience', index: 1 });
    expect(overlaps[0].answers).toEqual(['nested', 'separate']);
    expect(overlaps[0].question).toContain('Salsita Software');
    expect(overlaps[0].question).toContain('Nik Page Experience Strategy & Design');
  });

  it('asks it first — answering it can settle the questions behind it', () => {
    const issues = computeMasterIssues(flatMaster);
    expect(issues[0].kind).toBe('overlap');
  });

  it('does not also ask why that 11-month role was short until it is settled', () => {
    const issues = computeMasterIssues(flatMaster);
    expect(issues.some((i) => i.kind === 'short_tenure' && i.target.index === 1)).toBe(false);
  });

  it('stops asking once the person has answered', () => {
    const answered = {
      ...flatMaster,
      role_overlaps: [{ umbrella_index: 0, role_index: 1, answer: 'separate' }],
    };
    expect(computeMasterIssues(answered).some((i) => i.kind === 'overlap')).toBe(false);
  });

  it('drops a pair whose indexes point at no role', () => {
    const broken = { ...flatMaster, role_overlaps: [{ umbrella_index: 0, role_index: 9, answer: '' }] };
    expect(computeMasterIssues(broken).some((i) => i.kind === 'overlap')).toBe(false);
  });

  it('targets the FLAT position, counting engagements nested under earlier entries', () => {
    const withNesting = {
      work_experience: [
        role('Nik Page Experience Strategy & Design', 'Product Creator', 'August 2016 - Present', 'Prague, CZ', [
          role('wflow.com', 'Head of Product Research', 'January 2022 - October 2022'),
        ]),
        role('Salsita Software', 'Sr. Product Manager', 'November 2022 - October 2023'),
      ],
      role_overlaps: [{ umbrella_index: 0, role_index: 1, answer: '' }],
    };
    const flag = computeMasterIssues(withNesting).find((i) => i.kind === 'overlap');
    // roles(): [practice, wflow (nested), Salsita] → Salsita is 2, not 1.
    expect(flag.target.index).toBe(2);
    expect(flag.question).toContain('Salsita Software');
  });
});
