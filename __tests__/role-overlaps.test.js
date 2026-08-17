// __tests__/role-overlaps.test.js
//
// The master build no longer nests: it reports each overlapping pair in
// `role_overlaps` and the PERSON answers on /me. These tests pin the two halves
// of that — the schema gate that carries the open questions safely through an
// ordinary record edit, and applyOverlapAnswer(), the only thing in the codebase
// that may move a role into an umbrella's fractional_engagements.

import { normaliseMaster, applyOverlapAnswer, roleKey } from '../utils/master-schema.js';
import { computeMasterIssues } from '../utils/master-issues.js';

// Address a question the way the UI does: by the identity of the two roles it
// concerns, read off the open question the app actually rendered.
const ask = (master, company) => {
  const flag = computeMasterIssues(master).find((f) => f.question.includes(company));
  if (!flag) throw new Error(`no open question about ${company}`);
  return { role_key: flag.role_key, umbrella_key: flag.umbrella_key };
};

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

  // Red on the old code, which let the submission win: the editor's draft is a
  // copy taken before the questions were answered, so saving an unrelated edit
  // wiped the answers and reopened settled questions.
  test('ignores questions submitted by the editor — the stored answers win', () => {
    const stored = clone(MASTER);
    stored.role_overlaps[0].answer = 'separate';
    const edited = clone(MASTER); // the stale copy the page loaded, answer: ''
    edited.profile.name = 'Nik P.';
    const out = normaliseMaster(edited, stored);
    expect(out.role_overlaps[0].answer).toBe('separate');
    expect(out.role_overlaps[1].answer).toBe('');
    expect(out.profile.name).toBe('Nik P.');
  });

  test('drops an answer value it does not recognise and a pair with no usable indexes', () => {
    const out = normaliseMaster(
      { work_experience: MASTER.work_experience },
      {
        ...MASTER,
        role_overlaps: [
          { umbrella_index: 0, role_index: 1, answer: 'delete_everything' },
          { umbrella_index: 'x', role_index: 2 },
          { umbrella_index: 1, role_index: 1 },
        ],
      }
    );
    expect(out.role_overlaps).toEqual([{ umbrella_index: 0, role_index: 1, answer: '' }]);
  });
});

describe('applyOverlapAnswer', () => {
  test('"separate" records the answer and moves no role', () => {
    const out = applyOverlapAnswer(MASTER, ask(MASTER, 'Salsita'), 'separate');
    expect(out.work_experience).toHaveLength(4);
    expect(out.work_experience[1].company).toBe('Salsita');
    expect(out.work_experience[0].fractional_engagements).toEqual([]);
    expect(out.role_overlaps[0].answer).toBe('separate');
  });

  test('"nested" moves the role under the umbrella and drops it from the timeline', () => {
    const out = applyOverlapAnswer(MASTER, ask(MASTER, 'Salsita'), 'nested');
    expect(out.work_experience.map((r) => r.company)).toEqual(['Nik Page Ltd.', 'wflow', 'Older Co']);
    const nested = out.work_experience[0].fractional_engagements;
    expect(nested).toHaveLength(1);
    expect(nested[0].company).toBe('Salsita');
    expect(nested[0].bullets).toEqual(['Shipped it']);
    // one level only
    expect(nested[0].fractional_engagements).toEqual([]);
  });

  test('remaps the remaining questions onto the shortened array', () => {
    const out = applyOverlapAnswer(MASTER, ask(MASTER, 'Salsita'), 'nested');
    const open = out.role_overlaps.filter((o) => !o.answer);
    expect(open).toHaveLength(1);
    // wflow sat at index 2 and is at index 1 now — an unremapped index would ask
    // the next question about "Older Co".
    expect(out.work_experience[open[0].role_index].company).toBe('wflow');
    expect(out.work_experience[open[0].umbrella_index].company).toBe('Nik Page Ltd.');
  });

  test('answering both nests both under the umbrella', () => {
    const once = applyOverlapAnswer(MASTER, ask(MASTER, 'Salsita'), 'nested');
    const twice = applyOverlapAnswer(once, ask(once, 'wflow'), 'nested');
    expect(twice.work_experience.map((r) => r.company)).toEqual(['Nik Page Ltd.', 'Older Co']);
    expect(twice.work_experience[0].fractional_engagements.map((r) => r.company)).toEqual(['Salsita', 'wflow']);
  });

  test('does not mutate the record it was given', () => {
    const before = clone(MASTER);
    applyOverlapAnswer(MASTER, ask(MASTER, 'Salsita'), 'nested');
    expect(MASTER).toEqual(before);
  });

  // Red on the old code, which returned the record unchanged and let the route
  // answer 200 — the person was told an answer was saved when nothing was.
  test('a question that is not open THROWS instead of silently saving nothing', () => {
    const q = ask(MASTER, 'Salsita');
    const answered = applyOverlapAnswer(MASTER, q, 'separate');
    expect(() => applyOverlapAnswer(answered, q, 'nested')).toThrow(/not open/);
    expect(() => applyOverlapAnswer(MASTER, { role_key: 'ghost | x |  | ', umbrella_key: q.umbrella_key }, 'nested'))
      .toThrow(/not open/);
    expect(() => applyOverlapAnswer(MASTER, {}, 'nested')).toThrow(/required/);
  });

  // Red on the old code: the question list was numbered off the RAW pairs while
  // the answer was applied to the cleaned one, so a malformed pair ahead of a
  // real one shifted every answer behind it onto the wrong question.
  test('a malformed pair ahead of a real one does not misdirect the answer', () => {
    const master = {
      ...MASTER,
      role_overlaps: [
        { umbrella_index: 1, role_index: 1, answer: '' }, // malformed: same role twice
        { umbrella_index: 0, role_index: 1, answer: '' }, // Salsita
        { umbrella_index: 0, role_index: 2, answer: '' }, // wflow
      ],
    };
    const out = applyOverlapAnswer(master, ask(master, 'Salsita'), 'nested');
    expect(out.work_experience.map((r) => r.company)).toEqual(['Nik Page Ltd.', 'wflow', 'Older Co']);
    expect(out.work_experience[0].fractional_engagements.map((r) => r.company)).toEqual(['Salsita']);
    // and the question is gone for good
    expect(computeMasterIssues(out).some((f) => f.question.includes('Salsita'))).toBe(false);
  });

  // The whole reported symptom, end to end: answer every question the app shows,
  // reload the saved record, nothing is left open.
  test('answering every question leaves none open on the saved record', () => {
    let master = MASTER;
    for (let i = 0; i < 5 && computeMasterIssues(master).length; i += 1) {
      const flag = computeMasterIssues(master)[0];
      master = applyOverlapAnswer(master, flag, flag.answers[i % 2]);
    }
    expect(computeMasterIssues(master)).toEqual([]);
    // and a round-trip through the record editor keeps them settled
    expect(computeMasterIssues(normaliseMaster(clone(MASTER), master))).toEqual([]);
  });

  test('roleKey identifies a role by employer, title and dates', () => {
    expect(roleKey(MASTER.work_experience[1])).toBe('salsita | product lead | 2021 | 2022');
  });

  test('refuses an answer that is neither of the two', () => {
    expect(() => applyOverlapAnswer(MASTER, ask(MASTER, 'Salsita'), 'maybe')).toThrow();
  });
});
