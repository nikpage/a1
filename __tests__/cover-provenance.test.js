// __tests__/cover-provenance.test.js
//
// CV_RULES.md Layer 6 check 23 (the invented domain, REPAIRED not reported) and
// the steering precedence rule in the Invariants section.
//
// Both pin the same real run. A Product Owner ad at a Zlín software house asked
// for banking, insurance or independent financial advisory experience. The
// candidate's steering said: emphasise Zlín, the eBay client relationship and
// the financial-advisory projects; play down all the banks. The letter came back
// naming Česká spořitelna, Airbank and ČSOB throughout, and described the
// candidate's "fintech" background — a word in neither the ad nor the record.
//
// Two defects, two fixes:
//   1. "fintech" reached the page because no AI pass looks at a bare domain noun
//      (no number, no date, no upgraded verb) and check 23 only warned.
//   2. The banks led the letter because the blueprint's matched pairs and the
//      target-job block — both written during analysis, BEFORE the candidate
//      typed anything — order the writer to lead with evidence for each
//      requirement, and check 19 warns if a planned pair is missing. Steering
//      was one line against a plan repeated in detail downstream.
//
// Everything here calls the real modules — the real validator, the real prompt
// builders. No Gemini call is involved.

import { describe, test, expect } from 'vitest';
import { unsourcedDomainHits, validateCoverLetter } from '../utils/cv-validate.js';
import { buildPhraseRepairPrompt } from '../prompts/generation-verify.js';
import { buildCoverPrompt } from '../prompts/cover-letter.js';
import { buildCvPrompt } from '../prompts/cv-generator.js';
import { targetJobBlock } from '../prompts/job-target.js';

// The candidate's real record: delivery for financial-advisory groups and an
// eBay account. No fintech employer.
const MASTER = JSON.stringify({
  identity: { name: 'Nik Page' },
  experience: [
    {
      title: 'Product Owner',
      company: 'Salsita Software',
      dates: '01/2021 - 06/2024',
      location: 'Zlín, Czechia',
      achievements: ['Vedl účet eBay a zvýšil měsíční fakturaci', 'Dodával projekty pro finančně poradenské skupiny'],
    },
  ],
});

// The ad, as job_extraction records it — literal phrasing from the posting.
const JOB = {
  position_title: 'Product Owner',
  company: 'Blogic',
  location: 'Praha',
  must_have_requirements: [
    'znalost business prostředí bankovnictví, pojišťovnictví nebo nezávislého finančního poradenství (IFA)',
    'minimálně 5 let zkušeností s řízením softwarových produktů',
  ],
  responsibilities: ['produktová specifikace a analýza', 'řízení dodávky, milníky a rozpočet'],
};

const BLUEPRINT = {
  salutation_target: 'Deborah',
  matched_pairs: [
    { requirement: 'znalost bankovnictví', evidence: 'budoval UX v České spořitelně' },
    { requirement: 'řízení softwarových produktů', evidence: 'vedl dodávku v Salsita Software' },
    { requirement: 'práce s klientem', evidence: 'vedl účet eBay' },
  ],
};

const analysis = (extra = {}) => ({
  job_extraction: JOB,
  job_data: { Country: 'Czechia' },
  generation_framework: { cv_blueprint: {}, cover_blueprint: BLUEPRINT, target_cover_words: 250 },
  ...extra,
});

const letter = (bodyText) =>
  `13.08.2026\n\nVážený pane Nováku,\n\n${bodyText}\n\nS pozdravem\n\n**Nik Page**`;

const hits = (text, opts = {}) => unsourcedDomainHits(text, { master: MASTER, analysis: analysis(), ...opts });

describe('check 23 — an industry the letter invented for itself', () => {
  test('the fintech regression: the word is found so the repair pass can remove it', () => {
    const found = hits(letter('Mé zkušenosti s řízením dodávek zakázkového softwaru a fintech produktů jsou rozsáhlé.'));
    expect(found.join(' ')).toMatch(/fintech/i);
  });

  test('it is NOT a warning — the app’s own writing is repaired, never handed to the user', () => {
    const { warnings } = validateCoverLetter(
      letter('Mé zkušenosti s fintech produkty jsou rozsáhlé.'),
      { master: MASTER, analysis: analysis() }
    );
    expect(warnings.find((w) => w.code === 'coverUnsourced')).toBeFalsy();
  });

  test('a domain the ad itself used is never touched', () => {
    expect(hits(letter('Prostředí bankovnictví i pojišťovnictví znám z dodávek pro klienty.'))).toEqual([]);
  });

  test('inflected forms count as their root — Czech suffixes are not new words', () => {
    expect(hits(letter('Pojišťovnictvím i bankovnictvím jsem prošel u klienta.'))).toEqual([]);
  });

  test('an inferred industry on job_data does not whitelist the invention', () => {
    // job_data.Industry is the model's own inference, not the ad's words. If it
    // counted as a source, the analysis would launder the label into the letter.
    const found = hits(letter('Působím ve fintechu.'), {
      analysis: analysis({ job_data: { Country: 'Czechia', Industry: 'FinTech' } }),
    });
    expect(found.join(' ')).toMatch(/fintechu/i);
  });

  test('ordinary prose absent from both sources is not an invention', () => {
    expect(hits(letter('Děkuji za možnost spolupráce, rád se s vámi potkám a probereme další kroky.'))).toEqual([]);
  });

  test('with neither an ad nor a record it reports nothing rather than guessing', () => {
    expect(unsourcedDomainHits(letter('Působím ve fintechu.'), { master: '', analysis: null })).toEqual([]);
  });

  test('the repair prompt tells the model to drop the label, not swap in another industry', () => {
    const system = buildPhraseRepairPrompt({ docType: 'cover', document: 'x', hits: ['fintech'], kind: 'domain' })[0].content;
    expect(system).toContain('INVENTED INDUSTRY LABEL');
    expect(system).toContain('"fintech"');
    expect(system).toMatch(/Do NOT substitute a different industry/);
    expect(system).toMatch(/no domain label at all/);
  });

  test('the stock-phrase repair is unchanged by the new kind', () => {
    const system = buildPhraseRepairPrompt({ docType: 'cover', document: 'x', hits: ['proven track record'] })[0].content;
    expect(system).toContain('STOCK PHRASING');
    expect(system).toContain('"proven track record"');
    expect(system).not.toMatch(/substitute a different industry/);
  });
});

describe('steering outranks the plan, not just the writer', () => {
  const steering = 'Foreground and lead with: I really love Zlín\nPlay down, condense or place late: all the banks';

  test('the letter is told demoted content cannot be a matched pair’s evidence', () => {
    const text = buildCoverPrompt(MASTER, analysis(), 'formal', steering).map((m) => m.content).join('\n');
    expect(text).toContain('they outrank the plan');
    expect(text).toMatch(/Demoted content is not evidence/);
    expect(text).toMatch(/DROP that pair/);
    expect(text).toMatch(/Emphasised content leads/);
    // And it still cannot buy the emphasis with an invented fact.
    expect(text).toMatch(/NEVER invent a fact/);
  });

  test('the CV carries the same precedence, since the same plan drives it', () => {
    const text = buildCvPrompt(MASTER, analysis(), 'formal', steering).map((m) => m.content).join('\n');
    expect(text).toMatch(/outrank the blueprint itself/);
    expect(text).toMatch(/Demoted content is not the lead/);
    // T2 still holds: demotion reorders, it never removes a role or a date.
    expect(text).toMatch(/Demoted content is not deleted/);
  });

  test('with no steering the blocks stay absent exactly as before', () => {
    const text = buildCoverPrompt(MASTER, analysis(), 'formal', '').map((m) => m.content).join('\n');
    expect(text).not.toMatch(/outrank the plan/);
  });

  test('the target-job block no longer promotes demoted evidence unconditionally', () => {
    const block = targetJobBlock(analysis());
    expect(block).toMatch(/outrank this block/);
    expect(block).toMatch(/does NOT get promoted here/);
  });

  test('check 19 does not warn about a pair the candidate’s own instruction deleted', () => {
    // The letter drops the bank pair, exactly as told to. Without steering that
    // is a missing pair; with steering it is obedience, and warning for it would
    // be the check punishing the fix.
    const text = letter('Vedl jsem účet eBay a dodával projekty pro finančně poradenské skupiny ze Zlína.');
    const steered = validateCoverLetter(text, { master: MASTER, analysis: analysis(), tweak: steering });
    expect(steered.warnings.find((w) => w.code === 'coverPairsMissing')).toBeFalsy();

    const unsteered = validateCoverLetter(text, { master: MASTER, analysis: analysis() });
    expect(unsteered.warnings.find((w) => w.code === 'coverPairsMissing')).toBeTruthy();
  });
});
