// utils/master-flags.js
//
// Pure master-CV mutation logic for the onboarding Flag Fixer (Step 3).
// These functions EDIT the canonical master in place-by-value and return a NEW
// master object — they never call the network, the AI, or the DB, so they are
// fully unit-testable. The API route (pages/api/resolve-flag.js) loads the
// master, runs the relevant function here, and saves the result.
//
// Two kinds of resolution:
//   - SINGLE   : correct one field on one existing entry (a date, a title, a
//                location). Deterministic field set.
//   - STRUCTURAL (merge): collapse several experience entries under one canonical
//                parent, keeping the originals NESTED underneath as `contracts`
//                (nothing is deleted; never two competing histories of one span).
//
// Invariants enforced here:
//   - voice_samples are NEVER touched.
//   - A structural merge deletes no real detail — children are nested, not dropped.
//   - Unknown / out-of-range targets throw, so a bad flag can't silently corrupt
//     the record.

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

const EDITABLE_EXPERIENCE_FIELDS = new Set([
  'company',
  'role',
  'dates',
  'location',
]);

// Apply a SINGLE-FIX resolution: set one field on one entry to `value`.
// target = { section: 'experience', index: <n>, field: 'dates' }
//        | { section: 'identity', field: 'country' }
//        | { section: 'candidate_core' }  (whole-string field)
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

  if (section === 'candidate_core') {
    next.candidate_core = value;
    return next;
  }

  if (section === 'identity') {
    if (!next.identity || typeof next.identity !== 'object') {
      throw new Error('applySingleFix: master has no identity block');
    }
    if (field === 'country') {
      next.identity.country = value;
      return next;
    }
    throw new Error(`applySingleFix: unsupported identity field "${field}"`);
  }

  if (section === 'experience') {
    const list = next.experience;
    if (!Array.isArray(list) || index < 0 || index >= list.length) {
      throw new Error(`applySingleFix: experience index ${index} out of range`);
    }
    if (!EDITABLE_EXPERIENCE_FIELDS.has(field)) {
      throw new Error(`applySingleFix: experience field "${field}" is not editable`);
    }
    list[index][field] = value;
    return next;
  }

  throw new Error(`applySingleFix: unsupported section "${section}"`);
}

// Apply a STRUCTURAL MERGE: collapse experience entries at `childIndexes` under
// a single canonical parent entry. The children are kept NESTED under the parent
// as `contracts` (their full original detail survives). `note` is the user's
// free-text clarification, stored on the parent as `merge_note` so the generator
// understands why the grouping exists.
export function applyStructuralMerge(master, { parent, childIndexes, note = '' }) {
  if (!master || typeof master !== 'object') {
    throw new Error('applyStructuralMerge: master is required');
  }
  if (!parent || typeof parent !== 'object' || !parent.company) {
    throw new Error('applyStructuralMerge: parent { company, role, dates } is required');
  }
  if (!Array.isArray(childIndexes) || childIndexes.length < 1) {
    throw new Error('applyStructuralMerge: childIndexes must be a non-empty array');
  }

  const next = clone(master);
  const list = next.experience;
  if (!Array.isArray(list)) {
    throw new Error('applyStructuralMerge: master has no experience array');
  }

  const sorted = [...new Set(childIndexes)].sort((a, b) => a - b);
  for (const i of sorted) {
    if (i < 0 || i >= list.length) {
      throw new Error(`applyStructuralMerge: child index ${i} out of range`);
    }
  }

  // Pull the children out, preserving their full detail as nested contracts.
  const children = sorted.map((i) => list[i]);
  const firstPos = sorted[0];

  const parentEntry = {
    company: parent.company,
    role: parent.role || '',
    dates: parent.dates || '',
    location: parent.location || '',
    concurrent: false,
    core_tags: parent.core_tags || [],
    achievements: parent.achievements || [],
    merge_note: note,
    // The originals, untouched, nested under the canonical parent. Nothing lost.
    contracts: children.map((c) => clone(c)),
  };

  // Remove children (highest index first so positions stay valid), then insert
  // the parent where the first child used to sit.
  const remaining = list.filter((_, i) => !sorted.includes(i));
  const insertAt = remaining.length === 0 ? 0
    : Math.min(firstPos, remaining.length);
  remaining.splice(insertAt, 0, parentEntry);
  next.experience = remaining;

  return next;
}

// Orchestrator the API route calls. Returns the NEW master.
//   resolution.decision: 'accept' | 'edit' | 'reject'  (single)
//                       | 'merge'                       (structural)
//   resolution.value:    the corrected string (edit) or free-text note (merge)
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

  if (flag.type === 'structural') {
    if (decision === 'reject') return clone(master);
    if (!flag.merge) throw new Error('resolveFlag: structural flag is missing its merge hint');
    return applyStructuralMerge(master, {
      parent: flag.merge.parent,
      childIndexes: flag.merge.child_indexes,
      note: resolution.value || '',
    });
  }

  throw new Error(`resolveFlag: unknown flag type "${flag.type}"`);
}
