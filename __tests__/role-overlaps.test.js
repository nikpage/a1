// __tests__/role-overlaps.test.js
//
// The master build no longer nests: it reports each overlapping pair in
// `role_overlaps` and the PERSON answers on /me. These tests pin the two halves
// of that — the schema gate that carries the open questions safely through an
// ordinary record edit, and applyOverlapAnswer(), the only thing in the codebase
// that may move a role into an umbrella's fractional_engagements.

import { normaliseMaster, applyOverlapAnswer } from '../utils/master-schema.js';

// Umbrella at index 0, two roles dated inside its span, one ordinary earlier job.
const MASTER = {
  profile: { name: 'Nik Page' },
  work_experience: [
    { company: 'Nik Page Ltd.', title: 'Founder', start_date: '2016', end_date: 'Present', bullets: [], fractional_engagements: [] },
    { company: 'Salsita', title: 'Product Lead', start_date: '2021', end_date: '2022', bullets: ['Shipped it'], fractional_engagements: [] },
    { company: 'wflow', title: 'Head of Product', start_date: '2023', end_date: '2024', bullets: [], fractional_engagements: [] },
    { company: 'Older Co', title: 'PM', start_date: '2010', end_date: '2012', bullets: [], fractional_engagements: [] },
  ],
  role_overlaps: [
    { umbrella_index: 0, role_index: 1, answer: '' },
    { umbrella_index: 0, role_index: 2, answer: '' },
  ],
};

const clone = (o) => JSON.parse(JSON.stringify(o));

describe('normaliseMaster and role_overlaps', () => {
  test('keeps the open questions when the editor submits a record without them', () => {
    const edited = clone(MASTER);
    delete edited.role_overlaps; // the record editor renders no field for them
    const out = normaliseMaster(edited, MASTER);
    expect(out.role_overlaps).toEqual(MASTER.role_overlaps);
  });

  test('takes the submitted questions when they are present, which is how an answer is recorded', () => {
    const edited = clone(MASTER);
    edited.role_overlaps[0].answer = 'separate';
    const out = normaliseMaster(edited, MASTER);
    expect(out.role_overlaps[0].answer).toBe('separate');
    expect(out.role_overlaps[1].answer).toBe('');
  });

  test('drops an answer value it does not recognise and a pair with no usable indexes', () => {
    const out = normaliseMaster(
      {
        work_experience: MASTER.work_experience,
        role_overlaps: [
          { umbrella_index: 0, role_index: 1, answer: 'delete_everything' },
          { umbrella_index: 'x', role_index: 2 },
          { umbrella_index: 1, role_index: 1 },
        ],
      },
      MASTER
    );
    expect(out.role_overlaps).toEqual([{ umbrella_index: 0, role_index: 1, answer: '' }]);
  });
});

describe('applyOverlapAnswer', () => {
  test('"separate" records the answer and moves no role', () => {
    const out = applyOverlapAnswer(MASTER, 0, 'separate');
    expect(out.work_experience).toHaveLength(4);
    expect(out.work_experience[1].company).toBe('Salsita');
    expect(out.work_experience[0].fractional_engagements).toEqual([]);
    expect(out.role_overlaps[0].answer).toBe('separate');
  });

  test('"nested" moves the role under the umbrella and drops it from the timeline', () => {
    const out = applyOverlapAnswer(MASTER, 0, 'nested');
    expect(out.work_experience.map((r) => r.company)).toEqual(['Nik Page Ltd.', 'wflow', 'Older Co']);
    const nested = out.work_experience[0].fractional_engagements;
    expect(nested).toHaveLength(1);
    expect(nested[0].company).toBe('Salsita');
    expect(nested[0].bullets).toEqual(['Shipped it']);
    // one level only
    expect(nested[0].fractional_engagements).toEqual([]);
  });

  test('remaps the remaining questions onto the shortened array', () => {
    const out = applyOverlapAnswer(MASTER, 0, 'nested');
    const open = out.role_overlaps.filter((o) => !o.answer);
    expect(open).toHaveLength(1);
    // wflow sat at index 2 and is at index 1 now — an unremapped index would ask
    // the next question about "Older Co".
    expect(out.work_experience[open[0].role_index].company).toBe('wflow');
    expect(out.work_experience[open[0].umbrella_index].company).toBe('Nik Page Ltd.');
  });

  test('answering both nests both under the umbrella', () => {
    const once = applyOverlapAnswer(MASTER, 0, 'nested');
    const openIndex = once.role_overlaps.findIndex((o) => !o.answer);
    const twice = applyOverlapAnswer(once, openIndex, 'nested');
    expect(twice.work_experience.map((r) => r.company)).toEqual(['Nik Page Ltd.', 'Older Co']);
    expect(twice.work_experience[0].fractional_engagements.map((r) => r.company)).toEqual(['Salsita', 'wflow']);
  });

  test('does not mutate the record it was given', () => {
    const before = clone(MASTER);
    applyOverlapAnswer(MASTER, 0, 'nested');
    expect(MASTER).toEqual(before);
  });

  test('an already answered or out-of-range question changes nothing', () => {
    const answered = applyOverlapAnswer(MASTER, 0, 'separate');
    expect(applyOverlapAnswer(answered, 0, 'nested')).toBe(answered);
    expect(applyOverlapAnswer(MASTER, 9, 'nested')).toBe(MASTER);
    expect(
      applyOverlapAnswer({ ...MASTER, role_overlaps: [{ umbrella_index: 0, role_index: 99 }] }, 0, 'nested')
    ).toEqual({ ...MASTER, role_overlaps: [{ umbrella_index: 0, role_index: 99 }] });
  });

  test('refuses an answer that is neither of the two', () => {
    expect(() => applyOverlapAnswer(MASTER, 0, 'maybe')).toThrow();
  });
});
