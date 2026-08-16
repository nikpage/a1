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
import { unevidencedKeywordHits, stripDuplicateSentences } from '../utils/cv-validate.js';

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

  test('no master and no analysis report nothing rather than guessing', () => {
    expect(unevidencedKeywordHits('anything at all', { master: '', analysis: ANALYSIS })).toEqual([]);
    expect(unevidencedKeywordHits('anything at all', { master: MASTER, analysis: null })).toEqual([]);
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
