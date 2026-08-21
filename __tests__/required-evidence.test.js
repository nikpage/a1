import { describe, it, expect } from 'vitest';
import { validateCv } from '../utils/cv-validate';

// A CV generated for a Bitcoin company dropped all three of the candidate's
// crypto engagements: they live under an umbrella practice, so the writer
// collapsed the umbrella into a handful of bullets and kept the recent
// unrelated ones. Every other check asks whether what IS printed is true, and
// silently deleted work is true — so nothing saw it.
describe('check 14 — evidence the analysis called essential', () => {
  const master = {
    profile: { name: 'Nik Page' },
    work_experience: [
      {
        title: 'Consultant',
        company: 'Nik Page Ltd.',
        start_date: 'August 2016',
        end_date: 'Present',
        bullets: ['Led product discovery for client teams.'],
        fractional_engagements: [
          { title: 'Advisor', company: 'BLOCKS', start_date: 'May 2018', end_date: 'November 2018', bullets: ['Set the launch experience strategy.'], fractional_engagements: [] },
          { title: 'Head of Product', company: 'SpecialAgents', start_date: 'January 2026', end_date: 'Present', bullets: ['Built RAG-based search.'], fractional_engagements: [] },
        ],
      },
    ],
  };

  const analysisWith = (required) => ({
    generation_framework: { cv_blueprint: { required_evidence: required, section_order: ['Summary', 'Work Experience'] } },
  });

  const docWithout = `### Summary
Product leader.

### Work Experience

#### Consultant
**Nik Page Ltd.** | 08/2016 - Present
- Built RAG-based search at SpecialAgents.
`;

  const docWith = `${docWithout}- Set the launch experience strategy for BLOCKS.\n`;

  const codes = (r) => r.warnings.map((w) => w.code);

  it('warns when a named engagement never reaches the document', () => {
    const r = validateCv(docWithout, {
      master,
      analysis: analysisWith([
        { evidence: 'BLOCKS', requirement: 'crypto product experience' },
        { evidence: 'SpecialAgents', requirement: 'builds AI systems' },
      ]),
      language: 'en',
    });
    expect(codes(r)).toContain('requiredEvidenceMissing');
    const w = r.warnings.find((x) => x.code === 'requiredEvidenceMissing');
    expect(w.params.list).toContain('BLOCKS');
    expect(w.params.list).not.toContain('SpecialAgents');
  });

  it('stays silent once the evidence is in the document', () => {
    const r = validateCv(docWith, {
      master,
      analysis: analysisWith([
        { evidence: 'BLOCKS', requirement: 'crypto product experience' },
        { evidence: 'SpecialAgents', requirement: 'builds AI systems' },
      ]),
      language: 'en',
    });
    expect(codes(r)).not.toContain('requiredEvidenceMissing');
  });

  it('matches through diacritics and inflection', () => {
    const doc = `### Summary\nProduct leader.\n\n### Work Experience\n\n#### Head of Experience Design\n**Ceska sporitelny** | 07/2014 - 08/2016\n- Built the UX practice.\n`;
    const r = validateCv(doc, {
      master,
      analysis: analysisWith([{ evidence: 'Česká spořitelna', requirement: 'regulated banking' }]),
      language: 'en',
    });
    expect(codes(r)).not.toContain('requiredEvidenceMissing');
  });

  it('reports nothing when the analysis named no required evidence', () => {
    const r = validateCv(docWithout, { master, analysis: analysisWith([]), language: 'en' });
    expect(codes(r)).not.toContain('requiredEvidenceMissing');
  });
});
