// utils/master-flags.test.js
//
// Real behaviour tests for the master-CV mutation core. These call the actual
// functions and assert on the real returned record. No mocks — the unit under
// test is pure.

import { describe, it, expect } from 'vitest';
import { applySingleFix, applyClarification, resolveFlag } from './master-flags.js';

const role = (company, title, start_date, end_date, location = 'Prague, CZ', engagements = []) => ({
  company, title, start_date, end_date, location,
  bullets: [`Worked at ${company}`],
  fractional_engagements: engagements,
});

function sampleMaster() {
  return {
    profile: { name: 'Nik Page', headline: 'Product leader', location: 'Prague, CZ', contact: { email: 'a@b.cz' } },
    work_experience: [
      role('Salsita', 'PM', 'November 2022', 'October 2023'),
      role('Client X', 'Consultant', '2020', '2021', 'Remote'),
      role('Client Y', 'Consultant', '2019', '2020', 'Remote'),
    ],
  };
}

// An umbrella role with its client engagements nested inside it — the shape the
// extraction produces, and the one an index into the flat list must respect.
function nestedMaster() {
  return {
    profile: { name: 'Nik Page', location: 'Prague, CZ' },
    work_experience: [
      role('Acme Consulting', 'Principal', 'January 2019', 'Present', 'Prague, CZ', [
        role('ShortCo', 'PM', 'March 2022', 'January 2023'),
        role('OtherCo', 'PM', 'February 2023', 'December 2023'),
      ]),
      role('Bank', 'Head of UX', 'January 2014', 'December 2018'),
    ],
  };
}

describe('applyClarification', () => {
  it('records the answer against the targeted role', () => {
    const after = applyClarification(sampleMaster(), { index: 0, note: 'Contract ended' });
    expect(after.clarifications).toHaveLength(1);
    expect(after.clarifications[0]).toMatchObject({ index: 0, company: 'Salsita', note: 'Contract ended' });
  });

  // The role objects are what the extraction wrote. A user's sentence about why
  // a job ended, stored inside one, is read as record content by every consumer
  // downstream — and lands on the CV as a bullet.
  it('never writes the answer into work_experience', () => {
    const after = applyClarification(sampleMaster(), { index: 0, note: 'Contract ended' });
    expect(JSON.stringify(after.work_experience)).not.toContain('Contract ended');
    expect(after.work_experience[0].bullets).toEqual(['Worked at Salsita']);
  });

  it('does not mutate the input master', () => {
    const before = sampleMaster();
    applyClarification(before, { index: 0, note: 'Contract ended' });
    expect(before.clarifications).toBeUndefined();
  });

  it('answering the same role twice replaces the earlier answer', () => {
    const once = applyClarification(sampleMaster(), { index: 0, note: 'First answer' });
    const twice = applyClarification(once, { index: 0, note: 'Actually, redundancy' });
    expect(twice.clarifications).toHaveLength(1);
    expect(twice.clarifications[0].note).toBe('Actually, redundancy');
  });

  // The index comes from roles(), which walks umbrella-then-engagements. An
  // answer landing on the wrong company is worse than no answer.
  it('resolves an index that points at a nested engagement', () => {
    const after = applyClarification(nestedMaster(), { index: 1, note: 'A client project' });
    expect(after.clarifications[0].company).toBe('ShortCo');
  });

  it('throws on an out-of-range index rather than silently doing nothing', () => {
    expect(() => applyClarification(sampleMaster(), { index: 9, note: 'x' })).toThrow(/out of range/);
  });

  it('throws on an empty note', () => {
    expect(() => applyClarification(sampleMaster(), { index: 0, note: '   ' })).toThrow(/note is required/);
  });
});

describe('applySingleFix', () => {
  it('sets exactly the targeted field and nothing else', () => {
    const before = sampleMaster();
    const after = applySingleFix(before, { section: 'experience', index: 0, field: 'end_date' }, 'December 2023');
    expect(after.work_experience[0].end_date).toBe('December 2023');
    expect(after.work_experience[0].start_date).toBe('November 2022');
    expect(after.work_experience[1]).toEqual(before.work_experience[1]);
  });

  it('reaches a nested engagement through the flat index', () => {
    const after = applySingleFix(nestedMaster(), { section: 'experience', index: 2, field: 'company' }, 'OtherCo Ltd');
    expect(after.work_experience[0].fractional_engagements[1].company).toBe('OtherCo Ltd');
    // The umbrella itself is untouched.
    expect(after.work_experience[0].company).toBe('Acme Consulting');
  });

  it('does not mutate the input master', () => {
    const before = sampleMaster();
    applySingleFix(before, { section: 'experience', index: 0, field: 'company' }, 'Renamed');
    expect(before.work_experience[0].company).toBe('Salsita');
  });

  it('corrects a profile field', () => {
    const after = applySingleFix(sampleMaster(), { section: 'profile', field: 'location' }, 'Warsaw, PL');
    expect(after.profile.location).toBe('Warsaw, PL');
  });

  it('refuses a field that is not on the whitelist', () => {
    expect(() =>
      applySingleFix(sampleMaster(), { section: 'experience', index: 0, field: 'bullets' }, 'nope')
    ).toThrow(/not editable/);
  });

  it('throws on an out-of-range index', () => {
    expect(() =>
      applySingleFix(sampleMaster(), { section: 'experience', index: 9, field: 'company' }, 'x')
    ).toThrow(/out of range/);
  });

  it('throws on an unknown section', () => {
    expect(() => applySingleFix(sampleMaster(), { section: 'nonsense' }, 'x')).toThrow(/unsupported section/);
  });
});

describe('resolveFlag', () => {
  const singleFlag = {
    type: 'single',
    target: { section: 'experience', index: 0, field: 'end_date' },
    proposed_value: 'December 2023',
  };

  it('accept applies the proposed value', () => {
    const after = resolveFlag(sampleMaster(), singleFlag, { decision: 'accept' });
    expect(after.work_experience[0].end_date).toBe('December 2023');
  });

  it('edit applies the user value, not the proposal', () => {
    const after = resolveFlag(sampleMaster(), singleFlag, { decision: 'edit', value: 'January 2024' });
    expect(after.work_experience[0].end_date).toBe('January 2024');
  });

  it('reject changes nothing', () => {
    const before = sampleMaster();
    const after = resolveFlag(before, singleFlag, { decision: 'reject' });
    expect(after).toEqual(before);
  });

  it('stores a clarify answer against the flagged role', () => {
    const flag = { type: 'clarify', kind: 'short_tenure', target: { section: 'experience', index: 0 } };
    const after = resolveFlag(sampleMaster(), flag, { decision: 'option', value: 'Contract / fixed-term role ended' });
    expect(after.clarifications[0]).toMatchObject({ index: 0, note: 'Contract / fixed-term role ended' });
  });

  it('rejects a clarify with no answer', () => {
    const flag = { type: 'clarify', target: { section: 'experience', index: 0 } };
    expect(() => resolveFlag(sampleMaster(), flag, { decision: 'option', value: '' })).toThrow(/answer is required/);
  });

  // The structural merge is gone: the extraction nests a client engagement under
  // its consultancy itself, so a merge on top of that would fold an already
  // nested record a second time.
  it('refuses a structural flag rather than silently doing nothing', () => {
    const flag = { type: 'structural', target: { section: 'experience', index: 0 } };
    expect(() => resolveFlag(sampleMaster(), flag, { decision: 'merge' })).toThrow(/unknown flag type/);
  });
});
