// prompts/master-cv.test.js
import { describe, it, expect } from 'vitest';
import { buildMasterCvPrompt, buildMasterAugmentPrompt } from './master-cv.js';

const joined = (messages) => messages.map((m) => m.content).join('\n\n');

describe('buildMasterCvPrompt — build mode does not interpret structure', () => {
  const prompt = joined(buildMasterCvPrompt({ mode: 'build', rawInput: 'some CV text' }));

  it('no longer carries a "concurrent" field for the cheap model to set', () => {
    // The build used to ask the model to flag roles concurrent:true — a structural
    // judgment that then drove every downstream pass. It must be gone.
    expect(prompt).not.toMatch(/concurrent/i);
  });

  it('forbids merging overlapping roles into one consultancy', () => {
    expect(prompt).toMatch(/do not infer structure/i);
    expect(prompt).toMatch(/consultancy|engagement|contract/i);
  });

  it('routes overlapping roles to a role_overlap open question instead of resolving them', () => {
    expect(prompt).toContain('role_overlap');
  });
});

// A real upload filed "Visiting Lecturer, Faculty of Arts, Charles University"
// into education[] — a teaching appointment read as a qualification because the
// institution was a university. Education carries only what was AWARDED.
describe('buildMasterCvPrompt — a teaching appointment is employment, not education', () => {
  it('says so in build mode', () => {
    const prompt = joined(buildMasterCvPrompt({ mode: 'build', rawInput: 'some CV text' }));
    expect(prompt).toMatch(/ONLY qualifications AWARDED TO this person/);
    expect(prompt).toMatch(/teach, lecture, guest-lecture or examine AT an institution is employment/);
    expect(prompt).toMatch(/goes in experience\[\], never here/);
  });

  it('routes it to experience[], not parallel_experience, in the augment path', () => {
    const prompt = joined(
      buildMasterAugmentPrompt({ master: { experience: [] }, text: 'taught a course at a university' })
    );
    expect(prompt).toMatch(/is employment, not a qualification — never education/);
    expect(prompt).toMatch(/A named teaching appointment with an employer and dates is a role/);
  });
});

// A real record lost the dates off three roles and gained locations for seven.
// Both came from the same compact EARLIER CAREER block, which packs several
// roles onto one line with their years in brackets and no location at all:
// the extractor split the line, dropped the bracketed years from some of the
// fragments, and filled the missing locations from what it knew about the
// employers (AVG → Brno, Wells Fargo → San Francisco).
describe('buildMasterCvPrompt — compact earlier-career lines', () => {
  const prompt = joined(buildMasterCvPrompt({ mode: 'build', rawInput: 'some CV text' }));

  it('tells the model a multi-role line is several roles, each with its own dates', () => {
    expect(prompt).toMatch(/several to a LINE/i);
    expect(prompt).toMatch(/Split on the separator/i);
    expect(prompt).toMatch(/belong to the fragment they sit in/i);
  });

  it('treats a dropped date as an extraction failure, not a gap', () => {
    expect(prompt).toMatch(/extraction failure, not a gap/i);
  });

  it('forbids inferring a location from the employer', () => {
    expect(prompt).toMatch(/NEVER infer a location/);
    expect(prompt).toMatch(/headquartered/i);
    expect(prompt).toMatch(/leave "location": ""/);
  });
});

// gaps were declared as a bare [] beside a fully typed conflicts sibling, so the
// cheap model wrote them as objects — which one editor save then coerced into
// eight literal "[object Object]" strings.
describe('buildMasterCvPrompt — gaps are typed', () => {
  it('declares gaps as plain strings, never objects', () => {
    const prompt = joined(buildMasterCvPrompt({ mode: 'build', rawInput: 'some CV text' }));
    expect(prompt).toMatch(/ARRAY OF PLAIN STRINGS — never objects/);
  });
});
