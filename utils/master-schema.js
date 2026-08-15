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

// The only field the editor may not touch: the user's own written style guide
// for their cover letters. No AI pass writes it and the editor renders no field
// for it, so it is carried over from the stored record rather than taken from
// what was submitted.
const PRESERVED_STRINGS = ['voice_guide'];

// Scalars coerce; an object or array does NOT. `String({})` is "[object Object]",
// which is truthy, survives every filter, and silently replaces real content with
// a placeholder. A shape this schema did not expect is dropped instead, so the
// caller sees an empty field rather than a lie.
const str = (v) => {
  if (typeof v === 'string') return v.trim();
  if (v == null) return '';
  if (typeof v === 'object') return '';
  return String(v).trim();
};
const arr = (v) => (Array.isArray(v) ? v : []);
const strList = (v) => arr(v).map(str).filter(Boolean);

// One work_experience entry. `depth` stops a client engagement carrying its own
// engagements: the record nests exactly one level, and a deeper level submitted
// by a client is flattened away rather than stored.
function normaliseRole(role, depth = 0) {
  const out = {
    company: str(role?.company),
    title: str(role?.title),
    start_date: str(role?.start_date),
    end_date: str(role?.end_date),
    location: str(role?.location),
    bullets: strList(role?.bullets),
  };
  out.fractional_engagements = depth === 0
    ? arr(role?.fractional_engagements).map((r) => normaliseRole(r, 1)).filter((r) => r.company || r.title)
    : [];
  return out;
}

// `edited` is what the user submitted; `stored` is the record currently saved
// (the source of the preserved fields). Returns a new object — neither input is
// mutated. Unknown keys are dropped: the shape is the extraction prompt's
// contract (prompts/master-cv.js, EXACT_SHAPE) and the editor cannot widen it.
export function normaliseMaster(edited, stored = null) {
  if (!edited || typeof edited !== 'object' || Array.isArray(edited)) {
    throw new Error('normaliseMaster: a master object is required');
  }

  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const profile = obj(edited.profile);
  const contact = obj(profile.contact);

  const out = {
    profile: {
      name: str(profile.name),
      headline: str(profile.headline),
      location: str(profile.location),
      summary: str(profile.summary),
      contact: {
        phone: str(contact.phone),
        email: str(contact.email),
        linkedin: str(contact.linkedin),
        website: str(contact.website),
      },
      top_skills: strList(profile.top_skills),
      languages: arr(profile.languages)
        .map((l) => ({ language: str(l?.language), proficiency: str(l?.proficiency) }))
        .filter((l) => l.language),
      certifications: strList(profile.certifications),
      honors_and_awards: strList(profile.honors_and_awards),
    },
    // A role with neither employer nor title is an empty row from the editor.
    work_experience: arr(edited.work_experience).map((r) => normaliseRole(r)).filter((r) => r.company || r.title),
    advisory_and_community: arr(edited.advisory_and_community)
      .map((e) => ({
        organization: str(e?.organization) || str(e?.company),
        title: str(e?.title),
        start_date: str(e?.start_date),
        end_date: str(e?.end_date),
        location: str(e?.location),
        bullets: strList(e?.bullets),
      }))
      .filter((e) => e.organization || e.title),
    speaking_and_lecturing: arr(edited.speaking_and_lecturing)
      .map((t) => ({
        event: str(t?.event),
        role: str(t?.role),
        topic: str(t?.topic),
        location: str(t?.location),
        year: str(t?.year),
      }))
      .filter((t) => t.event || t.topic),
    publications_and_patents: strList(edited.publications_and_patents),
    education: arr(edited.education)
      .map((e) => ({
        institution: str(e?.institution),
        qualification: str(e?.qualification),
        dates: str(e?.dates),
        location: str(e?.location),
      }))
      .filter((e) => e.institution || e.qualification),
  };

  for (const key of PRESERVED_STRINGS) {
    const kept = str(stored?.[key]);
    if (kept) out[key] = kept;
  }

  return out;
}

export { PRESERVED_STRINGS };
