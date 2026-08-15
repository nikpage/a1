// utils/master-read.test.js
import { describe, it, expect } from 'vitest';
import { masterForPrompt, roles } from './master-read.js';

const role = (company, title, start_date, end_date, engagements = []) => ({
  company, title, start_date, end_date, location: 'Prague, CZ', bullets: [],
  fractional_engagements: engagements,
});

// A record with a nested engagement, so flat indexes and top-level indexes differ.
const master = {
  work_experience: [
    role('Nik Page Experience Strategy & Design', 'Product Creator', 'August 2016', 'Present', [
      role('wflow.com', 'Head of Product Research', 'January 2022', 'October 2022'),
    ]),
    role('Salsita Software', 'Sr. Product Manager', 'November 2022', 'October 2023'),
  ],
};

const noteFor = (index, note) => {
  const r = roles(master)[index];
  return { index, company: r.company, title: r.role, dates: r.dates, note };
};

describe('masterForPrompt — the user\'s clarifications reach the prompt', () => {
  it('attaches a note to the role it was answered about, by FLAT index', () => {
    const out = masterForPrompt({ ...master, clarifications: [noteFor(2, 'Contract ended.')] });
    expect(out.work_experience[1].clarification).toBe('Contract ended.');
    expect(out.work_experience[0].clarification).toBeUndefined();
  });

  it('attaches a note to a NESTED engagement', () => {
    const out = masterForPrompt({ ...master, clarifications: [noteFor(1, 'Client project.')] });
    expect(out.work_experience[0].fractional_engagements[0].clarification).toBe('Client project.');
    expect(out.work_experience[0].clarification).toBeUndefined();
  });

  it('drops a note whose role no longer matches — a wrong note is worse than none', () => {
    const stale = { index: 2, company: 'Some Other Co', dates: '2019 - 2020', note: 'Layoff.' };
    const out = masterForPrompt({ ...master, clarifications: [stale] });
    expect(out.work_experience[1].clarification).toBeUndefined();
  });

  it('never mutates the stored record', () => {
    const stored = { ...master, clarifications: [noteFor(2, 'Contract ended.')] };
    masterForPrompt(stored);
    expect(stored.work_experience[1].clarification).toBeUndefined();
  });

  it('returns the record untouched when there is nothing to attach', () => {
    expect(masterForPrompt(master)).toBe(master);
    expect(masterForPrompt({ ...master, clarifications: [] }).work_experience[1].clarification).toBeUndefined();
    expect(masterForPrompt(null)).toBe(null);
  });
});
