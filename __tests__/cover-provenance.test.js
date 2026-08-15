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
//      typed anything — ordered the writer to lead with evidence for each
//      requirement, and check 19 warned if a planned pair was missing. Steering
//      was one line against a plan repeated in detail downstream. The plan is
//      gone: the analysis now supplies an unranked pool of evidence and the
//      letter is composed with the steering in hand.
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

const EVIDENCE = {
  requirement_evidence: [
    { requirement: 'znalost bankovnictví', evidence: 'budoval UX v České spořitelně' },
    { requirement: 'řízení softwarových produktů', evidence: 'vedl dodávku v Salsita Software' },
    { requirement: 'práce s klientem', evidence: 'vedl účet eBay' },
  ],
  concerns: [],
};

const analysis = (extra = {}) => ({
  job_extraction: JOB,
  job_data: { Country: 'Czechia' },
  generation_framework: { cv_blueprint: {}, cover_evidence: EVIDENCE, target_cover_words: 250 },
  ...extra,
});

const letter = (bodyText) =>
  `13.08.2026\n\nVážený pane Nováku,\n\n${bodyText}\n\nS pozdravem\n\n**Nik Page**`;

const hits = (text, opts = {}) => unsourcedDomainHits(text, { master: MASTER, ...opts });

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

  test('inflected forms count as their root — Czech suffixes are not new words', () => {
    // The master records "finančně poradenské skupiny"; the letter declines it.
    expect(hits(letter('Poradenským skupinám jsem dodával projekty.'))).toEqual([]);
  });

  test('a domain only the AD evidences is caught, since the ad is not the source', () => {
    const found = hits(letter('Mám za sebou roky v bankovnictví.'));
    expect(found.join(' ')).toMatch(/bankovnictví/i);
  });

  test('the AD naming an industry does not license the CANDIDATE claiming it', () => {
    // The hole that let "fintech" through a second time: Blogic's own blurb says
    // "specialisté na FinTech", so the ad carried the word and the letter then
    // claimed it as the candidate's background. An ad names where the EMPLOYER
    // works — evidence about them, never about the applicant. The master is the
    // only source, so an ad full of FinTech changes nothing here.
    const adWithFintech = { ...JOB, keywords_for_ats: ['FinTech', 'InsurTech'] };
    const found = unsourcedDomainHits(letter('Působím ve fintechu.'), {
      master: MASTER,
      analysis: analysis({ job_extraction: adWithFintech }),
    });
    expect(found.join(' ')).toMatch(/fintechu/i);
  });

  test('a domain the MASTER evidences is never touched', () => {
    const masterWithFintech = JSON.stringify({
      identity: { name: 'Nik Page' },
      experience: [{ title: 'Product Owner', company: 'Salsita', dates: '01/2021 - 06/2024', achievements: ['Dodával fintech produkty'] }],
    });
    expect(unsourcedDomainHits(letter('Dodával jsem fintech produkty.'), { master: masterWithFintech })).toEqual([]);
  });

  test('ordinary prose absent from both sources is not an invention', () => {
    expect(hits(letter('Děkuji za možnost spolupráce, rád se s vámi potkám a probereme další kroky.'))).toEqual([]);
  });

  test('with no record it reports nothing rather than guessing', () => {
    expect(unsourcedDomainHits(letter('Působím ve fintechu.'), { master: '' })).toEqual([]);
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

describe('steering is in scope when the letter is composed', () => {
  const steering = 'Foreground and lead with: I really love Zlín\nPlay down, condense or place late: all the banks';

  // Steering still outranks everything and still says demoted content is not
  // the lead — stated once now, in the steering block itself, rather than
  // repeated inside an evidence block that no longer exists.
  test('the letter is told demoted content is never the lead or the proof', () => {
    const text = buildCoverPrompt('MASTER', { analysis: {} }, 'Formal', steering).find((m) => m.role === 'user').content;
    expect(text).toMatch(/HIGHEST PRIORITY/);
    expect(text).toMatch(/stays out of the opening entirely/);
    expect(text).toMatch(/never the hook, the lead, or the proof you offer/);
    expect(text).toMatch(/Steering never adds a fact/);
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
    expect(text).not.toMatch(/HIGHEST PRIORITY/);
    expect(text).not.toMatch(/Demoted content is not evidence/);
  });

  test('the target-job block no longer promotes demoted evidence unconditionally', () => {
    const block = targetJobBlock(analysis());
    expect(block).toMatch(/outrank this block/);
    expect(block).toMatch(/does NOT get promoted here/);
  });

  test('check 19 no longer needs suspending — a letter that dropped the bank evidence still passes', () => {
    // The letter leaves the banking requirement unanswered, exactly as told to,
    // and answers the other two. Under the old plan that was a missing pair and
    // the check had to be switched off whenever steering was present. Now it
    // reads the letter rather than a plan, so the verdict is the same either way.
    const text = letter('Vedl jsem účet eBay a řídil dodávku softwarových produktů v Salsita Software ze Zlína.');
    const steered = validateCoverLetter(text, { master: MASTER, analysis: analysis(), tweak: steering });
    expect(steered.hard.join(' ')).not.toMatch(/answers none of/);

    const unsteered = validateCoverLetter(text, { master: MASTER, analysis: analysis() });
    expect(unsteered.hard.join(' ')).not.toMatch(/answers none of/);
  });
});
