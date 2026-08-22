// prompts/cv-sections.js
//
// The standard, ATS-parseable section names — per language, in one registry.
// Layer 1 permits only these headings, and a CV written in Czech has to satisfy
// that rule with Czech headings, not English ones. Both the generator (which
// must WRITE the right headings) and the validator (which must RECOGNISE them)
// read this module, so the two can never drift apart.
//
// Adding a language is one entry here and nothing else. Each slot holds an
// array: the FIRST value is canonical (what the generator is told to write),
// the rest are accepted variants a recruiter in that market would also expect,
// which the validator treats as equally valid.
//
// A language absent from the registry is not an error — see standardHeadings():
// the validator then falls back to the blueprint's own section_order, so an
// unlisted language is judged on the analysis's plan rather than hard-blocked
// for being unlisted.

export const SECTION_NAMES = {
  en: {
    summary: ['Summary', 'Professional Summary'],
    coreCompetencies: ['Core Competencies'],
    skills: ['Skills', 'Key Skills'],
    experience: ['Work Experience', 'Professional Experience', 'Experience'],
    projects: ['Projects'],
    engagements: ['Consulting Engagements', 'Client Engagements', 'Contract Engagements', 'Selected Engagements'],
    education: ['Education'],
    certifications: ['Certifications'],
    speaking: ['Speaking & Lecturing', 'Speaking and Lecturing', 'Speaking', 'Talks & Publications'],
    publications: ['Publications'],
    earlierCareer: ['Earlier Career'],
  },
  cs: {
    summary: ['Shrnutí', 'Profil', 'Profesní shrnutí'],
    coreCompetencies: ['Klíčové kompetence'],
    skills: ['Dovednosti', 'Klíčové dovednosti', 'Znalosti a dovednosti'],
    experience: ['Pracovní zkušenosti', 'Profesní zkušenosti', 'Praxe'],
    projects: ['Projekty'],
    engagements: ['Klientské zakázky', 'Poradenské zakázky', 'Vybrané zakázky'],
    education: ['Vzdělání'],
    certifications: ['Certifikace', 'Certifikáty'],
    speaking: ['Přednášky a konference', 'Přednášky', 'Vystoupení'],
    publications: ['Publikace'],
    earlierCareer: ['Dřívější kariéra', 'Předchozí praxe'],
  },
  pl: {
    summary: ['Podsumowanie', 'Profil', 'Podsumowanie zawodowe'],
    coreCompetencies: ['Kluczowe kompetencje'],
    skills: ['Umiejętności', 'Kluczowe umiejętności'],
    experience: ['Doświadczenie zawodowe', 'Doświadczenie'],
    projects: ['Projekty'],
    engagements: ['Realizacje dla klientów', 'Projekty doradcze', 'Wybrane realizacje'],
    education: ['Wykształcenie', 'Edukacja'],
    certifications: ['Certyfikaty', 'Certyfikacje'],
    speaking: ['Wystąpienia i wykłady', 'Wystąpienia', 'Wykłady'],
    publications: ['Publikacje'],
    earlierCareer: ['Wcześniejsza kariera', 'Wcześniejsze doświadczenie'],
  },
};

// Bullet-length band per language. Czech and Polish carry the same content in
// fewer words — no articles, heavy inflection — so an English 15-25 band flags
// perfectly good bullets as too short. The band is data, tuned per market.
export const BULLET_BAND = {
  en: [15, 25],
  cs: [12, 22],
  pl: [12, 22],
  default: [15, 25],
};

export function bulletBand(language) {
  return BULLET_BAND[normalise(language)] || BULLET_BAND.default;
}

function normalise(language) {
  const l = String(language || '').trim().toLowerCase();
  return l && l !== 'auto' ? l.slice(0, 2) : '';
}

// The names for ONE language, or null when it is not in the registry.
export function sectionNamesFor(language) {
  const l = normalise(language);
  return l && SECTION_NAMES[l] ? SECTION_NAMES[l] : null;
}

// Every accepted heading in every registered language, lowercased. The
// validator matches against the union rather than one language, because the
// document's language is not always known at validation time ('auto' resolves
// inside the model), and a creative section name still fails against the union.
export function standardHeadings() {
  const out = new Set();
  for (const lang of Object.values(SECTION_NAMES)) {
    for (const variants of Object.values(lang)) {
      for (const v of variants) out.add(v.toLowerCase());
    }
  }
  return out;
}

// Every accepted form of one slot, across all languages, lowercased.
export function headingsForSlot(slot) {
  const out = new Set();
  for (const lang of Object.values(SECTION_NAMES)) {
    for (const v of lang[slot] || []) out.add(v.toLowerCase());
  }
  return out;
}

export function isSlot(slot, heading) {
  return headingsForSlot(slot).has(String(heading || '').trim().toLowerCase());
}

// The heading instruction for the generator. With a known output language it
// names the exact headings to write; on 'auto' it states the rule without
// picking a language, since the model resolves that from the master CV.
export function sectionNameBlock(language) {
  const names = sectionNamesFor(language);
  if (!names) {
    return `Write the section headings as the standard, ATS-recognised names in the document's own language — the direct equivalents of Summary, Core Competencies, Skills, Work Experience, Projects, Education and Certifications, exactly as a recruiter in that market expects to see them. Never invent a heading, never translate one word-for-word into something no local recruiter uses.`;
  }
  const line = (slot, english) => `- ${english} → **${names[slot][0]}**`;
  return `Use EXACTLY these section headings (they are the standard, ATS-recognised names in this document's language):
${line('summary', 'Summary')}
${line('coreCompetencies', 'Core Competencies')}
${line('skills', 'Skills')}
${line('experience', 'Work Experience')}
${line('projects', 'Projects')}
${line('engagements', 'Consulting Engagements')} (client work delivered under an umbrella practice)
${line('education', 'Education')}
${line('certifications', 'Certifications')}
${line('earlierCareer', 'Earlier Career')} (the undated collapsed-roles section)`;
}
