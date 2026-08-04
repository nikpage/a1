// utils/master-flags.test.js
//
// Real behaviour tests for the master-CV mutation core. These call the actual
// functions and assert on the real returned record. No mocks — the unit under
// test is pure.

import { describe, it, expect } from 'vitest';
import {
  applySingleFix,
  applyStructuralMerge,
  applyClarification,
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

// An ongoing umbrella role (index 0) spanning two shorter stints — the exact
// shape the overlap question is asked about.
function overlapMaster() {
  return {
    identity: { country: 'Czechia' },
    experience: [
      { company: 'Acme Consulting', role: 'Principal', dates: 'Jan 2019 – Present', location: 'Prague', core_tags: ['consulting'], achievements: [{ text: 'Grew the practice' }] },
      { company: 'ShortCo', role: 'PM', dates: 'Mar 2022 – Jan 2023', achievements: [{ text: 'Shipped A' }] },
      { company: 'OtherCo', role: 'PM', dates: 'Feb 2023 – Dec 2023', achievements: [{ text: 'Shipped B' }] },
    ],
    voice_samples: ['I build things that ship.'],
  };
}

describe('applyClarification', () => {
  it('attaches the answer to the targeted role and leaves others untouched', () => {
    const before = sampleMaster();
    const after = applyClarification(before, { index: 0, note: 'Contract ended' });
    expect(after.experience[0].clarification).toBe('Contract ended');
    expect(after.experience[1].clarification).toBeUndefined();
    expect(before.experience[0].clarification).toBeUndefined(); // input not mutated
  });

  it('throws on an out-of-range index', () => {
    expect(() => applyClarification(sampleMaster(), { index: 9, note: 'x' }))
      .toThrow(/out of range/);
  });

  it('throws on an empty note', () => {
    expect(() => applyClarification(sampleMaster(), { index: 0, note: '   ' }))
      .toThrow(/note is required/);
  });
});

describe('resolveFlag clarify', () => {
  it('stores the chosen option onto the right experience entry', () => {
    const flag = { type: 'clarify', target: { section: 'experience', index: 0 }, options: ['Contract ended', 'Better opportunity'] };
    const after = resolveFlag(sampleMaster(), flag, { decision: 'option', value: 'Better opportunity' });
    expect(after.experience[0].clarification).toBe('Better opportunity');
  });

  it('reject leaves the master unchanged', () => {
    const flag = { type: 'clarify', target: { section: 'experience', index: 0 } };
    const after = resolveFlag(sampleMaster(), flag, { decision: 'reject' });
    expect(after.experience[0].clarification).toBeUndefined();
  });

  it('throws when the clarify flag has no target index', () => {
    const flag = { type: 'clarify', target: { section: 'experience' } };
    expect(() => resolveFlag(sampleMaster(), flag, { decision: 'option', value: 'x' }))
      .toThrow(/missing target.index/);
  });
});

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

  // REGRESSION: the merge used to insert a brand-new parent row while leaving the
  // parent's OWN existing row in place, so every overlap answer duplicated the
  // umbrella role — one copy holding the real achievements, the other holding the
  // contracts. Two rows for one employer, and the fuller one with nothing nested.
  it('folds into the parent\'s existing row instead of duplicating it', () => {
    const before = overlapMaster();
    const after = applyStructuralMerge(before, {
      parent: { company: 'Acme Consulting', role: 'Principal', dates: 'Jan 2019 – Present' },
      parentIndex: 0,
      childIndexes: [1, 2],
      note: 'Both delivered under Acme.',
    });

    const acme = after.experience.filter((e) => e.company === 'Acme Consulting');
    expect(acme).toHaveLength(1);                        // not two
    expect(acme[0].achievements).toEqual([{ text: 'Grew the practice' }]); // its own content kept
    expect(acme[0].core_tags).toEqual(['consulting']);
    expect(acme[0].contracts.map((c) => c.company)).toEqual(['ShortCo', 'OtherCo']);
    expect(acme[0].merge_note).toBe('Both delivered under Acme.');
    expect(after.experience).toHaveLength(1);
  });

  it('throws if the parent index is also listed as a child', () => {
    expect(() => applyStructuralMerge(overlapMaster(), {
      parent: { company: 'Acme Consulting' },
      parentIndex: 1,
      childIndexes: [1, 2],
    })).toThrow(/cannot also be a child/);
  });

  it('throws on an out-of-range parent index', () => {
    expect(() => applyStructuralMerge(overlapMaster(), {
      parent: { company: 'Acme Consulting' },
      parentIndex: 9,
      childIndexes: [1],
    })).toThrow(/parent index 9 out of range/);
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

  // REGRESSION: resolveFlag must hand the parent's own row position through, or
  // the merge duplicates the umbrella role. This is the shape computeMasterIssues
  // actually emits — target.index is the ongoing role, child_indexes are the others.
  it('merge passes the flag target index through so the umbrella role is not duplicated', () => {
    const flag = {
      type: 'structural',
      target: { section: 'experience', index: 0 },
      merge: {
        parent: { company: 'Acme Consulting', role: 'Principal', dates: 'Jan 2019 – Present' },
        child_indexes: [1, 2],
      },
    };
    const after = resolveFlag(overlapMaster(), flag, { decision: 'merge', value: 'Delivered under Acme.' });
    expect(after.experience).toHaveLength(1);
    expect(after.experience[0].company).toBe('Acme Consulting');
    expect(after.experience[0].achievements).toEqual([{ text: 'Grew the practice' }]);
    expect(after.experience[0].contracts).toHaveLength(2);
  });

  it('separate on a structural flag records a clarification on the ongoing role (no merge)', () => {
    const before = sampleMaster();
    const flag = {
      type: 'structural',
      target: { section: 'experience', index: 0 },
      merge: { parent: { company: 'X' }, child_indexes: [1, 2] },
    };
    const after = resolveFlag(before, flag, { decision: 'separate', value: 'Held these concurrently.' });
    // The note lands on the ongoing role; nothing is nested, the array is intact.
    expect(after.experience[0].clarification).toBe('Held these concurrently.');
    expect(after.experience).toHaveLength(before.experience.length);
    expect(after.experience.some((e) => Array.isArray(e.contracts))).toBe(false);
  });

  it('separate falls back to a default note when none is typed', () => {
    const flag = { type: 'structural', target: { section: 'experience', index: 0 }, merge: { parent: { company: 'X' }, child_indexes: [1] } };
    const after = resolveFlag(sampleMaster(), flag, { decision: 'separate' });
    expect(after.experience[0].clarification).toMatch(/separate/i);
  });
});
