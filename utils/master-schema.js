// utils/master-schema.js
//
// Normalise a user-edited master record back onto the known schema before it is
// written. The editor posts the whole record, so this is the gate: unknown keys
// are dropped, every field is coerced to its declared type, and structure the
// generators depend on (experience[].achievements[], nested contracts[]) is
// preserved rather than flattened.
//
// Pure — no network, no DB — so the rules are unit-testable, in the same spirit
// as utils/master-flags.js.
//
// The user is authoritative over their OWN facts, so this never second-guesses
// values: a date they typed is the date. What it protects is SHAPE, plus the
// two things the editor has no business rewriting (see PRESERVED below).

// Fields the editor may not touch, carried over from the stored record:
//   voice_samples — verbatim quotes, grounded in code against the source CV
//                   (pruneVoiceSamples); hand-editing them breaks that guarantee.
//   conflicts     — the open-questions queue, owned by the flag fixer.
const PRESERVED = ['voice_samples', 'conflicts'];

// The user's own written style guide for their cover letters. Prose, not a list,
// and authored by the user (or by the owner on their behalf) — no AI pass writes
// or rewrites it, so it is carried over from the stored record like PRESERVED,
// but as a string rather than an array.
const PRESERVED_STRINGS = ['voice_guide'];

const str = (v) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());
const arr = (v) => (Array.isArray(v) ? v : []);
const strList = (v) => arr(v).map(str).filter(Boolean);

function normaliseAchievement(a) {
  return {
    text: str(a?.text),
    metric: str(a?.metric),
    skills_utilized: strList(a?.skills_utilized),
  };
}

function normaliseRole(role) {
  const out = {
    company: str(role?.company),
    role: str(role?.role),
    dates: str(role?.dates),
    location: str(role?.location),
    core_tags: strList(role?.core_tags),
    achievements: arr(role?.achievements).map(normaliseAchievement).filter((a) => a.text),
  };
  // A merged parent keeps its nested engagements — dropping them would delete
  // real detail and resurrect the job-hopping signal the merge removed.
  if (Array.isArray(role?.contracts) && role.contracts.length) {
    out.contracts = role.contracts.map(normaliseRole);
  }
  // Clarifications steer generation and are set by the flag fixer; keep them.
  if (str(role?.clarification)) out.clarification = str(role.clarification);
  if (str(role?.merge_note)) out.merge_note = str(role.merge_note);
  return out;
}

// `edited` is what the user submitted; `stored` is the record currently saved
// (the source of the preserved fields). Returns a new object — neither input is
// mutated.
export function normaliseMaster(edited, stored = null) {
  if (!edited || typeof edited !== 'object' || Array.isArray(edited)) {
    throw new Error('normaliseMaster: a master object is required');
  }

  const identity = edited.identity && typeof edited.identity === 'object' ? edited.identity : {};
  const contact = identity.contact && typeof identity.contact === 'object' ? identity.contact : {};

  const out = {
    identity: {
      name: str(identity.name),
      contact: {
        email: str(contact.email),
        phone: str(contact.phone),
        location: str(contact.location),
        links: strList(contact.links),
      },
      country: str(identity.country),
      languages: arr(identity.languages)
        .map((l) => ({ language: str(l?.language), level: str(l?.level) }))
        .filter((l) => l.language),
    },
    candidate_core: str(edited.candidate_core),
    // A role with neither employer nor title is an empty row from the editor.
    experience: arr(edited.experience).map(normaliseRole).filter((r) => r.company || r.role),
    education: arr(edited.education)
      .map((e) => ({
        institution: str(e?.institution),
        qualification: str(e?.qualification),
        dates: str(e?.dates),
        notes: str(e?.notes),
      }))
      .filter((e) => e.institution || e.qualification),
    certifications: arr(edited.certifications)
      .map((c) => ({ name: str(c?.name), issuer: str(c?.issuer), date: str(c?.date) }))
      .filter((c) => c.name),
    parallel_experience: strList(edited.parallel_experience),
    transferable_notes: arr(edited.transferable_notes)
      .map((n) => ({
        observation: str(n?.observation),
        evidence: str(n?.evidence),
        useful_for: strList(n?.useful_for),
      }))
      .filter((n) => n.observation),
    gaps: strList(edited.gaps),
  };

  for (const key of PRESERVED) {
    out[key] = arr(stored?.[key]);
  }
  for (const key of PRESERVED_STRINGS) {
    const kept = str(stored?.[key]);
    if (kept) out[key] = kept;
  }

  return out;
}

export { PRESERVED, PRESERVED_STRINGS };
