// utils/master-flags.js
//
// Pure master-CV mutation logic for the onboarding Flag Fixer (Step 3).
// These functions EDIT the canonical master in place-by-value and return a NEW
// master object — they never call the network, the AI, or the DB, so they are
// fully unit-testable. The API route (pages/api/resolve-flag.js) loads the
// master, runs the relevant function here, and saves the result.
//
// Two kinds of resolution:
//   - SINGLE  : correct one field on one existing entry (a date, a title, a
//               location). Deterministic field set.
//   - CLARIFY : the user's own answer to a question about their timeline — why
//               a short role ended, what happened in a gap.
//
// The old STRUCTURAL merge is gone. It asked whether concurrent roles were
// delivered under an ongoing engagement and then folded them together; the
// extraction now makes that call itself, nesting a client engagement inside the
// consultancy's `fractional_engagements`. Merging on top of that would fold an
// already-nested record a second time.
//
// Invariants enforced here:
//   - A clarification is stored OUTSIDE work_experience. The role objects are
//     what the extraction wrote; a user's answer sitting inside one would be
//     read as record content by every consumer, and a sentence about why a job
//     ended would reach the CV as though it were a bullet.
//   - Unknown / out-of-range targets throw, so a bad flag can't silently corrupt
//     the record.

import { roles } from './master-read.js';

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

const EDITABLE_ROLE_FIELDS = new Set([
  'company',
  'title',
  'start_date',
  'end_date',
  'location',
]);

// Walk to the role an index from `roles()` refers to, inside the real record, so
// a fix writes to the stored object rather than to the flat copy. Returns the
// live entry or null.
function roleAt(master, index) {
  let i = 0;
  for (const entry of Array.isArray(master?.work_experience) ? master.work_experience : []) {
    if (i === index) return entry;
    i += 1;
    for (const sub of Array.isArray(entry?.fractional_engagements) ? entry.fractional_engagements : []) {
      if (i === index) return sub;
      i += 1;
    }
  }
  return null;
}

// Apply a SINGLE-FIX resolution: set one field on one entry to `value`.
// target = { section: 'experience', index: <n>, field: 'start_date' }
//        | { section: 'profile', field: 'location' | 'name' | 'headline' }
export function applySingleFix(master, target, value) {
  if (!master || typeof master !== 'object') {
    throw new Error('applySingleFix: master is required');
  }
  if (!target || typeof target !== 'object') {
    throw new Error('applySingleFix: target is required');
  }
  if (typeof value !== 'string') {
    throw new Error('applySingleFix: value must be a string');
  }

  const next = clone(master);
  const { section, index, field } = target;

  if (section === 'profile') {
    if (!next.profile || typeof next.profile !== 'object') {
      throw new Error('applySingleFix: master has no profile block');
    }
    if (!['name', 'headline', 'location'].includes(field)) {
      throw new Error(`applySingleFix: unsupported profile field "${field}"`);
    }
    next.profile[field] = value;
    return next;
  }

  if (section === 'experience') {
    const entry = roleAt(next, index);
    if (!entry) {
      throw new Error(`applySingleFix: experience index ${index} out of range`);
    }
    if (!EDITABLE_ROLE_FIELDS.has(field)) {
      throw new Error(`applySingleFix: experience field "${field}" is not editable`);
    }
    entry[field] = value;
    return next;
  }

  throw new Error(`applySingleFix: unsupported section "${section}"`);
}

// Apply a CLARIFICATION: store the user's answer about ONE role (why a short
// tenure ended, what a gap was) in the top-level `clarifications` array. It adds
// context for the generator; it deletes and overwrites nothing in the record
// itself. Answering the same role twice replaces the earlier answer.
export function applyClarification(master, { index, note }) {
  if (!master || typeof master !== 'object') {
    throw new Error('applyClarification: master is required');
  }
  if (typeof note !== 'string' || note.trim() === '') {
    throw new Error('applyClarification: a note is required');
  }
  const next = clone(master);
  const flat = roles(next);
  if (typeof index !== 'number' || index < 0 || index >= flat.length) {
    throw new Error(`applyClarification: experience index ${index} out of range`);
  }
  const role = flat[index];
  const existing = Array.isArray(next.clarifications) ? next.clarifications : [];
  // The company and dates ride along so the note survives a rebuild: the index
  // is only meaningful against the record it was answered on.
  next.clarifications = [
    ...existing.filter((c) => c?.index !== index),
    { index, company: role.company, title: role.role, dates: role.dates, note: note.trim() },
  ];
  return next;
}

// Orchestrator the API route calls. Returns the NEW master.
//   resolution.decision: 'accept' | 'edit' | 'reject'  (single)
//                       | any non-reject               (clarify)
export function resolveFlag(master, flag, resolution) {
  if (!flag || typeof flag !== 'object') throw new Error('resolveFlag: flag required');
  if (!resolution || typeof resolution !== 'object') throw new Error('resolveFlag: resolution required');

  const { decision } = resolution;

  if (flag.type === 'single') {
    if (decision === 'reject') return clone(master); // user keeps the original; no change
    const value = decision === 'accept' ? (flag.proposed_value || '') : resolution.value;
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error('resolveFlag: a value is required to accept/edit a single fix');
    }
    return applySingleFix(master, flag.target, value);
  }

  if (flag.type === 'clarify') {
    if (decision === 'reject') return clone(master); // user skips the question; no change
    const note = resolution.value;
    if (typeof note !== 'string' || note.trim() === '') {
      throw new Error('resolveFlag: an answer is required to clarify');
    }
    const index = flag.target?.index;
    if (typeof index !== 'number') {
      throw new Error('resolveFlag: clarify flag is missing target.index');
    }
    return applyClarification(master, { index, note });
  }

  throw new Error(`resolveFlag: unknown flag type "${flag.type}"`);
}
