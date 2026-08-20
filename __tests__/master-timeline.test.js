// The timeline is COUNTED IN CODE. This is red on the old code, where nothing
// counted it and the model reported "apparent job-hopping — Salsita 11 months,
// wflow 10 months, BLOCKS 6 months" about a person who has held exactly one
// thing since 2016: their own practice, with those three delivered inside it.
import { describe, test, expect } from 'vitest';
import { timelineFacts, timelineBlock, monthsFrom } from '../utils/master-timeline.js';

const NOW = new Date('2026-08-20');

const MASTER = {
  work_experience: [
    {
      company: 'Nik Page Ltd.', title: 'Consultant',
      start_date: 'August 2016', end_date: 'Present',
      fractional_engagements: [
        { company: 'Salsita', title: 'Sr. PM', start_date: 'November 2022', end_date: 'October 2023' },
        { company: 'BLOCKS', title: 'Advisor', start_date: 'May 2018', end_date: 'November 2018' },
      ],
    },
    { company: 'Česká spořitelna', title: 'Head of Experience Design', start_date: 'July 2014', end_date: 'August 2016' },
    { company: 'Monster', title: 'UX Lead', start_date: 'February 2003', end_date: 'March 2008' },
  ],
};

describe('timelineFacts', () => {
  const { entries, gaps } = timelineFacts(MASTER, NOW);

  test('counts POSITIONS, not engagements', () => {
    expect(entries).toHaveLength(3);
    expect(entries[0].engagements.map((e) => e.label)).toEqual(['Salsita — Sr. PM', 'BLOCKS — Advisor']);
  });

  test('an ongoing position runs to today; a nested engagement has no tenure of its own', () => {
    expect(entries[0].months).toBe(120); // August 2016 -> August 2026
    expect(entries[0].ongoing).toBe(true);
    expect(entries[0].engagements[0].months).toBeUndefined();
  });

  test('month precision, not year arithmetic', () => {
    expect(entries[1].months).toBe(25); // 07/2014 -> 08/2016
  });

  test('a gap is a stretch nothing covers — engagement work counts as coverage', () => {
    // 03/2008 -> 07/2014 is the only real gap; the 2018 and 2022 engagements sit
    // inside the practice's own span and can never open one.
    expect(gaps).toHaveLength(1);
    expect(gaps[0].months).toBe(76);
  });

  test('year-only dates are read to report the FEWEST gaps, never to invent one', () => {
    const { gaps: g } = timelineFacts({
      work_experience: [
        { company: 'A', start_date: '1997', end_date: '2000' },
        { company: 'B', start_date: '2000', end_date: '2001' },
      ],
    }, NOW);
    expect(g).toEqual([]);
    expect(monthsFrom('1997', false)).toBe(1997 * 12 + 1);
    expect(monthsFrom('1997', true)).toBe(1997 * 12 + 12);
  });

  test('numeric and Czech dates parse', () => {
    expect(monthsFrom('08/2016')).toBe(2016 * 12 + 8);
    expect(monthsFrom('2016-08')).toBe(2016 * 12 + 8);
    expect(monthsFrom('srpen 2016')).toBe(2016 * 12 + 8);
  });
});

describe('timelineBlock', () => {
  const block = timelineBlock(MASTER, NOW);

  test('states the count, nests the engagements and denies them a tenure', () => {
    expect(block).toContain('Positions actually held: 3');
    expect(block).toMatch(/Nik Page Ltd\..*\(10 yr, ongoing\) — ONE position, with 2 client engagements/);
    expect(block).toMatch(/Salsita.*NOT a separate position, NOT a tenure/);
  });

  test('names the real gap and forbids recounting', () => {
    expect(block).toContain('03/2008 → 07/2014');
    expect(block).toMatch(/AUTHORITATIVE\. Do not recount it/);
    expect(block).toMatch(/is a factual error about this person/);
  });

  test('no record, no block — it never states a fact it could not compute', () => {
    expect(timelineBlock({}, NOW)).toBe('');
    expect(timelineBlock(null, NOW)).toBe('');
  });
});
