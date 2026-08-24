// The prose renderer must lose NOTHING. The master is the only source of fact
// for both generators and the evidence set the truth passes check against, so a
// value dropped here is a real achievement that can never reach a document, and
// a value altered here is a claim the validator can no longer trace.
import { describe, it, expect } from 'vitest';
import { masterToProse } from '../utils/master-prose.js';

const master = {
  profile: {
    name: 'Jana Nováková',
    headline: 'Product Lead',
    location: 'Prague, CZ',
    contact: { email: 'j@n.cz', phone: '+420 111 222 333', linkedin: 'linkedin.com/in/jn' },
    languages: [{ language: 'Czech', proficiency: 'Native' }],
    top_skills: ['Discovery', 'Pricing'],
    certifications: ['Design Sprint Master']
  },
  work_experience: [
    {
      title: 'Founder',
      company: 'Nováková Ltd.',
      start_date: 'March 2015',
      end_date: 'Present',
      location: 'Prague, CZ',
      bullets: ['Ran the practice solo.', 'Grew billing from $20,000 to $120,000 a month.'],
      fractional_engagements: [
        {
          title: 'Head of Product',
          company: 'Klient s.r.o.',
          start_date: 'January 2019',
          end_date: 'June 2020',
          bullets: ['Rebuilt the onboarding flow.'],
          fractional_engagements: []
        }
      ]
    }
  ],
  speaking_and_lecturing: [{ role: 'Lecturer', topic: 'Service design', event: 'WebExpo', location: 'Prague', year: 2017 }],
  education: [{ qualification: 'MSc', institution: 'Charles University', dates: '2004 – 2009' }],
  publications_and_patents: [{ title: 'On discovery', publisher: 'UX Mag', year: 2016 }]
};

const everyString = (node, out = []) => {
  if (Array.isArray(node)) node.forEach((n) => everyString(n, out));
  else if (node && typeof node === 'object') Object.values(node).forEach((n) => everyString(n, out));
  else if (typeof node === 'string' && node.trim()) out.push(node.trim());
  return out;
};

describe('masterToProse', () => {
  it('carries every string value from the record into the prose', () => {
    const prose = masterToProse(master);
    for (const value of everyString(master)) {
      expect(prose, `dropped: ${value}`).toContain(value);
    }
  });

  it('carries a nested engagement with its own dates, not merged into its parent', () => {
    const prose = masterToProse(master);
    expect(prose).toContain('Head of Product — Klient s.r.o. (January 2019 – June 2020)');
    expect(prose).toContain('Rebuilt the onboarding flow.');
  });

  it('emits no JSON punctuation — this is the whole point of the module', () => {
    const prose = masterToProse(master);
    expect(prose).not.toMatch(/[{}]|"\w+":/);
  });

  it('never invents a date range where the record has only one end', () => {
    const prose = masterToProse({ work_experience: [{ title: 'Advisor', company: 'X', start_date: 'June 2018', bullets: [] }] });
    expect(prose).toContain('Advisor — X (June 2018)');
    expect(prose).not.toContain('–');
  });

  it('returns empty for a missing or unparseable record rather than guessing', () => {
    expect(masterToProse(null)).toBe('');
    expect(masterToProse('not a record')).toBe('');
  });
});
