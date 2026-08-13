// __tests__/cover-provenance.test.js
//
// CV_RULES.md Layer 6, check 23 — vocabulary provenance in the cover letter.
//
// The defect this pins is a real run: a Product Owner ad at a Zlín software
// house asking for "finančně-poradenský business", banking, insurance or IFA
// experience. The letter came back describing the candidate's fintech
// background. The word "fintech" was in neither the ad nor the candidate's
// record — the model reached for it because the three finance nouns in the ad
// suggested a domain and it supplied the label itself. Every AI pass let it
// through: it carries no number, no date and no upgraded verb, so it is not a
// claim any of the five verify categories look at.
//
// Everything here calls the real validator. No mocks — validateCoverLetter is a
// pure function over strings.

import { describe, test, expect } from 'vitest';
import { validateCoverLetter } from '../utils/cv-validate.js';

// The candidate's real record: product ownership for financial-advisory groups,
// no bank, no fintech employer.
const MASTER = JSON.stringify({
  identity: { name: 'Nik Page' },
  experience: [
    {
      title: 'Product Owner',
      company: 'Salsita',
      dates: '01/2021 - 06/2024',
      location: 'Zlín, Czechia',
      achievements: ['Vedl dodávku pro skupinu finančních poradců a rozšířil objem účtu'],
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

const analysis = (extra = {}) => ({
  job_extraction: JOB,
  job_data: { Country: 'Czechia' },
  generation_framework: { cover_blueprint: {}, target_cover_words: 250 },
  ...extra,
});

const letter = (bodyText) =>
  `13.08.2026\n\nVážený pane Nováku,\n\n${bodyText}\n\nS pozdravem\n\n**Nik Page**`;

const unsourced = (text, opts = {}) => {
  const { warnings } = validateCoverLetter(text, { master: MASTER, analysis: analysis(), ...opts });
  return warnings.find((w) => w.code === 'coverUnsourced');
};

describe('check 23 — the letter may only use the ad’s words and the record’s', () => {
  test('the invented domain label is reported (the fintech regression)', () => {
    const w = unsourced(letter('Posledních pět let jsem strávil ve fintechu a rozumím tomu, co klient potřebuje.'));
    expect(w).toBeTruthy();
    expect(w.params.list).toMatch(/fintechu/i);
  });

  test('a letter built only from the ad and the record raises nothing', () => {
    const w = unsourced(letter(
      'Vedl jsem dodávku pro skupinu finančních poradců a rozšířil objem účtu. '
      + 'Rozumím prostředí nezávislého finančního poradenství a řízení softwarových produktů.'
    ));
    expect(w).toBeFalsy();
  });

  test('inflected forms count as their root — Czech suffixes are not new words', () => {
    // The ad says "bankovnictví" and "pojišťovnictví"; the letter declines them.
    const w = unsourced(letter('Prostředí bankovnictví i pojišťovnictvím jsem prošel u klienta, kterému jsem dodával produkt.'));
    expect(w).toBeFalsy();
  });

  test('a domain word the ad itself used is never reported, however unusual', () => {
    const w = unsourced(letter('Pracoval jsem v bankovnictví i v pojišťovnictví.'));
    expect(w).toBeFalsy();
  });

  test('an inferred industry on job_data does not whitelist the invention', () => {
    // job_data.Industry is the model's own inference, not the ad's words. If it
    // counted as a source, the analysis could launder the label into the letter
    // and this check would report nothing — which is the bug, not the fix.
    const w = unsourced(
      letter('Posledních pět let jsem strávil ve fintechu.'),
      { analysis: analysis({ job_data: { Country: 'Czechia', Industry: 'FinTech' } }) }
    );
    expect(w).toBeTruthy();
    expect(w.params.list).toMatch(/fintechu/i);
  });

  test('ordinary prose absent from both sources is not an invention', () => {
    // Every content word here is missing from the ad and the record, and none of
    // it claims a domain. The open version of this check flagged all of it; the
    // closed list is what keeps the banner worth reading.
    const w = unsourced(letter(
      'Děkuji za možnost spolupráce. Rád se s vámi potkám a probereme další kroky, '
      + 'protože tato pozice mi dává smysl.'
    ));
    expect(w).toBeFalsy();
  });

  test('with neither an ad nor a record the check reports nothing rather than guessing', () => {
    const { warnings } = validateCoverLetter(letter('Posledních pět let jsem strávil ve fintechu.'), {
      master: '',
      analysis: { generation_framework: {} },
    });
    expect(warnings.find((w) => w.code === 'coverUnsourced')).toBeFalsy();
  });

  test('an English invention is caught on the same basis', () => {
    const w = unsourced(letter(
      'My blockchain and cryptocurrency background makes me the obvious owner of this delivery.'
    ));
    expect(w).toBeTruthy();
    expect(w.params.list).toMatch(/blockchain/i);
    expect(w.params.list).toMatch(/cryptocurrency/i);
  });
});
