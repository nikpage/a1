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

// Array fields the editor may not touch. Empty since the timeline
// clarifications were removed — kept because PRESERVED_STRINGS' counterpart for
// arrays is the shape the loop below expects.
const PRESERVED = [];

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

// One `role_overlaps` entry: two indexes into work_experience plus the person's
// answer once they have given one. `answer` is "" while the question is still
// open, "nested" if the role was client work under the umbrella, "separate" if
// it was a job of its own. An entry without two usable indexes is dropped —
// there is no question to ask.
const ANSWERS = ['nested', 'separate'];
const idx = (v) => (Number.isInteger(v) && v >= 0 ? v : null);
function normaliseOverlaps(v) {
  return arr(v)
    .map((o) => ({
      umbrella_index: idx(o?.umbrella_index),
      role_index: idx(o?.role_index),
      answer: ANSWERS.includes(o?.answer) ? o.answer : '',
    }))
    .filter((o) => o.umbrella_index !== null && o.role_index !== null && o.umbrella_index !== o.role_index);
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
    // Overlap QUESTIONS, not structure: the build reports the pairs and the
    // person answers them on /me. Absent from the submission entirely (the
    // record editor renders no field for them) → the stored ones are kept, so
    // an ordinary edit cannot silently drop pending questions. Present → the
    // submission wins, which is how an answer is recorded.
    role_overlaps: normaliseOverlaps(
      edited.role_overlaps === undefined ? stored?.role_overlaps : edited.role_overlaps,
    ),
    education: arr(edited.education)
      .map((e) => ({
        institution: str(e?.institution),
        qualification: str(e?.qualification),
        dates: str(e?.dates),
        location: str(e?.location),
      }))
      .filter((e) => e.institution || e.qualification),
  };

  for (const key of PRESERVED) {
    const kept = arr(stored?.[key]);
    if (kept.length) out[key] = kept;
  }
  for (const key of PRESERVED_STRINGS) {
    const kept = str(stored?.[key]);
    if (kept) out[key] = kept;
  }

  return out;
}

// Answer one overlap question. `answer` is "nested" (the role was client work
// delivered under the umbrella) or "separate" (a job of its own, held at the
// same time). This is the ONLY thing that nests: the build reports the pair and
// never moves a role itself.
//
// "nested" removes the role from work_experience and appends it to the
// umbrella's fractional_engagements, so every OTHER overlap's indexes have to
// move with it — an index that still pointed at the old array would ask the
// next question about the wrong role. "separate" changes no structure; it
// records the answer so the question is not asked again.
//
// Returns a new record; the input is not mutated. An out-of-range or already
// answered question returns the record unchanged.
export function applyOverlapAnswer(master, questionIndex, answer) {
  if (!ANSWERS.includes(answer)) throw new Error('applyOverlapAnswer: answer must be "nested" or "separate"');
  const overlaps = normaliseOverlaps(master?.role_overlaps);
  const q = overlaps[questionIndex];
  const experience = arr(master?.work_experience);
  if (!q || q.answer) return master;
  if (q.umbrella_index >= experience.length || q.role_index >= experience.length) return master;

  if (answer === 'separate') {
    return {
      ...master,
      role_overlaps: overlaps.map((o, i) => (i === questionIndex ? { ...o, answer } : o)),
    };
  }

  const moved = normaliseRole(experience[q.role_index], 1);
  const nextExperience = experience
    .filter((_, i) => i !== q.role_index)
    .map((r, i) => {
      const wasIndex = i < q.role_index ? i : i + 1;
      if (wasIndex !== q.umbrella_index) return r;
      return { ...r, fractional_engagements: [...arr(r?.fractional_engagements), moved] };
    });

  // Indexes shift down by one for every role that sat after the one removed.
  const shift = (i) => (i > q.role_index ? i - 1 : i);
  const nextOverlaps = overlaps
    // The moved role is no longer at the top level, so any OTHER question that
    // pointed at it has nothing left to ask about and is dropped rather than
    // left dangling on a role that is now nested.
    .filter((o, i) => i === questionIndex || (o.role_index !== q.role_index && o.umbrella_index !== q.role_index))
    .map((o) => (o === q
      ? { ...o, answer }
      : { ...o, umbrella_index: shift(o.umbrella_index), role_index: shift(o.role_index) }));

  return { ...master, work_experience: nextExperience, role_overlaps: nextOverlaps };
}

export { PRESERVED, PRESERVED_STRINGS };
