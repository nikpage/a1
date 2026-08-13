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
// `gaps` sits here for the same reason as `conflicts`: the editor renders no
// field for it, so an editor save must never be able to change it. It used to be
// coerced through strList instead, and because the build prompt left the element
// type open the model wrote gaps as objects — one save turned every one of them
// into the string "[object Object]" and the real content was gone.
const PRESERVED = ['voice_samples', 'conflicts', 'gaps'];

// The user's own written style guide for their cover letters. Prose, not a list,
// and authored by the user (or by the owner on their behalf) — no AI pass writes
// or rewrites it, so it is carried over from the stored record like PRESERVED,
// but as a string rather than an array.
const PRESERVED_STRINGS = ['voice_guide'];

// Scalars coerce; an object or array does NOT. `String({})` is "[object Object]",
// which is truthy, survives every filter, and silently replaces real content with
// a placeholder — the exact way a record's gaps were destroyed. A shape this
// schema did not expect is dropped instead, so the caller sees an empty field
// rather than a lie.
const str = (v) => {
  if (typeof v === 'string') return v.trim();
  if (v == null) return '';
  if (typeof v === 'object') return '';
  return String(v).trim();
};
const arr = (v) => (Array.isArray(v) ? v : []);
const strList = (v) => arr(v).map(str).filter(Boolean);

function normaliseAchievement(a) {
  return {
    // Carry every field through, then coerce the ones we know. A field the
    // editor never rendered must survive the round-trip untouched — dropping it
    // silently deleted real content from the stored record.
    ...(a && typeof a === 'object' && !Array.isArray(a) ? a : {}),
    text: str(a?.text),
    metric: str(a?.metric),
    skills_utilized: strList(a?.skills_utilized),
  };
}

function normaliseRole(role) {
  const out = {
    ...(role && typeof role === 'object' && !Array.isArray(role) ? role : {}),
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
  } else {
    delete out.contracts;
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

  // Same one-record rule one level down: identity/contact keys the editor never
  // rendered come through from the stored record instead of being deleted.
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const identity = obj(edited.identity);
  const contact = obj(identity.contact);
  // Unknown identity/contact keys, like unknown top-level keys, come from the
  // stored record only — never from what was submitted.
  const storedIdentity = obj(stored?.identity);
  const storedContact = obj(storedIdentity.contact);

  const out = {
    identity: {
      ...storedIdentity,
      name: str(identity.name),
      contact: {
        ...storedContact,
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
  };

  // Any field the STORED record carries that this schema does not name — a
  // field the editor never rendered and therefore never posted back. It is
  // carried through rather than deleted, so the record on screen and the record
  // in the database stay ONE record. Deliberately from `stored` only: an
  // unknown key in what the user SUBMITTED is still rejected, so the editor
  // cannot be used to write arbitrary keys into the row.
  for (const key of Object.keys(stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {})) {
    if (!(key in out) && !PRESERVED.includes(key) && !PRESERVED_STRINGS.includes(key)) {
      out[key] = stored[key];
    }
  }

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
