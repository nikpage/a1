// utils/master-flags.test.js
//
// Real behaviour tests for the master-CV mutation core. These call the actual
// functions and assert on the real returned record. No mocks — the unit under
// test is pure.

import { describe, it, expect } from 'vitest';
import {
  applySingleFix,
  applyStructuralMerge,
  resolveFlag,
} from './master-flags.js';

function sampleMaster() {
  return {
    identity: { country: 'Czechia', contact: { email: 'a@b.cz' } },
    candidate_core: 'A product leader.',
    experience: [
      { company: 'Salsita', role: 'PM', dates: 'Nov 2022 – Oct 2023', location: 'Prague', achievements: [{ text: 'Shipped X' }] },
      { company: 'Client X', role: 'Consultant', dates: '2020 – 2021', location: 'Remote', achievements: [{ text: 'Did Y' }] },
      { company: 'Client Y', role: 'Consultant', dates: '2019 – 2020', location: 'Remote', achievements: [{ text: 'Did Z' }] },
    ],
    voice_samples: ['I build things that ship.', 'No fluff.'],
  };
}

describe('applySingleFix', () => {
  it('sets exactly the targeted experience field and nothing else', () => {
    const before = sampleMaster();
    const after = applySingleFix(before, { section: 'experience', index: 0, field: 'role' }, 'Senior Product Manager');

    expect(after.experience[0].role).toBe('Senior Product Manager');
    // every other field on that entry is unchanged
    expect(after.experience[0].company).toBe('Salsita');
    expect(after.experience[0].dates).toBe('Nov 2022 – Oct 2023');
    // other entries untouched
    expect(after.experience[1]).toEqual(before.experience[1]);
    // voice samples never touched
    expect(after.voice_samples).toEqual(before.voice_samples);
  });

  it('does not mutate the input master', () => {
    const before = sampleMaster();
    applySingleFix(before, { section: 'identity', field: 'country' }, 'Poland');
    expect(before.identity.country).toBe('Czechia');
  });

  it('corrects identity.country', () => {
    const after = applySingleFix(sampleMaster(), { section: 'identity', field: 'country' }, 'Poland');
    expect(after.identity.country).toBe('Poland');
  });

  it('throws on an out-of-range experience index', () => {
    expect(() => applySingleFix(sampleMaster(), { section: 'experience', index: 9, field: 'role' }, 'x'))
      .toThrow(/out of range/);
  });

  it('refuses to edit a non-whitelisted experience field (e.g. achievements)', () => {
    expect(() => applySingleFix(sampleMaster(), { section: 'experience', index: 0, field: 'achievements' }, 'x'))
      .toThrow(/not editable/);
  });
});

describe('applyStructuralMerge', () => {
  it('nests the two consultancy stints under one parent and deletes nothing', () => {
    const before = sampleMaster();
    const after = applyStructuralMerge(before, {
      parent: { company: 'Independent Consulting', role: 'Founder', dates: '2019 – 2021' },
      childIndexes: [1, 2],
      note: 'Both were contracts under my consulting practice.',
    });

    // Salsita (index 0) survives as its own entry; the two stints collapse to one parent.
    expect(after.experience).toHaveLength(2);
    const parent = after.experience.find((e) => e.company === 'Independent Consulting');
    expect(parent).toBeTruthy();
    // the two originals are preserved verbatim underneath
    expect(parent.contracts).toHaveLength(2);
    expect(parent.contracts[0].company).toBe('Client X');
    expect(parent.contracts[1].company).toBe('Client Y');
    // the user's clarification is carried for the generator
    expect(parent.merge_note).toMatch(/consulting practice/);
    // voice samples untouched
    expect(after.voice_samples).toEqual(before.voice_samples);
  });

  it('throws if the merge hint has no parent company', () => {
    expect(() => applyStructuralMerge(sampleMaster(), { parent: {}, childIndexes: [1] }))
      .toThrow(/parent/);
  });
});

describe('resolveFlag', () => {
  it('accept on a single flag applies the AI proposed_value', () => {
    const flag = { type: 'single', target: { section: 'experience', index: 0, field: 'role' }, proposed_value: 'Senior PM' };
    const after = resolveFlag(sampleMaster(), flag, { decision: 'accept' });
    expect(after.experience[0].role).toBe('Senior PM');
  });

  it('edit on a single flag applies the user value, not the proposal', () => {
    const flag = { type: 'single', target: { section: 'experience', index: 0, field: 'role' }, proposed_value: 'Senior PM' };
    const after = resolveFlag(sampleMaster(), flag, { decision: 'edit', value: 'Lead PM' });
    expect(after.experience[0].role).toBe('Lead PM');
  });

  it('reject on a single flag leaves the record unchanged', () => {
    const before = sampleMaster();
    const flag = { type: 'single', target: { section: 'experience', index: 0, field: 'role' }, proposed_value: 'Senior PM' };
    const after = resolveFlag(before, flag, { decision: 'reject' });
    expect(after).toEqual(before);
  });

  it('merge on a structural flag nests using the merge hint and the free-text note', () => {
    const flag = {
      type: 'structural',
      merge: { parent: { company: 'Independent Consulting', dates: '2019 – 2021' }, child_indexes: [1, 2] },
    };
    const after = resolveFlag(sampleMaster(), flag, { decision: 'merge', value: 'My consulting practice.' });
    const parent = after.experience.find((e) => e.company === 'Independent Consulting');
    expect(parent.contracts).toHaveLength(2);
    expect(parent.merge_note).toBe('My consulting practice.');
  });
});
