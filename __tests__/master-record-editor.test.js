// @vitest-environment jsdom
//
// The edit form and the open questions live on the SAME screen: answering a
// question restructures the record while the form holds a copy of it. These
// tests pin the two halves of that living together —
//
//   - the form follows the record when it changes underneath it, without
//     throwing away what the person has typed;
//   - a save taken before the record moved is not lost and does not put the old
//     timeline back: the typed edits move onto the current record and go again.
//
// Both are red on the old code, which cloned the record once at mount and never
// looked at it again.

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MasterRecordEditor from '../components/MasterRecordEditor';
import { rebaseMaster, recordFingerprint } from '../utils/master-schema';

const FLAT = {
  profile: {
    name: 'Nik Page',
    headline: '',
    location: 'Prague, CZ',
    summary: '',
    contact: { phone: '', email: '', linkedin: '', website: '' },
    top_skills: [],
    languages: [],
    certifications: [],
    honors_and_awards: [],
  },
  work_experience: [
    { company: 'Nik Page Ltd.', title: 'Founder', start_date: '2016', end_date: 'Present', location: '', bullets: [], fractional_engagements: [] },
    { company: 'Salsita', title: 'Product Lead', start_date: '2021', end_date: '2022', location: '', bullets: [], fractional_engagements: [] },
  ],
  advisory_and_community: [],
  speaking_and_lecturing: [],
  publications_and_patents: [],
  education: [],
  role_overlaps: [{ umbrella_index: 0, role_index: 1, answer: '' }],
};

// What the record looks like after the person answers "client work": Salsita is
// no longer a top-level role, it sits under the practice.
const NESTED = {
  ...FLAT,
  work_experience: [
    { ...FLAT.work_experience[0], fractional_engagements: [FLAT.work_experience[1]] },
  ],
  role_overlaps: [{ umbrella_index: 0, role_index: 1, answer: 'nested' }],
};

const clone = (o) => JSON.parse(JSON.stringify(o));
const companyInputs = () => screen.getAllByText('Company').map((el) => el.parentElement.querySelector('input'));

beforeEach(() => {
  global.fetch = vi.fn();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('the form follows the record', () => {
  test('takes a restructured record while keeping what was typed', () => {
    const { rerender } = render(<MasterRecordEditor master={clone(FLAT)} />);

    const name = screen.getByDisplayValue('Nik Page');
    fireEvent.change(name, { target: { value: 'Nik P.' } });
    expect(companyInputs().map((i) => i.value)).toEqual(['Nik Page Ltd.', 'Salsita']);

    // A question is answered below the form; the page hands down the new record.
    rerender(<MasterRecordEditor master={clone(NESTED)} />);

    // The timeline follows: Salsita is now the engagement, not a second role.
    const companies = companyInputs().map((i) => i.value);
    expect(companies[0]).toBe('Nik Page Ltd.');
    expect(companies).toHaveLength(2); // the practice + its one engagement
    // and it really is an engagement now, not a second top-level role
    expect(screen.getByText('Engagements under this role (1)')).toBeTruthy();
    expect(screen.queryByText('Engagements under this role')).toBeNull();
    // and the typing survives
    expect(screen.getByDisplayValue('Nik P.')).toBeTruthy();
  });
});

describe('saving a copy taken before the record moved', () => {
  test('re-sends the edits on the current record instead of losing them', async () => {
    const saved = vi.fn();
    render(<MasterRecordEditor master={clone(FLAT)} onSaved={saved} />);

    fireEvent.change(screen.getByDisplayValue('Nik Page'), { target: { value: 'Nik P.' } });

    // First attempt: the stored record moved on (answered in another tab).
    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: 'moved', master: clone(NESTED) }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, master: clone(NESTED), flags: [] }),
      });

    fireEvent.click(screen.getByText('Save record'));

    await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    expect(global.fetch).toHaveBeenCalledTimes(2);

    const second = JSON.parse(global.fetch.mock.calls[1][1].body);
    // the typed edit is still there …
    expect(second.master.profile.name).toBe('Nik P.');
    // … the nesting the answer created is NOT undone …
    expect(second.master.work_experience).toHaveLength(1);
    expect(second.master.work_experience[0].fractional_engagements[0].company).toBe('Salsita');
    // … and it is sent against the record it was rebased onto.
    expect(second.based_on).toBe(recordFingerprint(NESTED));
  });
});

describe('rebaseMaster', () => {
  test('an untouched section takes the newer record', () => {
    const out = rebaseMaster(FLAT, clone(FLAT), NESTED);
    expect(out.work_experience).toHaveLength(1);
    expect(out.role_overlaps[0].answer).toBe('nested');
  });

  test('a touched section keeps the edit — it is the only copy of it', () => {
    const draft = clone(FLAT);
    draft.profile.name = 'Nik P.';
    const out = rebaseMaster(FLAT, draft, NESTED);
    expect(out.profile.name).toBe('Nik P.');
    expect(out.work_experience).toHaveLength(1);
  });

  test('never carries the questions back from the form', () => {
    const draft = clone(FLAT); // still shows the question as open
    draft.profile.name = 'Nik P.';
    const out = rebaseMaster(FLAT, draft, NESTED);
    expect(out.role_overlaps).toEqual(NESTED.role_overlaps);
  });
});
