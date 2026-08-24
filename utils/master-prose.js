// utils/master-prose.js
//
// The master CV, rendered as readable text instead of JSON.
//
// Why: the writer used to be handed the candidate's raw CV text. When the
// master became the single source of fact it started receiving
// JSON.stringify(master) — field names, braces, arrays of bullet strings. The
// cover letters that came out of it read as a list of achievements tightened
// into sentences, and the letter's texture tracked the record's, entry by
// entry: where the record narrates, the letter narrates; where it lists
// categories, the letter lists them back.
//
// This changes nothing about what is stored or what is true. Same facts, same
// order, nothing added, nothing dropped — only the shape they arrive in. It is
// plain string formatting: no AI call, no second copy to keep in sync.
//
// Every value is printed verbatim. This module never rewrites, summarises or
// infers, because the master is the evidence set the truth passes check the
// finished document against, and a paraphrase here would launder a claim.

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const arr = (v) => (Array.isArray(v) ? v : []);

function dates(entry) {
  const from = str(entry.start_date);
  const to = str(entry.end_date);
  if (from && to) return `${from} – ${to}`;
  return from || to || '';
}

function roleHeading(entry, depth) {
  const bits = [str(entry.title), str(entry.company)].filter(Boolean).join(' — ');
  const meta = [dates(entry), str(entry.location)].filter(Boolean).join(', ');
  const prefix = depth ? '  '.repeat(depth) : '';
  return `${prefix}${bits}${meta ? ` (${meta})` : ''}`;
}

function role(entry, depth, out) {
  out.push(roleHeading(entry, depth));
  for (const b of arr(entry.bullets)) {
    const t = str(b);
    if (t) out.push(`${'  '.repeat(depth)}- ${t}`);
  }
  const nested = arr(entry.fractional_engagements);
  if (nested.length) {
    out.push(`${'  '.repeat(depth)}  Engagements held under this practice:`);
    for (const n of nested) role(n, depth + 2, out);
  }
  out.push('');
}

export function masterToProse(master) {
  if (!master || typeof master !== 'object') return '';
  const out = [];
  const p = master.profile || {};

  const identity = [str(p.name), str(p.headline), str(p.location)].filter(Boolean);
  if (identity.length) out.push(identity.join(' | '));

  const c = p.contact || {};
  const contact = [str(c.email), str(c.phone), str(c.website), str(c.linkedin)].filter(Boolean);
  if (contact.length) out.push(`Contact: ${contact.join(' · ')}`);

  if (str(p.summary)) out.push('', str(p.summary));

  const langs = arr(p.languages)
    .map((l) => [str(l.language), str(l.proficiency)].filter(Boolean).join(' (') + (str(l.proficiency) ? ')' : ''))
    .filter(Boolean);
  if (langs.length) out.push('', `Languages: ${langs.join(', ')}`);

  const skills = arr(p.top_skills).map(str).filter(Boolean);
  if (skills.length) out.push(`Top skills: ${skills.join(', ')}`);

  const certs = arr(p.certifications).map(str).filter(Boolean);
  if (certs.length) out.push(`Certifications: ${certs.join('; ')}`);

  const honors = arr(p.honors_and_awards).map(str).filter(Boolean);
  if (honors.length) out.push(`Honours and awards: ${honors.join('; ')}`);

  if (str(master.voice_guide)) out.push('', 'HOW THIS PERSON DESCRIBES THEIR OWN WRITING STYLE (manner only, never a fact):', str(master.voice_guide));

  const work = arr(master.work_experience);
  if (work.length) {
    out.push('', 'WORK EXPERIENCE', '');
    for (const w of work) role(w, 0, out);
  }

  const advisory = arr(master.advisory_and_community);
  if (advisory.length) {
    out.push('ADVISORY AND COMMUNITY', '');
    for (const a of advisory) role(a, 0, out);
  }

  const talks = arr(master.speaking_and_lecturing);
  if (talks.length) {
    out.push('SPEAKING AND LECTURING', '');
    for (const t of talks) {
      const line = [str(t.role), str(t.topic)].filter(Boolean).join(': ');
      const where = [str(t.event), str(t.location), String(t.year || '').trim()].filter(Boolean).join(', ');
      out.push(`- ${line}${where ? ` — ${where}` : ''}`);
    }
    out.push('');
  }

  const pubs = arr(master.publications_and_patents);
  if (pubs.length) {
    out.push('PUBLICATIONS AND PATENTS', '');
    for (const pub of pubs) {
      if (typeof pub === 'string') { out.push(`- ${pub.trim()}`); continue; }
      const line = [str(pub.title), str(pub.publisher), String(pub.year || '').trim()].filter(Boolean).join(', ');
      if (line) out.push(`- ${line}`);
    }
    out.push('');
  }

  const edu = arr(master.education);
  if (edu.length) {
    out.push('EDUCATION', '');
    for (const e of edu) {
      const line = [str(e.qualification), str(e.institution)].filter(Boolean).join(' — ');
      const meta = [str(e.dates), str(e.location)].filter(Boolean).join(', ');
      out.push(`- ${line}${meta ? ` (${meta})` : ''}`);
    }
    out.push('');
  }

  const voice = arr(master.voice_samples).map(str).filter(Boolean);
  if (voice.length) {
    out.push('THE CANDIDATE\'S OWN WORDS, QUOTED VERBATIM (manner only, never a fact):', '');
    for (const v of voice) out.push(`"${v}"`);
    out.push('');
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
