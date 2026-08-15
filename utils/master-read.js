// utils/master-read.js
//
// ONE reader for the master record. The extraction prompt owns the shape
// (prompts/master-cv.js, EXACT_SHAPE); everything that consumes a master goes
// through here instead of reaching into it, so the shape is defined in exactly
// two places — the prompt that writes it and this file that reads it.
//
// The record nests: a client engagement that ran inside a consultancy's span
// sits in that company's `fractional_engagements[]`, which is what stops the
// generator from either flattening the timeline or inventing a role to explain
// the overlap. Most consumers want the flat list of everything the person
// actually did, so `roles()` walks the nesting and hands back one array, each
// entry knowing the umbrella it came from.

const str = (v) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());
const list = (v) => (Array.isArray(v) ? v : []);

// "August 2016" + "Present" → "August 2016 - Present". One side only → that
// side alone. Neither → "". The strings are the source's own, never reformatted
// and never computed into a duration.
export function dateRange(entry) {
  const from = str(entry?.start_date);
  const to = str(entry?.end_date);
  if (from && to) return `${from} - ${to}`;
  return from || to || str(entry?.dates) || str(entry?.year);
}

function role(entry, umbrella = '') {
  return {
    company: str(entry?.company) || str(entry?.organization),
    role: str(entry?.title),
    dates: dateRange(entry),
    start_date: str(entry?.start_date),
    end_date: str(entry?.end_date),
    location: str(entry?.location),
    bullets: list(entry?.bullets).map(str).filter(Boolean),
    // The consultancy this sat inside, "" for a directly-held role. A generator
    // needs it to say "at Salsita Software (via Nik Page Ltd.)" instead of
    // presenting a client engagement as employment.
    via: str(umbrella),
  };
}

// Every role the person held, umbrella entries and their nested engagements
// alike, in record order. Nesting is one level by contract; a deeper level is
// ignored rather than trusted.
export function roles(master) {
  const out = [];
  for (const entry of list(master?.work_experience)) {
    out.push(role(entry));
    for (const sub of list(entry?.fractional_engagements)) {
      out.push(role(sub, str(entry?.company)));
    }
  }
  return out;
}

// Roles only — no advisory, no speaking. Kept separate because a keynote is not
// employment and must never be dated into the timeline.
export function advisory(master) {
  return list(master?.advisory_and_community).map((e) => role(e));
}

export function speaking(master) {
  return list(master?.speaking_and_lecturing).map((e) => ({
    event: str(e?.event),
    role: str(e?.role),
    topic: str(e?.topic),
    location: str(e?.location),
    year: str(e?.year),
  }));
}

export function education(master) {
  return list(master?.education).map((e) => ({
    institution: str(e?.institution),
    qualification: str(e?.qualification),
    dates: str(e?.dates),
    location: str(e?.location),
  }));
}

export function profile(master) {
  const p = master?.profile || {};
  return {
    name: str(p.name),
    headline: str(p.headline),
    location: str(p.location),
    summary: str(p.summary),
    contact: {
      phone: str(p.contact?.phone),
      email: str(p.contact?.email),
      linkedin: str(p.contact?.linkedin),
      website: str(p.contact?.website),
    },
    top_skills: list(p.top_skills).map(str).filter(Boolean),
    languages: list(p.languages)
      .map((l) => ({ language: str(l?.language), proficiency: str(l?.proficiency) }))
      .filter((l) => l.language),
    certifications: list(p.certifications).map(str).filter(Boolean),
    honors_and_awards: list(p.honors_and_awards).map(str).filter(Boolean),
  };
}

// A record the extraction produced, as opposed to a null column or the raw CV
// text the build fell back to. Consumers that would otherwise judge a document
// against an empty evidence set check this first and report nothing instead of
// guessing — a validator that sees no roles must not conclude every role is
// invented.
export function isMaster(master) {
  return !!master && typeof master === 'object' && Array.isArray(master.work_experience);
}

// Every date string the record states, for checks that must confirm a document
// only carries dates the record holds.
export function allDates(master) {
  const out = [];
  for (const r of roles(master)) {
    if (r.start_date) out.push(r.start_date);
    if (r.end_date) out.push(r.end_date);
  }
  for (const e of education(master)) if (e.dates) out.push(e.dates);
  return out;
}

// Flat prose of everything the record evidences — the text a check greps when
// asking "does the master support this claim at all?".
export function evidenceText(master) {
  const p = profile(master);
  const parts = [p.summary, p.headline, ...p.top_skills, ...p.certifications, ...p.honors_and_awards];
  for (const r of roles(master)) {
    parts.push(r.company, r.role, r.location, r.via, ...r.bullets);
  }
  for (const a of advisory(master)) parts.push(a.company, a.role, ...a.bullets);
  for (const s of speaking(master)) parts.push(s.event, s.topic, s.role, s.location);
  for (const e of education(master)) parts.push(e.institution, e.qualification, e.location);
  for (const w of list(master?.publications_and_patents)) parts.push(str(w));
  return parts.filter(Boolean).join('\n');
}
