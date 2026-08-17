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
export function normaliseOverlaps(v) {
  return arr(v)
    .map((o) => ({
      umbrella_index: idx(o?.umbrella_index),
      role_index: idx(o?.role_index),
      answer: ANSWERS.includes(o?.answer) ? o.answer : '',
    }))
    .filter((o) => o.umbrella_index !== null && o.role_index !== null && o.umbrella_index !== o.role_index);
}

// A role's IDENTITY: employer, title and its two verbatim dates. This is how an
// open question is addressed, because a POSITION is not stable — answering
// "client work" pulls a role out of work_experience and every role below it
// moves up, and dropping a malformed pair renumbers the questions themselves.
// An answer keyed by position therefore landed on a different question, or on
// none, while the save still reported success. Identity cannot drift: the same
// role is the same role wherever it sits in the array.
export function roleKey(entry) {
  return [entry?.company, entry?.title, entry?.start_date, entry?.end_date]
    .map((v) => str(v).toLowerCase())
    .join(' | ');
}

// A fingerprint of the STRUCTURE a record was in when the editor opened on it:
// which roles exist, how they are nested, and which questions are still open.
// The editor sends it back with a save so the server can tell an up-to-date
// submission from one taken before an overlap answer restructured the record.
export function recordFingerprint(master) {
  const structure = arr(master?.work_experience).map((r) => [
    roleKey(r),
    arr(r?.fractional_engagements).map(roleKey).join(' + '),
  ].join(' >> '));
  const questions = normaliseOverlaps(master?.role_overlaps)
    .map((o) => `${o.umbrella_index}:${o.role_index}:${o.answer}`);
  return [...structure, '--', ...questions].join(' / ');
}

// Move a draft that was opened on `base` onto the newer record `next`, keeping
// what the person typed. The two write paths on /me touch the SAME record side
// by side — answering a question restructures the timeline while the edit form
// holds a copy — so without this the form goes on showing the old timeline and
// saving it back undoes the answer.
//
// Section by section: a section the person has not touched (identical to the
// base they opened on) takes the newer record's version; a section they HAVE
// touched keeps their version, because their typing is the only copy of it.
// role_overlaps is never the form's to carry — the newer record always wins.
export function rebaseMaster(base, draft, next) {
  if (!next || typeof next !== 'object') return draft;
  if (!draft || typeof draft !== 'object') return next;
  const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const out = { ...next };
  for (const key of Object.keys({ ...base, ...draft, ...next })) {
    if (key === 'role_overlaps') continue;
    out[key] = same(draft[key], base?.[key]) ? next[key] : draft[key];
  }
  out.role_overlaps = next.role_overlaps;
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
    // Overlap QUESTIONS, not structure: the build reports the pairs and the
    // person answers them on /me, through applyOverlapAnswer alone. ALWAYS taken
    // from the stored record — the editor renders no field for them, so anything
    // submitted here is a stale copy the page loaded before the questions were
    // answered, and letting it win wiped real answers and reopened settled
    // questions.
    role_overlaps: normaliseOverlaps(stored?.role_overlaps),
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
// The question is addressed by the IDENTITY of the two roles it concerns
// ({ role_key, umbrella_key }, see roleKey) — never by its position. Returns a
// new record; the input is not mutated. A question that is not open on this
// record THROWS rather than returning the record unchanged: a silent no-op was
// saved as a success, so the person was told their answer was recorded when
// nothing had changed, and the question came back on the next page load.
export function applyOverlapAnswer(master, question, answer) {
  if (!ANSWERS.includes(answer)) throw new Error('applyOverlapAnswer: answer must be "nested" or "separate"');
  const role_key = str(question?.role_key);
  const umbrella_key = str(question?.umbrella_key);
  if (!role_key || !umbrella_key) throw new Error('applyOverlapAnswer: role_key and umbrella_key are required');

  const overlaps = normaliseOverlaps(master?.role_overlaps);
  const experience = arr(master?.work_experience);
  const questionIndex = overlaps.findIndex((o) => !o.answer
    && o.role_index < experience.length
    && o.umbrella_index < experience.length
    && roleKey(experience[o.role_index]) === role_key
    && roleKey(experience[o.umbrella_index]) === umbrella_key);
  if (questionIndex === -1) throw new Error('That question is not open on your record');
  const q = overlaps[questionIndex];

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

// ── Additive merge ───────────────────────────────────────────────────────────
//
// "Anything not on your CV?" sends the person's note to the model together with
// their whole existing record, and the model returns a whole record back. That
// return value must NEVER be saved as-is: the call is the BUILD prompt — pure
// re-extraction — so everything the person already had is re-transcribed from
// scratch by a cheap model on every note. A run of it compressed twelve bullets
// to two, dropped an entry's only two client names, and retitled a role. The
// note was two lines; the loss was the career.
//
// So the STORED record is the base and the model's output is read for ADDITIONS
// only, exactly as that route's own contract has always claimed ("additive only,
// never overwrites"):
//   - a role, talk, publication, qualification or skill that is not already
//     there is appended;
//   - a role that IS already there keeps its stored title, dates, location and
//     wording, and gains only bullets the stored copy does not have;
//   - nothing is ever removed, reworded or reordered.
//
// A correction to something already recorded is the EDITOR's job (the person
// types it and it is saved verbatim, /api/update-master) — not a model's.
//
// Pure, so the rule is unit-testable and no network is involved.

// Identity for matching, deliberately looser than roleKey: the model re-emits a
// date as "Aug 2016" where the record says "August 2016", and a role that fails
// to match would be appended a second time. Employer + title is stable across
// re-transcription; the stored dates are kept either way.
const softKey = (r) => `${str(r?.company).toLowerCase()} | ${str(r?.title).toLowerCase()}`;

// A date reduced to what survives re-transcription: "August 2016", "Aug 2016"
// and "08/2016" are the same date to a person and must be the same date here.
const dateId = (v) => {
  const s = str(v).toLowerCase();
  const year = s.match(/\d{4}/)?.[0] || '';
  const month = s.match(/[a-z]{3}/)?.[0] || s.match(/\b(\d{1,2})[/-]/)?.[1] || '';
  return `${month}${year}`;
};
// The second way to recognise the same role, used when the title was rewritten:
// employer plus when it started. Two roles at one employer are a promotion, and
// those have different start dates.
const spanKey = (r) => `${str(r?.company).toLowerCase()} @ ${dateId(r?.start_date)}`;
const talkKey = (t) => [t?.event, t?.year, t?.topic].map((v) => str(v).toLowerCase()).join(' | ');
const eduKey = (e) => [e?.institution, e?.qualification].map((v) => str(v).toLowerCase()).join(' | ');
const orgKey = (e) => [e?.organization || e?.company, e?.title].map((v) => str(v).toLowerCase()).join(' | ');

// Stored entries first, in their stored order; then any incoming entry whose key
// is new. Order is never disturbed — a reordered timeline is a change the person
// did not ask for.
function appendNew(storedList, incomingList, key, shape) {
  const out = arr(storedList).slice();
  const seen = new Set(out.map(key));
  for (const item of arr(incomingList)) {
    const k = key(item);
    if (!k.replace(/[|\s]/g, '') || seen.has(k)) continue;
    seen.add(k);
    out.push(shape(item));
  }
  return out;
}

const newStrings = (storedList, incomingList) => {
  const out = strList(storedList);
  const seen = new Set(out.map((s) => s.toLowerCase()));
  for (const s of strList(incomingList)) {
    if (seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
  }
  return out;
};

// Bullets the stored copy does not already carry, compared on their text alone
// so re-punctuation by the model does not read as a new bullet.
const bulletId = (b) => str(b).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function mergeRoleList(storedRoles, incomingRoles, depth = 0) {
  const incoming = arr(incomingRoles);
  // An incoming entry matched to a stored role has been accounted for. Without
  // this it was ALSO appended as a new role, so a re-extraction that merely
  // retitled an employer left the person with that employer twice.
  const used = new Set();
  const out = arr(storedRoles).map((stored) => {
    let match = incoming.find((r, i) => !used.has(i) && softKey(r) === softKey(stored));
    if (!match) match = incoming.find((r, i) => !used.has(i) && spanKey(r) === spanKey(stored) && str(r?.company));
    if (!match) return stored;
    used.add(incoming.indexOf(match));
    const bullets = strList(stored.bullets);
    const have = new Set(bullets.map(bulletId));
    for (const b of strList(match.bullets)) {
      if (!have.has(bulletId(b))) {
        have.add(bulletId(b));
        bullets.push(b);
      }
    }
    const merged = { ...stored, bullets };
    if (depth === 0) {
      merged.fractional_engagements = mergeRoleList(
        arr(stored.fractional_engagements),
        arr(match.fractional_engagements),
        1
      );
    }
    return merged;
  });

  const seen = new Set(out.map(softKey));
  const spans = new Set(out.map(spanKey));
  incoming.forEach((r, i) => {
    const k = softKey(r);
    if (used.has(i) || k === ' | ' || seen.has(k) || spans.has(spanKey(r))) return;
    seen.add(k);
    spans.add(spanKey(r));
    out.push(normaliseRole(r, depth));
  });
  return out;
}

// `stored` is the record as saved; `augmented` is what the model returned.
// Returns a new record — neither input is mutated.
export function mergeAdditions(stored, augmented) {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return augmented;
  if (!augmented || typeof augmented !== 'object' || Array.isArray(augmented)) return stored;

  const sp = stored.profile && typeof stored.profile === 'object' ? stored.profile : {};
  const ap = augmented.profile && typeof augmented.profile === 'object' ? augmented.profile : {};
  const sc = sp.contact && typeof sp.contact === 'object' ? sp.contact : {};
  const ac = ap.contact && typeof ap.contact === 'object' ? ap.contact : {};
  // A stored value always wins. An incoming one fills a field the record left
  // empty — that is an addition, not an overwrite.
  const fill = (a, b) => str(a) || str(b);

  return {
    ...stored,
    profile: {
      ...sp,
      name: fill(sp.name, ap.name),
      headline: fill(sp.headline, ap.headline),
      location: fill(sp.location, ap.location),
      summary: fill(sp.summary, ap.summary),
      contact: {
        phone: fill(sc.phone, ac.phone),
        email: fill(sc.email, ac.email),
        linkedin: fill(sc.linkedin, ac.linkedin),
        website: fill(sc.website, ac.website),
      },
      top_skills: newStrings(sp.top_skills, ap.top_skills),
      certifications: newStrings(sp.certifications, ap.certifications),
      honors_and_awards: newStrings(sp.honors_and_awards, ap.honors_and_awards),
      languages: appendNew(
        sp.languages,
        ap.languages,
        (l) => str(l?.language).toLowerCase(),
        (l) => ({ language: str(l?.language), proficiency: str(l?.proficiency) })
      ),
    },
    work_experience: mergeRoleList(stored.work_experience, augmented.work_experience),
    advisory_and_community: appendNew(
      stored.advisory_and_community,
      augmented.advisory_and_community,
      orgKey,
      (e) => ({
        organization: str(e?.organization) || str(e?.company),
        title: str(e?.title),
        start_date: str(e?.start_date),
        end_date: str(e?.end_date),
        location: str(e?.location),
        bullets: strList(e?.bullets),
      })
    ),
    speaking_and_lecturing: appendNew(
      stored.speaking_and_lecturing,
      augmented.speaking_and_lecturing,
      talkKey,
      (t) => ({
        event: str(t?.event),
        role: str(t?.role),
        topic: str(t?.topic),
        location: str(t?.location),
        year: str(t?.year),
      })
    ),
    publications_and_patents: newStrings(stored.publications_and_patents, augmented.publications_and_patents),
    education: appendNew(stored.education, augmented.education, eduKey, (e) => ({
      institution: str(e?.institution),
      qualification: str(e?.qualification),
      dates: str(e?.dates),
      location: str(e?.location),
    })),
    // Never the model's to change: the questions belong to the person.
    role_overlaps: normaliseOverlaps(stored.role_overlaps),
  };
}

export { PRESERVED, PRESERVED_STRINGS };
