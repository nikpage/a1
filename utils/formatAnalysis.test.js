import { isTeaserShaped, formatAnalysis } from './formatAnalysis.js';

// A landing-page teaser: verdicts and cv_data, no deep-pass delta.
const teaser = JSON.stringify({
  candidate_core: 'A veteran technology leader.',
  cv_data: { Name: 'Nik Page', Seniority: 'Senior', Industry: 'Tech', Country: 'Czechia' },
  analysis: {
    hr_first_seconds: 'Prague-based fractional lead.',
    scan_verdict: 'pass',
    scan_reason: 'Clear positioning.',
    scenario_tags: ['Senior Portfolio / Independent Consultant'],
  },
});

const deep = JSON.stringify({
  candidate_core: 'A veteran technology leader.',
  cv_data: { Name: 'Nik Page', Seniority: 'Senior', Industry: 'Tech', Country: 'Czechia' },
  analysis: {
    hr_first_seconds: 'Prague-based fractional lead.',
    scan_verdict: 'pass',
    overall_score: '7',
    ats_score: '6',
    red_flags: 'Nested fractional layout.',
  },
});

describe('isTeaserShaped', () => {
  it('is true for a teaser-only record (no overall_score)', () => {
    expect(isTeaserShaped(teaser)).toBe(true);
  });

  it('is false once the deep pass has supplied a score', () => {
    expect(isTeaserShaped(deep)).toBe(false);
  });

  it('treats the schema placeholder as an absent score', () => {
    // formatAnalysis fills a missing score with the literal "0-10", so a record
    // that has already been through it must still read as teaser-shaped.
    expect(isTeaserShaped(formatAnalysis(teaser))).toBe(true);
  });

  it('is false for unparseable input rather than triggering a re-analysis', () => {
    expect(isTeaserShaped('not json at all')).toBe(false);
    expect(isTeaserShaped('')).toBe(false);
  });
});
