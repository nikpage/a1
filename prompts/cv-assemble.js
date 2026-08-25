// prompts/cv-assemble.js
//
// THE DOCUMENT IS WRITTEN HERE, not by the model.
//
// On 2026-08-25 the CV's structure was put to the writer three ways — stated as
// rules in the production prompt, written out verbatim as a skeleton inside that
// prompt, and written out verbatim inside a four-line minimal prompt. All three
// dissolved the client engagements into the parent's bullets; the minimal one
// also dropped every heading, re-dated everything long-form and printed roles
// back to 1993. A structure the model can restate is a structure it can ignore.
//
// So the model is asked for CONTENT as data — a headline, prose highlights, ATS
// terms, and bullets keyed to slots it did not choose — and this file assembles
// the markdown. Headings, employers, dates, nesting depth, the Earlier Career
// line and the section order are never the model's to pick.
//
// Nothing here interprets the record. Every heading, employer and date is copied
// from it; the only judgement is which CONTENT the model returned for each slot.

import { renderWorkExperience } from './cv-skeleton.js';
import { sectionNamesFor } from './cv-sections.js';

// The heading this document uses for each slot. The registry's canonical name
// wins, except where a run settled on a different word: "Highlights" beat
// "Summary" on 2026-08-25 (the Summary shape walked the roles one per employer
// through three rounds of instruction; renaming it and asking for prose fixed it
// in one), and "Recognition" carries awards as well as certifications. Both are
// registered as accepted variants in cv-sections.js so Layer 6 check 4 passes.
const PREFERRED_EN = { summary: 'Highlights', certifications: 'Recognition' };

function headings(language) {
  const names = sectionNamesFor(language) || sectionNamesFor('en');
  const en = (sectionNamesFor(language) === null) || String(language || '').toLowerCase().startsWith('en');
  const pick = (slot) => (en && PREFERRED_EN[slot]) || names[slot][0];
  return {
    summary: pick('summary'),
    skills: pick('skills'),
    experience: pick('experience'),
    education: pick('education'),
    certifications: pick('certifications'),
    speaking: pick('speaking'),
    publications: pick('publications'),
  };
}

const list = (arr) => (Array.isArray(arr) ? arr.map((v) => (typeof v === 'string' ? v.trim() : v)).filter(Boolean) : []);

// The contact line. The master stores these under profile.contact; older and
// hand-built records keep them flat on profile, and the assembler read only the
// flat form until 2026-08-25 — so every assembled CV shipped with no phone,
// no email and no LinkedIn on it. Both shapes are read, in that order.
export function contactLine(profile = {}) {
  const c = (profile.contact && typeof profile.contact === 'object') ? profile.contact : {};
  const parts = [
    profile.location || c.location,
    c.phone || profile.phone,
    c.email || profile.email,
    c.linkedin || profile.linkedin,
    c.website || profile.website,
    ...list(profile.links || profile.urls),
  ];
  return [...new Set(parts.map((p) => String(p || '').trim()).filter(Boolean))].join(' | ');
}

// One speaking entry as a line. The record's own words; nothing is rephrased.
function speakingLine(entry) {
  if (typeof entry === 'string') return entry.trim();
  const head = [entry?.role, entry?.topic].filter(Boolean).join(': ');
  const tail = [entry?.event, entry?.location, entry?.year].filter(Boolean).join(', ');
  return [head, tail].filter(Boolean).join(' — ');
}

// The blueprint's evidence_from_speaking roster, split into the two sections it
// spans. An entry is a publication when the record lists it as one; everything
// else is a talk. Each roster item is already written as the record spells it,
// so a talk is printed through the record's own entry where one matches and
// verbatim where it does not.
function splitRoster(master, roster) {
  const wanted = list(roster).map((r) => String(r).trim()).filter(Boolean);
  const talks = list(master?.speaking_and_lecturing);
  const papers = list(master?.publications_and_patents).map((p) => String(p));
  const speaking = [];
  const publications = [];

  for (const want of wanted) {
    const low = want.toLowerCase();
    const paper = papers.find((p) => low.includes(p.toLowerCase()) || p.toLowerCase().includes(low));
    if (paper) { publications.push(paper); continue; }
    const talk = talks.find((t) => {
      const topic = String(t?.topic || '').toLowerCase();
      const event = String(t?.event || '').toLowerCase();
      return (topic && low.includes(topic)) || (event && low.includes(event));
    });
    speaking.push(talk ? speakingLine(talk) : want);
  }
  return { speaking, publications };
}

/**
 * Assemble the finished CV.
 *
 * `content` is what the model returned: { headline, highlights, skills[],
 * bullets{}, speaking[], publications[], recognition[] }. `skeleton` is the
 * structure built from the record by buildSkeleton().
 *
 * `olderApplicant` strips graduation years from EVERY education entry — all or
 * none, never selectively (Layer 6 check 10 is a hard block on a stray year).
 */
export function assembleCv(master, content = {}, skeleton, { language = 'auto', olderApplicant = false, roster = [] } = {}) {
  const h = headings(language);
  const p = (master?.profile && typeof master.profile === 'object') ? master.profile : {};
  const doc = [];

  const contact = contactLine(p);
  doc.push('<center>', '', `# ${String(p.name || '').trim()}`);
  if (content.headline) doc.push(`**${String(content.headline).trim()}**`);
  if (contact) doc.push(contact);
  doc.push('', '</center>', '', '---', '');

  if (content.highlights) doc.push(`### **${h.summary}**`, String(content.highlights).trim(), '', '---', '');

  const skills = list(content.skills);
  if (skills.length) doc.push(`### **${h.skills}**`, ...skills.map((s) => `- ${s}`), '', '---', '');

  const work = renderWorkExperience(skeleton, content.bullets || {});
  if (work) doc.push(`### **${h.experience}**`, '', work, '', '---', '');

  // Speaking and Publications are the ANALYSIS's pick, not the writer's: it
  // chooses by the SUBJECT that answers this ad, and the writer given a free
  // choice reached for the record's most recent talks instead. Layer 6 fails a
  // document that drops a rostered entry, so printing the roster is the only
  // way it can pass — and the same reasoning as the Earlier Career roster.
  const { speaking, publications } = splitRoster(master, roster);
  if (speaking.length) {
    // The reader is always told how much the record holds beyond what fits:
    // four entries out of twenty-eight read as a thin record unless the
    // remainder is stated.
    const others = list(master?.speaking_and_lecturing).length - speaking.length;
    const lines = others > 0 ? [...speaking, `and ${others} others`] : speaking;
    doc.push(`### **${h.speaking}**`, ...lines.map((s) => `- ${s}`), '', '---', '');
  }
  if (publications.length) doc.push(`### **${h.publications}**`, ...publications.map((s) => `- ${s}`), '', '---', '');

  // EVERY education entry, under one heading. The script this came from printed
  // the heading and then broke after the first entry, so a second degree was
  // silently dropped.
  const education = list(master?.education);
  if (education.length) {
    doc.push(`### **${h.education}**`);
    for (const e of education) {
      const left = [e.qualification, e.institution].filter(Boolean).join(' | ');
      const dates = olderApplicant ? '' : String(e.dates || '').trim();
      doc.push(dates ? `**${left}** | ${dates}` : `**${left}**`);
    }
    doc.push('', '---', '');
  }

  const recognition = list(content.recognition);
  if (recognition.length) doc.push(`### **${h.certifications}**`, ...recognition.map((s) => `- ${s}`));

  return doc.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}
