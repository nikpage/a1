import { describe, it, expect } from 'vitest';
import { mergeAdditions } from '../utils/master-schema';

// The augment prompt IS the build prompt, and the build never nests: it returns
// every client engagement flat at the top level. Merging that back against a
// stored record whose engagements are nested must not read them as new roles.
describe('mergeAdditions with nested client engagements', () => {
  const stored = {
    profile: { name: 'Nik Page' },
    work_experience: [
      {
        title: 'Consultant / Fractional Leader',
        company: 'Nik Page Ltd.',
        start_date: 'August 2016',
        end_date: 'Present',
        bullets: ['Led product discovery for client teams.'],
        fractional_engagements: [
          {
            title: 'Head of Product & Delivery',
            company: 'SpecialAgents',
            start_date: 'January 2026',
            end_date: 'Present',
            bullets: ['Built RAG-based semantic search.'],
            fractional_engagements: [],
          },
          {
            title: 'Head of Product Research & Design',
            company: 'wflow.com',
            start_date: 'January 2022',
            end_date: 'October 2022',
            bullets: ['Established market intelligence methodologies.'],
            fractional_engagements: [],
          },
        ],
      },
      {
        title: 'Head of Experience Design',
        company: 'Česká spořitelna',
        start_date: 'July 2014',
        end_date: 'August 2016',
        bullets: ['Recruited and managed an Experience Design department.'],
        fractional_engagements: [],
      },
    ],
  };

  // What the re-extraction actually returns: the umbrella with its engagements
  // emptied, and each engagement hoisted to the top level.
  const flatAugmented = {
    profile: { name: 'Nik Page' },
    work_experience: [
      {
        title: 'Consultant / Fractional Leader',
        company: 'Nik Page Ltd.',
        start_date: 'August 2016',
        end_date: 'Present',
        bullets: ['Led product discovery for client teams.'],
        fractional_engagements: [],
      },
      {
        title: 'Head of Product & Delivery',
        company: 'SpecialAgents',
        start_date: 'Jan 2026',
        end_date: 'Present',
        bullets: ['Built RAG-based semantic search.'],
        fractional_engagements: [],
      },
      {
        title: 'Head of Product Research & Design',
        company: 'wflow.com',
        start_date: '01/2022',
        end_date: 'October 2022',
        bullets: ['Established market intelligence methodologies.'],
        fractional_engagements: [],
      },
      {
        title: 'Head of Experience Design',
        company: 'Česká spořitelna',
        start_date: 'July 2014',
        end_date: 'August 2016',
        bullets: ['Recruited and managed an Experience Design department.'],
        fractional_engagements: [],
      },
    ],
  };

  it('does not hoist an already-nested engagement to the top level', () => {
    const merged = mergeAdditions(stored, flatAugmented);
    const companies = merged.work_experience.map((r) => r.company);
    expect(companies).toEqual(['Nik Page Ltd.', 'Česká spořitelna']);
  });

  it('leaves the nested engagements themselves intact', () => {
    const merged = mergeAdditions(stored, flatAugmented);
    const nested = merged.work_experience[0].fractional_engagements.map((r) => r.company);
    expect(nested).toEqual(['SpecialAgents', 'wflow.com']);
  });

  it('stays stable when the same note is added twice', () => {
    const once = mergeAdditions(stored, flatAugmented);
    const twice = mergeAdditions(once, flatAugmented);
    expect(twice.work_experience.map((r) => r.company)).toEqual(['Nik Page Ltd.', 'Česká spořitelna']);
  });

  it('still appends a role the record genuinely does not hold', () => {
    const withNew = {
      ...flatAugmented,
      work_experience: [
        ...flatAugmented.work_experience,
        {
          title: 'Process Automation Consultant',
          company: 'Fintech Client',
          start_date: 'March 2021',
          end_date: 'December 2021',
          bullets: ['Cut manual handling error with AI-enriched automation.'],
          fractional_engagements: [],
        },
      ],
    };
    const merged = mergeAdditions(stored, withNew);
    expect(merged.work_experience.map((r) => r.company)).toContain('Fintech Client');
  });
});
