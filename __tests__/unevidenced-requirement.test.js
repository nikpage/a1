// __tests__/unevidenced-requirement.test.js
//
// Two real defects, found by reading a shipped letter (KUBO, 2026-08-16).
//
// 1. CHECK 24 — the letter claimed "vyhodnocování dat v CRM" over a master
//    record containing no occurrence of CRM. The analysis had already listed
//    CRM under ats_keywords_missing, twice, and nothing enforced it; the AI
//    verify pass's BORROWED REQUIREMENT category did not fire because the claim
//    was phrased as routine habit rather than as "extensive CRM experience".
//    Note the second reason it could never have been caught by check 23's
//    machinery: stem() discards anything under four characters, so every
//    three-letter requirement (CRM, SQL, SAP, ERP) was structurally invisible.
//
// 2. CHECK 25 — "My focus is on user adoption, structured relationship
//    building, and client success." printed verbatim in two paragraphs of one
//    letter.
//
// Both are red on the old code: neither function existed.

import { describe, test, expect } from 'vitest';
import { unevidencedKeywordHits, stripDuplicateSentences, validateCv } from '../utils/cv-validate.js';

const MASTER = JSON.stringify({
  identity: { name: 'Nik Page', country: 'Czech Republic' },
  experience: [
    {
      company: 'Salsita Software',
      role: 'Sr Product & Account Manager',
      dates: '11/2022 - 10/2023',
      achievements: [{ text: 'Managed enterprise client accounts including eBay, directing solution design.' }],
    },
  ],
});

const ANALYSIS = { analysis: { ats_keywords_missing: 'CRM, vztahy se školami, Kubernetes' } };

describe('check 24 — a requirement the record cannot answer', () => {
  test('catches the three-letter acronym that stem() could never see', () => {
    const letter = 'Používám je k organizaci práce a vyhodnocování dat v CRM.';
    expect(unevidencedKeywordHits(letter, { master: MASTER, analysis: ANALYSIS })).toEqual(['CRM']);
  });

  test('catches a longer borrowed term through its stem', () => {
    const letter = 'I have run Kubernetes clusters in production for years.';
    expect(unevidencedKeywordHits(letter, { master: MASTER, analysis: ANALYSIS })).toContain('kubernetes');
  });

  test('says nothing about a term the letter never used', () => {
    const letter = 'I managed the eBay account at Salsita Software.';
    expect(unevidencedKeywordHits(letter, { master: MASTER, analysis: ANALYSIS })).toEqual([]);
  });

  // The MASTER is the evidence, not the analysis. A stale or wrong missing-list
  // must never cut a claim the record actually supports.
  test('never reports a term the master evidences, even if listed as missing', () => {
    const master = JSON.stringify({ experience: [{ company: 'X', role: 'Y', achievements: [{ text: 'Ran the CRM migration.' }] }] });
    const letter = 'I ran the CRM migration end to end.';
    expect(unevidencedKeywordHits(letter, { master, analysis: ANALYSIS })).toEqual([]);
  });

  test('multi-word advice is not treated as a checkable claim', () => {
    const letter = 'Budoval jsem vztahy se školami po celé republice.';
    expect(unevidencedKeywordHits(letter, { master: MASTER, analysis: ANALYSIS })).toEqual([]);
  });

  // The model writes this list for a human, so the term arrives inside a phrase
  // as often as alone. A real analysis (2026-08-16) said "CRM software
  // administration" — matching the phrase whole finds nothing, and CRM slipped
  // through a second time.
  test('pulls the acronym out of a multi-word entry', () => {
    const analysis = { analysis: { ats_keywords_missing: 'CRM software administration, primary/secondary school outreach, B2B sales metrics' } };
    const letter = 'Vyhodnocuji data v CRM každý týden.';
    expect(unevidencedKeywordHits(letter, { master: MASTER, analysis })).toEqual(['CRM']);
  });

  // The ordinary words around an acronym are too common to carry a claim, and
  // cutting one would damage a true sentence.
  test('ignores the ordinary words in a multi-word entry', () => {
    const analysis = { analysis: { ats_keywords_missing: 'primary/secondary school outreach' } };
    const letter = 'I have worked with school directors and teachers on outreach programmes.';
    expect(unevidencedKeywordHits(letter, { master: MASTER, analysis })).toEqual([]);
  });

  test('no master and no analysis report nothing rather than guessing', () => {
    expect(unevidencedKeywordHits('anything at all', { master: '', analysis: ANALYSIS })).toEqual([]);
    expect(unevidencedKeywordHits('anything at all', { master: MASTER, analysis: null })).toEqual([]);
  });
});

// THE DENY-LIST IS COMPUTED FROM THE AD, NOT TAKEN FROM THE MODEL.
//
// ats_keywords_missing comes from the same call that writes
// ats_keywords_present, under a prompt telling it to be generous about what
// counts as present — so a term the model wrongly reads as earned is absent
// from the missing list, and the deny-list is empty in the case that leaks. On
// the KUBO run that is how "B2B" reached the CV while "CRM" was caught.
//
// Red on the old code: missingTerms() read ats_keywords_missing alone.
describe('the deny-list reads the ad itself', () => {
  test('catches an ad acronym the missing-list never mentioned', () => {
    const analysis = {
      analysis: { ats_keywords_missing: 'Kubernetes' },
      job_text: 'Hledáme obchodníka pro B2B prodej do škol. Práce s CRM výhodou.',
    };
    const letter = 'Mám zkušenost s B2B prodejem.';
    expect(unevidencedKeywordHits(letter, { master: MASTER, analysis })).toEqual(['B2B']);
  });

  test('the employer name and advertised title are never cut', () => {
    const analysis = {
      job_text: 'KUBO hledá SDR pro české školy.',
      job_extraction: { company: 'KUBO', job_title: 'SDR' },
    };
    const letter = 'Rád pomohu KUBO na českých školách jako SDR.';
    expect(unevidencedKeywordHits(letter, { master: MASTER, analysis })).toEqual([]);
  });

  test('an ad term the master evidences is still never cut', () => {
    const analysis = { job_text: 'Hledáme obchodníka pro B2B prodej.' };
    const master = JSON.stringify({ experience: [{ company: 'X', role: 'Y', achievements: [{ text: 'Ran B2B accounts.' }] }] });
    expect(unevidencedKeywordHits('I ran B2B accounts.', { master, analysis })).toEqual([]);
  });
});

// CHECK 26 — the CV leaks the same way the letter does, and check 14's flat
// five-letter stem match clears "B2B Client Relations" off a 2003 line reading
// "Internal client relations".
//
// Red on the old code: checkAdTerms() did not exist.
describe('check 26 — a borrowed requirement in a CV skill or headline', () => {
  const analysis = {
    analysis: { ats_keywords_missing: 'CRM' },
    job_text: 'B2B account management for Czech schools. CRM a výhodou.',
    generation_framework: { cv_blueprint: { section_order: ['Summary', 'Skills', 'Work Experience'] } },
  };
  const cv = (skills, headline = 'Product Strategy Leader') => [
    '# Nik Page',
    `**${headline}**`,
    '',
    '### Summary',
    'Product leader who managed enterprise client accounts including eBay.',
    '',
    '### Skills',
    ...skills.map((s) => `- ${s}`),
    '',
    '### Work Experience',
    '',
    '#### **Sr Product & Account Manager**',
    '**Salsita Software** | 11/2022 - 10/2023',
    '- Managed enterprise client accounts including eBay, directing solution design.',
  ].join('\n');

  const adFaults = (doc) => validateCv(doc, { master: MASTER, analysis })
    .hard.filter((h) => h.includes('comes from the job ad'));

  test('hard-fails a listed skill the ad supplied and the record does not', () => {
    const faults = adFaults(cv(['B2B Client Relations']));
    expect(faults).toHaveLength(1);
    expect(faults[0]).toContain('B2B');
  });

  test('hard-fails the same term in the headline', () => {
    const faults = adFaults(cv(['Product Management'], 'B2B Account Manager'));
    expect(faults).toHaveLength(1);
    expect(faults[0]).toContain('B2B');
  });

  test('leaves the CV alone when the record evidences the term', () => {
    const master = JSON.stringify({ experience: [{ company: 'X', role: 'Y', achievements: [{ text: 'Ran B2B client relations.' }] }] });
    const faults = validateCv(cv(['B2B Client Relations']), { master, analysis })
      .hard.filter((h) => h.includes('comes from the job ad'));
    expect(faults).toEqual([]);
  });

  test('prose is left to the verify pass — only the typed slots fail hard', () => {
    const doc = cv(['Product Management']).replace(
      'Product leader who managed enterprise client accounts including eBay.',
      'Product leader familiar with the B2B world and CRM tooling.',
    );
    expect(adFaults(doc)).toEqual([]);
  });
});

describe('check 25 — the same sentence printed twice', () => {
  const DUPE = 'My focus is on user adoption, structured relationship building, and client success.';

  test('cuts the later repeat and keeps the first', () => {
    const letter = `Dear Hiring Team,\n\n${DUPE} I led the eBay account at Salsita.\n\nSchools need a partner. ${DUPE}\n\nSincerely,`;
    const out = stripDuplicateSentences(letter);
    expect(out.split(DUPE)).toHaveLength(2); // one occurrence left
    expect(out).toContain('I led the eBay account at Salsita.');
    expect(out).toContain('Schools need a partner.');
  });

  test('ignores case and spacing differences when matching', () => {
    const letter = `${DUPE}\n\nSomething else entirely happened here.\n\nMY FOCUS IS ON USER ADOPTION, STRUCTURED RELATIONSHIP BUILDING, AND CLIENT SUCCESS.`;
    const out = stripDuplicateSentences(letter);
    expect(out.toLowerCase().split('my focus is on user adoption')).toHaveLength(2);
  });

  test('leaves a short deliberate echo alone', () => {
    const letter = 'It works. Something else happened in between here. It works.';
    expect(stripDuplicateSentences(letter)).toBe(letter);
  });

  test('leaves a clean document untouched', () => {
    const letter = 'I led the eBay account at Salsita Software.\n\nI taught at Charles University in Prague.';
    expect(stripDuplicateSentences(letter)).toBe(letter);
  });
});
