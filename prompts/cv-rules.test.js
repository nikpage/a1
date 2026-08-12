// prompts/cv-rules.test.js
import { describe, it, expect } from 'vitest';
import { cvInvariants, machineParseability, humanScannability, jobMatchingRules, coverMatchingRule, cvRulesBlock } from './cv-rules.js';
import { marketConventions, targetCountry, coverWordBand, coverLengthRule } from './market.js';
import { scenarioGenerationRules, SCENARIOS } from './scenarios.js';
import { buildCvPrompt } from './cv-generator.js';
import { buildCoverPrompt } from './cover-letter.js';
import { SECTION_NAMES, isSlot, bulletBand } from './cv-sections.js';

describe('the invariants', () => {
  it('states all four, unoverridable', () => {
    const t = cvInvariants();
    expect(t).toContain('T1');
    expect(t).toContain('T2');
    expect(t).toContain('T3');
    expect(t).toContain('T4');
    expect(t).toMatch(/Omission is permitted; alteration is not/);
  });
});

describe('Layer 1', () => {
  it('demands MM/YYYY and forbids year-only hiding', () => {
    const t = machineParseability();
    expect(t).toContain('MM/YYYY');
    expect(t).toMatch(/NEVER switch to year-only dates/);
  });

  // The rule used to tell the writer to print 01/YYYY when the master held only
  // a year. That is an invented month — a falsified date under T2 — so the bare
  // year stands and the missing month is reported to the candidate instead.
  it('never invents a month to complete MM/YYYY', () => {
    const t = machineParseability();
    expect(t).toMatch(/never invent a month/i);
    expect(t).toMatch(/print that bare year/i);
    expect(t).not.toContain('print 01/YYYY');
  });

  it('makes Earlier Career the only undated entry and single column the layout', () => {
    const t = machineParseability();
    expect(t).toMatch(/only permitted undated entry/i);
    expect(t).toContain('single column');
  });

  // A shipped CV collapsed Morgan Stanley into "financial institutions and tech
  // companies" — the one marquee name on the line, dissolved.
  it('requires the Earlier Career line to name employers individually', () => {
    const t = machineParseability();
    expect(t).toMatch(/NAME the employers individually/);
    expect(t).toMatch(/is NOT a substitute for a name/);
    expect(t).toMatch(/location where the location itself carries weight/);
  });

  // A real CV filed "Visiting Lecturer, Faculty of Arts, Charles University" as
  // the candidate's education — the institution's name was taken as a
  // qualification. Education carries only what was AWARDED to the candidate.
  it('keeps a teaching appointment out of Education', () => {
    const t = machineParseability();
    expect(t).toMatch(/ONLY qualifications AWARDED to the candidate/);
    expect(t).toMatch(/teach, lecture, guest-lecture or examine/);
    expect(t).toMatch(/belongs in Work Experience/);
  });
});

describe('Layer 2', () => {
  it('defines the impact zone by word count, not rendered lines', () => {
    const t = humanScannability();
    expect(t).toContain('~120 words');
    expect(t).toMatch(/Counted by words from the VERY TOP/);
    // The headline and the name block sit above the Summary heading and are read
    // first, so they spend the 120 words too — counting from the Summary let a
    // long header push the achievements out of the zone unmeasured.
    expect(t).toMatch(/name\/contact block, the headline/);
  });

  // The impact zone carries the achievements: a recruiter who reads only the top
  // block still sees the three strongest results, so the repeat under each role
  // is intended. Three is a ceiling, never a quota.
  it('requires up to three role-naming achievement bullets in the Summary', () => {
    const t = humanScannability();
    expect(t).toMatch(/UP TO THREE achievement bullets/);
    expect(t).toMatch(/NAMES the role and employer/);
    expect(t).toMatch(/CEILING, never a quota/);
    expect(t).not.toMatch(/Summary contains NO bullets/);
  });

  // The repeat is deliberate; repeating the SENTENCE is not — a shipped CV put
  // the identical wording in both places and read as the same page twice.
  it('requires the Summary bullet to re-angle, not copy, its role bullet', () => {
    const t = humanScannability();
    expect(t).toMatch(/NEVER in the same words/);
    expect(t).toMatch(/COMPRESSED, RE-ANGLED/);
    expect(JSON.stringify(buildCvPrompt('x', {}, 'Formal'))).toMatch(/Copying the role's sentence up here word for word is a defect/);
  });

  // "A veteran technology leader" opened a shipped CV — a category asserted in
  // place of evidence, and an age signal under the Older Applicant override.
  it('bans identity epithets in the opening', () => {
    const t = humanScannability();
    expect(t).toMatch(/Openers name facts, not identities/);
    for (const word of ['veteran', 'seasoned', 'accomplished']) {
      expect(t).toContain(word);
    }
  });

  it('tells the generator to write those bullets into the Summary block', () => {
    const p = buildCvPrompt({ cv: 'x', analysis: {}, tone: 'Formal' });
    const text = JSON.stringify(p);
    expect(text).toMatch(/top_three_achievements/);
    expect(text).toMatch(/naming the role and employer it came from/);
    expect(text).toMatch(/No heading markers/);
  });

  it('states bullet ceilings as ceilings, never quotas', () => {
    const t = humanScannability();
    expect(t).toMatch(/CEILINGS, never quotas/);
    expect(t).toContain('15-25 words');
  });

  // Czech and Polish carry the same content in fewer words — no articles, heavy
  // inflection — so an English 15-25 band pads every bullet on a Czech CV.
  it('gives the generator the bullet band for the document language', () => {
    expect(humanScannability('cs')).toContain('12-22 words');
    expect(humanScannability('pl')).toContain('12-22 words');
    expect(humanScannability('en')).toContain('15-25 words');
    expect(humanScannability('auto')).toContain('15-25 words');
    expect(humanScannability('de')).toContain('15-25 words');
  });

  it('carries that band through the whole rule stack into the CV prompt', () => {
    expect(cvRulesBlock(true, 'cs')).toContain('12-22 words');
    expect(JSON.stringify(buildCvPrompt('x', {}, 'Formal', '', '', 'cs'))).toContain('12-22 words');
    expect(JSON.stringify(buildCvPrompt('x', {}, 'Formal', '', '', 'en'))).toContain('15-25 words');
  });
});

describe('Layer 3', () => {
  it('is silent with no job ad', () => {
    expect(jobMatchingRules(false)).toBe('');
    expect(coverMatchingRule(false)).toBe('');
  });

  it('bounds coverage and pairs three requirements in the letter', () => {
    expect(jobMatchingRules(true)).toMatch(/never quietly filled/);
    expect(coverMatchingRule(true)).toMatch(/three matched pairs/i);
  });
});

describe('Layer 4 — scenarios', () => {
  it('no longer tells Job Returner to use year-only dates', () => {
    for (const s of Object.values(SCENARIOS)) {
      expect(s.generation).not.toMatch(/year-only dates to reduce/i);
    }
    expect(SCENARIOS['Job Returner'].generation).toMatch(/NEVER use year-only dates/);
  });

  it('strips every graduation year for Older Applicant, never selectively', () => {
    expect(SCENARIOS['Older Applicant'].generation).toMatch(/all of them or none, never selectively/);
  });

  it('caps active overrides at two', () => {
    const block = scenarioGenerationRules(['Career Pivot', 'Older Applicant', 'Overqualified']);
    expect(block).toContain('Career Pivot:');
    expect(block).toContain('Older Applicant:');
    expect(block).not.toContain('Overqualified:');
  });

  it('gives Career Pivot the Core Competencies block and Under-qualified the no-years rule', () => {
    expect(SCENARIOS['Career Pivot'].generation).toContain('Core Competencies');
    expect(SCENARIOS['Under-qualified'].generation).toMatch(/Do NOT state years of experience/);
  });
});

describe('Layer 5 — market', () => {
  it('picks the job country over the CV country', () => {
    expect(targetCountry({ job_data: { Country: 'Germany' }, cv_data: { Country: 'Poland' } })).toBe('Germany');
    expect(targetCountry({ job_data: { Country: 'n/a' }, cv_data: { Country: 'Poland' } })).toBe('Poland');
    expect(targetCountry({})).toBe('');
  });

  it('applies anglo rules to the UK and DACH rules to Germany', () => {
    expect(marketConventions({ job_data: { Country: 'United Kingdom' } })).toMatch(/No photo, no date of birth/);
    expect(marketConventions({ job_data: { Country: 'Germany' } })).toMatch(/conventional here/);
  });

  it('gives CZ/PL the short-letter band and everyone else the neutral one', () => {
    expect(coverWordBand({ job_data: { Country: 'Czech Republic' } })).toEqual({ min: 200, max: 300, target: 250 });
    expect(coverWordBand({ job_data: { Country: 'Poland' } })).toEqual({ min: 200, max: 300, target: 250 });
    expect(coverWordBand({ job_data: { Country: 'United Kingdom' } })).toEqual({ min: 250, max: 350, target: 275 });
    expect(coverWordBand({ job_data: { Country: 'Germany' } })).toEqual({ min: 250, max: 350, target: 275 });
    // Unknown and absent countries take the neutral band, never the CZ one.
    expect(coverWordBand({ cv_data: { Country: 'Atlantis' } })).toEqual({ min: 250, max: 350, target: 275 });
    expect(coverWordBand({})).toEqual({ min: 250, max: 350, target: 275 });
  });

  it('follows the CV country when there is no job ad', () => {
    expect(coverWordBand({ cv_data: { Country: 'CZ' } }).max).toBe(300);
    // The job's market wins over the candidate's own.
    expect(coverWordBand({ job_data: { Country: 'US' }, cv_data: { Country: 'CZ' } }).max).toBe(350);
  });

  it('states the band as a ceiling and clamps the analysis word target into it', () => {
    const cz = coverLengthRule({ job_data: { Country: 'CZ' } });
    expect(cz).toMatch(/200-300 words/);
    expect(cz).not.toMatch(/250-350/);
    expect(cz).toMatch(/only if it falls inside 200-300/);
    expect(cz).toMatch(/CEILING, not a quota/);
    expect(coverLengthRule({})).toMatch(/250-350 words/);
  });

  it('falls back to the neutral default for an unknown market and never invents personal data', () => {
    const t = marketConventions({ cv_data: { Country: 'Atlantis' } });
    expect(t).toMatch(/No market-specific convention is known/);
    expect(t).toMatch(/never generate a photo/);
  });
});

describe('the prompts actually carry the rules', () => {
  const analysis = {
    analysis: { scenario_tags: ['Career Pivot'] },
    cv_data: { Country: 'Ireland' },
    job_extraction: { position_title: 'Product Manager', must_have_requirements: ['Roadmapping'] },
    generation_framework: { cv_blueprint: { top_three_achievements: ['Shipped X at Acme'] } },
  };

  it('puts every layer in the CV prompt and no flex-grid skills block', () => {
    const [, user] = buildCvPrompt('MASTER', analysis, 'confident');
    expect(user.content).toContain('T1 — Never fabricate');
    expect(user.content).toContain('Layer 1 — Machine parseability');
    expect(user.content).toContain('Layer 2 — Human scannability');
    expect(user.content).toContain('Layer 3 — Job matching');
    expect(user.content).toContain('Layer 4 — Situational overrides');
    expect(user.content).toContain('Layer 5 — Market conventions');
    expect(user.content).not.toContain('display: flex');
    expect(user.content).not.toContain('<div');
    expect(user.content).toContain('top_three_achievements');
  });

  it('omits Layer 3 from the CV prompt when there is no job ad', () => {
    const [, user] = buildCvPrompt('MASTER', { analysis: { scenario_tags: [] }, cv_data: { Country: 'Ireland' } }, 'confident');
    expect(user.content).not.toContain('Layer 3 — Job matching');
    expect(user.content).toContain('Layer 1 — Machine parseability');
  });

  it('binds the cover letter to the invariants and the matched pairs', () => {
    const [, user] = buildCoverPrompt('MASTER', analysis, 'confident');
    expect(user.content).toContain('T1 — Never fabricate');
    expect(user.content).toMatch(/three matched pairs/i);
  });

  it('carries the market word band into the cover prompt itself', () => {
    const [, cz] = buildCoverPrompt('MASTER', { analysis: {}, job_data: { Country: 'Czech Republic' } }, 'confident');
    expect(cz.content).toMatch(/200-300 words/);
    expect(cz.content).not.toMatch(/250-350/);
    const [, uk] = buildCoverPrompt('MASTER', { analysis: {}, job_data: { Country: 'United Kingdom' } }, 'confident');
    expect(uk.content).toMatch(/250-350 words/);
  });

  it('tells the letter to make one argument, not to walk the guidance list', () => {
    const [, user] = buildCoverPrompt('MASTER', analysis, 'confident');
    expect(user.content).toMatch(/makes ONE argument/);
    expect(user.content).toMatch(/material, not a running order/i);
    // The old instruction turned the action items into a checklist.
    expect(user.content).not.toMatch(/Work through the guidance/);
  });

  it('carries the active scenario into the cover letter, in its letter form', () => {
    const [, user] = buildCoverPrompt('MASTER', { analysis: { scenario_tags: ['Older Applicant'] } }, 'confident');
    expect(user.content).toContain('Layer 4 — Situational overrides');
    expect(user.content).toContain('Older Applicant:');
    // The CV mitigation is meaningless in a letter and must not appear.
    expect(user.content).not.toMatch(/Strip graduation years|markdown structure/);
  });

  it('omits Layer 4 from the cover letter when no scenario is tagged', () => {
    const [, user] = buildCoverPrompt('MASTER', { analysis: {} }, 'confident');
    expect(user.content).not.toContain('Layer 4 — Situational overrides');
  });

  it('leaves the matched-pairs rule out of a letter with no job ad', () => {
    const [, user] = buildCoverPrompt('MASTER', { analysis: {} }, 'confident');
    expect(user.content).not.toMatch(/three matched pairs/i);
  });
});

describe('cvRulesBlock', () => {
  it('stacks the layers in precedence order', () => {
    const b = cvRulesBlock(true);
    expect(b.indexOf('Invariants')).toBeLessThan(b.indexOf('Layer 1'));
    expect(b.indexOf('Layer 1')).toBeLessThan(b.indexOf('Layer 2'));
    expect(b.indexOf('Layer 2')).toBeLessThan(b.indexOf('Layer 3'));
  });
});

describe('section names per language', () => {
  it('gives the generator the exact Czech headings when Czech is chosen', () => {
    const [, user] = buildCvPrompt('MASTER', { analysis: { scenario_tags: [] } }, 'confident', '', '', 'cs');
    expect(user.content).toContain('Pracovní zkušenosti');
    expect(user.content).toContain('Shrnutí');
    expect(user.content).toContain('Dřívější kariéra');
  });

  it('states the rule without naming a language on auto', () => {
    const [, user] = buildCvPrompt('MASTER', { analysis: { scenario_tags: [] } }, 'confident', '', '', 'auto');
    expect(user.content).toMatch(/standard, ATS-recognised names in the document's own language/);
    expect(user.content).not.toContain('Pracovní zkušenosti');
  });

  it('covers every slot in every registered language', () => {
    const slots = Object.keys(SECTION_NAMES.en);
    for (const [lang, names] of Object.entries(SECTION_NAMES)) {
      expect(Object.keys(names).sort(), `${lang} is missing a slot`).toEqual(slots.sort());
      for (const slot of slots) {
        expect(names[slot].length, `${lang}.${slot} is empty`).toBeGreaterThan(0);
      }
    }
  });

  it('recognises a slot by any language variant', () => {
    expect(isSlot('experience', 'Doświadczenie zawodowe')).toBe(true);
    expect(isSlot('experience', 'Pracovní zkušenosti')).toBe(true);
    expect(isSlot('earlierCareer', 'Wcześniejsza kariera')).toBe(true);
    expect(isSlot('experience', 'Where I Made Waves')).toBe(false);
  });

  it('bands bullets per language, with a default for the unregistered', () => {
    expect(bulletBand('en')).toEqual([15, 25]);
    expect(bulletBand('cs')).toEqual([12, 22]);
    expect(bulletBand('auto')).toEqual([15, 25]);
    expect(bulletBand('hu')).toEqual([15, 25]);
  });
});
