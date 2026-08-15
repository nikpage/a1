// __tests__/cover-evidence.test.js
//
// The letter's own EVIDENCE (CV_RULES.md, Layer 3: "The letter is composed, not
// executed") and the rules that read off it. Two defects are pinned here. The
// first: a real run produced generation_framework with cv_blueprint +
// target_cover_words and NOTHING for the letter, so the cover letter executed a
// plan written for the CV and addressed "Dear Hiring Manager" over a named
// contact. The second, which the evidence block replaced the blueprint to fix:
// the analysis chose the hook, the three pairs in order, the objection and the
// close — the whole letter — before the candidate had typed a word of steering,
// leaving the writer to arrange prose around a skeleton it had not chosen.
//
// Everything here calls the real modules: the real prompt builders, the real
// renderer, the real validator. No Gemini call is needed — these are pure
// functions over an analysis object.

import { describe, test, expect } from 'vitest';
import { coverEvidenceBlock, salutationName } from '../prompts/cover-evidence.js';
import { buildCoverPrompt } from '../prompts/cover-letter.js';
import { buildAnalysisPrompt } from '../prompts/analysis.js';
import { coverRedFlagRule } from '../prompts/cv-rules.js';
import { validateCoverLetter, coverBody, coverShapeFaults, coverBreadthFault } from '../utils/cv-validate.js';

const MASTER = JSON.stringify({
  identity: { name: 'Nik Page' },
  experience: [
    { title: 'Head of Product', company: 'wflow.com', dates: '01/2022 - 06/2024', achievements: ['Consolidated 3 platforms into one'] },
  ],
});

function analysisWith(coverEvidence, extra = {}) {
  return {
    job_extraction: { position_title: 'Head of Product', company: 'PLG Group', hr_contact: 'Deborah from People Team', must_have_requirements: ['lead a team of PMs'] },
    job_data: { Country: 'Czechia' },
    generation_framework: { cv_blueprint: {}, cover_evidence: coverEvidence, target_cover_words: 250 },
    ...extra,
  };
}

const EVIDENCE = {
  requirement_evidence: [
    { requirement: 'lead a team of product managers', evidence: 'coached four PMs at wflow.com' },
    { requirement: 'multi-market platform consolidation', evidence: 'consolidated three platforms at wflow.com' },
    { requirement: 'product operations', evidence: 'built the product operations function at Salsita' },
  ],
  concerns: [{ flag: 'consultancy vs permanence', answer_evidence: 'four years embedded full time at wflow.com' }],
};

describe('coverEvidenceBlock', () => {
  test('renders the material: each requirement with the evidence that answers it, and the answerable concerns', () => {
    const block = coverEvidenceBlock(analysisWith(EVIDENCE));
    expect(block).toContain('"lead a team of product managers" ← coached four PMs at wflow.com');
    expect(block).toContain('consultancy vs permanence');
    expect(block).toContain('four years embedded full time at wflow.com');
  });

  // The whole point of the change: this block is material, and the letter's
  // shape is the writer's to decide with the steering and tone in hand. A block
  // that told the writer what to open on and what to ask for at the close would
  // be the blueprint again under a new name.
  test('it decides nothing about the letter — no hook, no order, no close, and the writer is told so', () => {
    const block = coverEvidenceBlock(analysisWith(EVIDENCE));
    expect(block).toMatch(/Material, not a plan/);
    expect(block).toMatch(/Use what serves your argument/);
    expect(block).toMatch(/unranked and its order means nothing/);
    expect(block).not.toMatch(/Execute this/);
    expect(block).not.toMatch(/Open on:/);
    expect(block).not.toMatch(/Close by asking for/);
  });

  // The one-concern rule is stated ONCE now, in coverRedFlagRule() — the block
  // used to restate it and the prompt carried both. Deduplicating a rule is only
  // safe if the surviving copy is pinned, so it is pinned here: the rule must be
  // gone from the evidence block AND present in the rule that owns it.
  test('the writer is told it may use fewer, and the one-concern rule lives in coverRedFlagRule', () => {
    const block = coverEvidenceBlock(analysisWith(EVIDENCE));
    expect(block).toMatch(/left unanswered/);
    expect(block).not.toMatch(/At most ONE concern may be addressed/);

    const rule = coverRedFlagRule();
    expect(rule).toMatch(/At most ONE concern is defused/);
    expect(rule).toMatch(/contract clause C2 binds for every applicant/);
    expect(rule).toMatch(/Where nothing in the record answers any of them, address none/);
  });

  test('the candidate’s steering is stated as outranking the evidence', () => {
    const block = coverEvidenceBlock(analysisWith(EVIDENCE));
    expect(block).toMatch(/candidate's own instructions outrank every line of this/);
  });

  test('a requirement missing either half is not rendered', () => {
    const block = coverEvidenceBlock(analysisWith({
      ...EVIDENCE,
      requirement_evidence: [{ requirement: 'lead a team of PMs', evidence: '' }, EVIDENCE.requirement_evidence[1]],
    }));
    expect(block).not.toContain('lead a team of PMs');
    expect(block).toContain('multi-market platform consolidation');
  });

  test('a concern with no answering evidence is not passed to the writer', () => {
    const block = coverEvidenceBlock(analysisWith({
      ...EVIDENCE,
      concerns: [{ flag: 'employment gap 2019', answer_evidence: '' }],
    }));
    expect(block).not.toContain('employment gap 2019');
  });

  test('no evidence (older analysis) renders nothing rather than an empty scaffold', () => {
    expect(coverEvidenceBlock(analysisWith(undefined))).toBe('');
    expect(coverEvidenceBlock(analysisWith({}))).toBe('');
    expect(coverEvidenceBlock(null)).toBe('');
  });
});

describe('salutationName', () => {
  // The salutation is a fact off the job data, never a plan's pick: the ad
  // printed a contact or it did not.
  test('reads the ad’s own contact, cut to the name half', () => {
    expect(salutationName(analysisWith(EVIDENCE))).toBe('Deborah');
    expect(salutationName(analysisWith(undefined))).toBe('Deborah');
    expect(salutationName({ job_extraction: { hr_contact: 'Jan Novák, HR' } })).toBe('Jan Novák');
    expect(salutationName({ job_extraction: { hr_contact: 'Anna Kowalska at PLG Group' } })).toBe('Anna Kowalska');
  });

  test('no contact means no name — never a guess', () => {
    expect(salutationName({ job_extraction: {} })).toBe('');
    expect(salutationName({})).toBe('');
  });
});

describe('buildCoverPrompt carries the letter-side rules', () => {
  const promptText = (analysis) => buildCoverPrompt(MASTER, analysis, 'professional').map((m) => m.content).join('\n');

  test('the named contact reaches the salutation rule', () => {
    const text = promptText(analysisWith(EVIDENCE));
    expect(text).toContain('Dear Deborah');
  });

  // The gathered evidence no longer reaches the writer at all: the letter reads
  // the RECORD and the AD directly (2026-08-15). Pre-chewed evidence lines were
  // CV-speak with the story removed, and letters assembled from them read flat.
  test('the pre-gathered evidence lines do NOT reach the writer', () => {
    const text = promptText(analysisWith(EVIDENCE));
    expect(text).not.toContain('coached four PMs at wflow.com');
    expect(text).not.toContain('Evidence gathered for THIS letter');
  });

  // The letter must never be handed a plan — its own or the CV's.
  test('the writer is told the shape follows the ad, and is its own call', () => {
    const text = promptText(analysisWith(EVIDENCE));
    expect(text).toMatch(/Let the ad set the shape/);
    expect(text).toMatch(/Flowing paragraphs are a default, not a requirement/);
  });

  test('with no contact the letter is told to use the neutral form and never guess', () => {
    const text = promptText({ job_extraction: { position_title: 'Head of Product' } });
    expect(text).toContain('Dear Hiring Team');
    expect(text).toMatch(/NEVER guess, infer or invent a name/);
  });

  // The red-flag rule is gone from the prompt (2026-08-15). Deciding whether a
  // concern is worth raising is judgement the writer makes with the ad in front
  // of it, and the letters that measured best raised the objection naturally
  // ("I am not a machine learning researcher who invents fundamental algorithms
  // from scratch") without being told to.
  test('no concern-handling rule is stated to the writer', () => {
    const text = promptText(analysisWith(EVIDENCE));
    expect(text).not.toMatch(/At most ONE concern is defused/);
    expect(text).not.toContain('consultancy vs permanence');
  });

  // The opener BANS are gone, with one exception that survives as a banned
  // PHRASE rather than a rule: "I am writing to apply" is on the banned-phrase
  // list, which is checked and repaired in code. The identity ban is retired
  // for the letter entirely (check 12 is a CV rule now).
  test('the boilerplate opener stays banned as a phrase; the identity opener does not', () => {
    const text = promptText(analysisWith(EVIDENCE));
    expect(text).toMatch(/i am writing to apply/i);
    expect(text).not.toMatch(/As a seasoned leader/);
    expect(text).not.toMatch(/the epithet ban binds the letter/);
  });

  // A real run opened "Vzpomínám si na jeden z prvních projektů…" — a remembered
  // scene the record does not hold. What is barred is the INVENTION, not the
  // narrative: a candidate whose own recorded voice builds to its point may
  // open that way, on facts (CV_RULES.md, Layer 3).
  // Invented scene-setting is covered by the one absolute the prompt keeps:
  // nothing is invented. A remembered year the record does not hold is an
  // invented fact, and it needs no rule of its own.
  test('invented colour is covered by the no-invention absolute', () => {
    const text = promptText(analysisWith(EVIDENCE));
    expect(text).toMatch(/never invent, never inflate/);
    expect(text).toMatch(/never claim a duration, a number, a skill or a role the record does not state/);
  });
});

describe('the analysis pass gathers the letter its evidence, not its plan', () => {
  const build = (jobText) => buildAnalysisPrompt('CV TEXT', jobText, Boolean(jobText && jobText.length > 20), null)
    .map((m) => m.content).join('\n');

  test('with a job ad it requests the answerable requirements and the answerable concerns', () => {
    const text = build('Head of Product at PLG Group, Prague. Lead a team of product managers.');
    expect(text).toContain('generation_framework.cover_evidence.requirement_evidence');
    expect(text).toContain('generation_framework.cover_evidence.concerns');
    expect(text).toContain('"cover_evidence"');
    expect(text).toMatch(/up to FIVE objects \{ requirement, evidence \}/);
    expect(text).toMatch(/This is a POOL, not a running order and not a plan/);
  });

  // The regression this file exists for: the analysis must not decide the
  // letter. No hook, no ordering, no chosen objection, no close.
  test('it asks for no hook, no order, no chosen objection and no close', () => {
    const text = build('Head of Product at PLG Group, Prague. Lead a team of product managers.');
    expect(text).not.toContain('hook_angle');
    expect(text).not.toContain('close_ask');
    expect(text).not.toContain('objection_to_defuse');
    expect(text).not.toContain('matched_pairs');
    expect(text).not.toContain('salutation_target');
    expect(text).toMatch(/do not rank it/);
    expect(text).toMatch(/you are not choosing for it/i);
  });

  test('with no job ad the requirement pool must be empty — there is nothing to answer', () => {
    const text = build('');
    expect(text).toContain('generation_framework.cover_evidence.requirement_evidence');
    expect(text).toMatch(/MUST be an empty array/);
  });
});

describe('validateCoverLetter — the letter’s slice of Layer 6', () => {
  const body = (words) => Array.from({ length: words }, (_, i) => `word${i % 7}`).join(' ');
  const letter = (bodyText, salutation = 'Dear Deborah,') =>
    `13.08.2026\n\n${salutation}\n\n${bodyText}\n\nSincerely,\n\n**Nik Page**\n+420 731 647`;

  test('coverBody strips the date, salutation and signature block', () => {
    const stripped = coverBody(letter('one two three'));
    expect(stripped).toBe('one two three');
  });

  test('over the market ceiling is a hard failure, under it is not', () => {
    const long = validateCoverLetter(letter(body(400)), { master: MASTER, analysis: analysisWith(EVIDENCE) });
    expect(long.ok).toBe(false);
    expect(long.hard.join(' ')).toMatch(/300/);

    // Under the ceiling, with nothing else to fail: the fixture's concern and
    // requirements are contract checks now, so they are removed here to leave
    // the word band as the only thing under test.
    const bare = analysisWith({ requirement_evidence: [], concerns: [] });
    const short = validateCoverLetter(letter(`I would bring this to PLG Group. ${body(150)}`), { master: MASTER, analysis: bare });
    expect(short.ok).toBe(true);
  });

  // Check 19 counts ANSWERING, not compliance with a plan: the evidence pool is
  // a pool, and a writer that argued two of three requirements made a judgement.
  // Only a letter that answers NONE of them is untailored to the ad.
  test('using fewer of the available requirements is a judgement, not a defect', () => {
    const text = letter('I coached the product managers at wflow.com and consolidated three platforms across two markets there.');
    const { hard, warnings } = validateCoverLetter(text, { master: MASTER, analysis: analysisWith(EVIDENCE) });
    expect(hard.join(' ')).not.toMatch(/answers none of/);
  });

  // CONTRACT C1 (check 27). This used to be a warning nobody acted on; it is now
  // a hard failure that regenerates the letter, because a letter answering none
  // of the requirements the record can answer has not done the one thing a cover
  // letter exists to do.
  test('a letter that answers none of the answerable requirements is a HARD failure', () => {
    // It names the employer, so the letter and the record demonstrably share a
    // language — the verdict means what it says.
    const text = letter('I enjoy building things at wflow.com and would bring energy and curiosity to your organisation every day.');
    const { ok, hard } = validateCoverLetter(text, { master: MASTER, analysis: analysisWith(EVIDENCE) });
    expect(ok).toBe(false);
    expect(hard.join(' ')).toMatch(/answers none of the 3 requirements/);
  });

  // THE REGRESSION. A real Czech ad answered by a real English letter reported
  // "answers none of the 5 requirements" while the letter answered two of them:
  // the check looked for the REQUIREMENT's words, and the requirement is quoted
  // in the ad's language while the letter is written in the candidate's.
  test('a Czech ad answered by an English letter is not reported as unanswered', () => {
    const czechAd = {
      requirement_evidence: [
        { requirement: 'facilitujeme pětidenní design sprinty', evidence: 'Certified Google Design Sprint Master who has facilitated design sprints' },
        { requirement: 'přepínání mezi více projekty naráz', evidence: 'coached four product managers at wflow.com across concurrent engagements' },
      ],
      concerns: [],
    };
    const text = letter('I am a Certified Google Design Sprint Master and have facilitated design sprints for years, having coached four product managers at wflow.com.');
    const { hard, warnings } = validateCoverLetter(text, { master: MASTER, analysis: analysisWith(czechAd) });
    expect(hard.join(' ')).not.toMatch(/answers none of/);
  });

  test('a letter sharing no language with the record gets no verdict at all', () => {
    // Nothing matches and nothing can be matched — silence beats a guess.
    const text = letter('Vážený pane, dodával jsem projekty pro poradenské skupiny a řídil dodávku softwarových produktů.');
    const { hard, warnings } = validateCoverLetter(text, { master: MASTER, analysis: analysisWith(EVIDENCE) });
    expect(hard.join(' ')).not.toMatch(/answers none of/);
  });

  test('every requirement answered raises nothing', () => {
    const text = letter('Coached product managers at wflow.com, ran a multi-market consolidation of three platforms, and built product operations at Salsita.');
    const { hard, warnings } = validateCoverLetter(text, { master: MASTER, analysis: analysisWith(EVIDENCE) });
    expect(hard.join(' ')).not.toMatch(/answers none of/);
  });

  // Steering used to suspend this check because a demoted pair looked like a
  // failure to deliver the plan. There is no plan now, and the check no longer
  // takes tweak at all — a letter answering something still passes.
  test('steering does not change the verdict — the check reads the letter, not a plan', () => {
    const text = letter('I coached the product managers at wflow.com and consolidated three platforms across two markets there.');
    const { hard, warnings } = validateCoverLetter(text, {
      master: MASTER,
      analysis: analysisWith(EVIDENCE),
      tweak: 'Play down, condense or place late: wflow.com',
    });
    expect(hard.join(' ')).not.toMatch(/answers none of/);
  });

  test('a named contact left as "Dear Hiring Manager" is reported', () => {
    const text = letter('Short body.', 'Dear Hiring Manager,');
    const { hard, warnings } = validateCoverLetter(text, { master: MASTER, analysis: analysisWith(EVIDENCE) });
    expect(warnings.find((w) => w.code === 'coverSalutation')?.params).toEqual({ name: 'Deborah' });
  });

  test('addressing the named contact raises nothing', () => {
    const { hard, warnings } = validateCoverLetter(letter('Short body.'), { master: MASTER, analysis: analysisWith(EVIDENCE) });
    expect(warnings.find((w) => w.code === 'coverSalutation')).toBeFalsy();
  });

  // A Czech salutation puts the name in the VOCATIVE, which is the correct form
  // and not a substring of the nominative the ad printed ("Petr" → "Petře").
  // Red on the old code, which matched with String.includes and warned that a
  // properly addressed letter had ignored its contact.
  test('a Czech vocative salutation counts as addressing the contact', () => {
    const withContact = (hr) => ({ ...analysisWith(EVIDENCE), job_extraction: { hr_contact: hr } });
    const cz = (line) => letter('Krátké tělo dopisu.', line);

    expect(validateCoverLetter(cz('Vážený pane Nováku,'), { master: MASTER, analysis: withContact('Petr Novák') })
      .warnings.find((w) => w.code === 'coverSalutation')).toBeFalsy();
    expect(validateCoverLetter(cz('Vážený pane Petře,'), { master: MASTER, analysis: withContact('Petr') })
      .warnings.find((w) => w.code === 'coverSalutation')).toBeFalsy();
    expect(validateCoverLetter(cz('Vážená paní Nováková,'), { master: MASTER, analysis: withContact('Jana Nováková') })
      .warnings.find((w) => w.code === 'coverSalutation')).toBeFalsy();

    // Still catches the real defect: a named contact addressed generically.
    expect(validateCoverLetter(cz('Vážená paní, vážený pane,'), { master: MASTER, analysis: withContact('Petr Novák') })
      .warnings.find((w) => w.code === 'coverSalutation')?.params).toEqual({ name: 'Petr Novák' });
    // And a different name entirely is not accepted as this contact.
    expect(validateCoverLetter(cz('Vážený pane Dvořáku,'), { master: MASTER, analysis: withContact('Petr Novák') })
      .warnings.find((w) => w.code === 'coverSalutation')?.params).toEqual({ name: 'Petr Novák' });
  });

  // CHECK 31 — REGRESSION. A real run produced a competent, entirely generic
  // letter for an EdTech company called KUBO that never said "KUBO" once. Every
  // other check passed it. Red on the old code, which had no such check.
  describe('check 31 — the letter names the employer', () => {
    const withCompany = (extraction, jobData) => ({
      ...analysisWith(EVIDENCE),
      job_extraction: { hr_contact: 'Deborah', ...extraction },
      ...(jobData ? { job_data: jobData } : {}),
    });

    test('a letter that never names the employer is a hard failure', () => {
      const { hard } = validateCoverLetter(letter('I consolidated three platforms across two markets.'), {
        master: MASTER,
        analysis: withCompany({ company: 'KUBO' }),
      });
      expect(hard.join(' ')).toMatch(/never names the employer/);
      expect(hard.join(' ')).toMatch(/KUBO/);
    });

    test('naming them clears it, and Czech inflection still counts', () => {
      expect(validateCoverLetter(letter('I consolidated three platforms for KUBO across two markets.'), {
        master: MASTER, analysis: withCompany({ company: 'KUBO' }),
      }).hard.join(' ')).not.toMatch(/never names the employer/);

      expect(validateCoverLetter(letter('Rád bych přinesl své zkušenosti do Seznamu a jeho doporučovacího systému.'), {
        master: MASTER, analysis: withCompany({ company: 'Seznam.cz a.s.' }),
      }).hard.join(' ')).not.toMatch(/never names the employer/);
    });

    test('the company is read off job_data when the extraction lost it', () => {
      const { hard } = validateCoverLetter(letter('I consolidated three platforms across two markets.'), {
        master: MASTER,
        analysis: withCompany({ company: '' }, { Company: 'KUBO' }),
      });
      expect(hard.join(' ')).toMatch(/never names the employer/);
    });

    test('no employer on the record demands no name', () => {
      const { hard } = validateCoverLetter(letter('I consolidated three platforms across two markets.'), {
        master: MASTER,
        analysis: withCompany({ company: '' }),
      });
      expect(hard.join(' ')).not.toMatch(/never names the employer/);
    });
  });

  test('numbers the record does not hold are reported', () => {
    const { hard, warnings } = validateCoverLetter(letter('I cut costs by 47 percent across 3 platforms.'), {
      master: MASTER,
      analysis: analysisWith(EVIDENCE),
    });
    expect(warnings.find((w) => w.code === 'coverNumber')?.params.list).toBe('47');
  });

  test('answering more than one concern is reported; answering one is not', () => {
    const analysis = analysisWith(EVIDENCE, {
      analysis: { red_flags: ['consultancy engagements read as fractional gig-working', 'fourteen-month employment gap in 2019'] },
    });
    const two = validateCoverLetter(
      letter('My consultancy engagements were never fractional gig-working. The employment gap in 2019 was fourteen months of full-time study.'),
      { master: MASTER, analysis },
    );
    expect(two.warnings.find((w) => w.code === 'coverManyObjections')?.params).toEqual({ count: 2 });

    const one = validateCoverLetter(
      letter('My consultancy engagements were never fractional gig-working. I led the consolidation at wflow.com.'),
      { master: MASTER, analysis },
    );
    expect(one.warnings.find((w) => w.code === 'coverManyObjections')).toBeFalsy();
  });

  test('a check whose evidence is missing reports nothing rather than guessing', () => {
    const { ok, hard, warnings } = validateCoverLetter(letter('Short body.'), { master: '', analysis: null });
    expect(ok).toBe(true);
    expect(hard.join(' ')).not.toMatch(/answers none of/);
    expect(warnings.find((w) => w.code === 'coverNumber')).toBeFalsy();
  });
});

// ── Layer 6 checks 24 and 25: the letter's measured shape and breadth ────────
//
// Both are the app's own writing failing, so both are repaired before delivery
// and neither is ever reported to the candidate. Code measures flatness and
// breadth; it does not judge whether the letter is good, and CV_RULES.md does
// not claim it does.
describe('the letter’s measured shape (check 24)', () => {
  const wrap = (body) => `14.08.2026\n\nDear Deborah,\n\n${body}\n\nSincerely,\n\n**Nik Page**`;

  // The real defect: a letter whose every sentence lands at the same weight.
  const FLAT = wrap([
    'I founded the user experience function at a large retail bank in Prague and ran it for four years.',
    'My work as a principal consultant has involved high impact engagements across several industries and sizes.',
    'I grew monthly billing on the eBay account from under twenty thousand dollars to over one hundred thousand.',
    'My approach centres on data driven decisions rather than intuition, which is why those numbers moved at all.',
  ].join(' '));

  const VARIED = wrap([
    'I founded the user experience function at a large retail bank in Prague and ran it for four years.',
    'That taught me one thing.',
    'Discovery is cheap and rework is not, which is the argument I have made to every client since.',
    'Billing on the eBay account went from under twenty thousand dollars to over one hundred thousand.',
    'No magic. Data, and the discipline to act on it.',
  ].join(' '));

  test('a flat letter is named in numbers the writer can act on', () => {
    const faults = coverShapeFaults(FLAT).join(' ');
    expect(faults).toMatch(/shortest sentence in the letter is \d+ words/);
    expect(faults).toMatch(/Sentence lengths barely vary/);
  });

  test('a letter with real rhythm reports nothing', () => {
    expect(coverShapeFaults(VARIED)).toEqual([]);
  });

  test('a slab paragraph is a fault on its own', () => {
    const slab = wrap(`Short one. ${'I rebuilt the product management process at the platform company and it worked. '.repeat(8)}`);
    expect(coverShapeFaults(slab).join(' ')).toMatch(/longest paragraph runs to \d+ words/);
  });

  test('too little text to have a shape is not judged', () => {
    expect(coverShapeFaults(wrap('Two sentences. That is all.'))).toEqual([]);
    expect(coverShapeFaults('')).toEqual([]);
  });
});

describe('the letter’s breadth (check 25)', () => {
  // The master this check exists for: a standing consultancy carrying its
  // engagements as NESTED contracts. Reading only the top level saw one
  // employer where the letter had named five, so the check never fired.
  const MASTER_NESTED = JSON.stringify({
    experience: [
      {
        title: 'Principal Consultant',
        company: 'Nik Page Ltd.',
        contracts: [
          { company: 'Salsita Software' },
          { company: 'wflow.com' },
          { company: 'SpecialAgents.pro' },
        ],
      },
      { title: 'Head of UX', company: 'Česká spořitelna' },
      { title: 'Product Manager', company: 'Monster Worldwide' },
    ],
  });
  const wrap = (body) => `14.08.2026\n\nDear Deborah,\n\n${body}\n\nSincerely,\n\n**Nik Page**`;

  test('a letter that walks the career is caught, nested engagements included', () => {
    const fault = coverBreadthFault(
      wrap('At Salsita Software I grew the eBay account. At wflow.com I rebuilt product management. At SpecialAgents.pro I build RAG systems. At Česká spořitelna I founded the UX function. At Monster Worldwide I led user studies.'),
      MASTER_NESTED,
    );
    expect(fault).toMatch(/names 5 of this candidate's employers/);
    expect(fault).toContain('Salsita Software');
    // Nested children are the ones that used to be invisible.
    expect(fault).toContain('SpecialAgents.pro');
    expect(fault).toMatch(/Keep the TWO strongest/);
  });

  test('two employers argued properly is the target, not a defect', () => {
    expect(coverBreadthFault(
      wrap('At Salsita Software I grew the eBay account from under $20k to over $100k. At wflow.com I rebuilt product management and established market intelligence.'),
      MASTER_NESTED,
    )).toBeNull();
  });

  test('a record with three employers or fewer has nothing to measure', () => {
    const thin = JSON.stringify({ experience: [{ company: 'Salsita Software' }, { company: 'wflow.com' }] });
    expect(coverBreadthFault(wrap('Salsita Software. wflow.com.'), thin)).toBeNull();
  });

  test('no parseable record means no verdict rather than a guess', () => {
    expect(coverBreadthFault(wrap('Anything at all.'), '')).toBeNull();
  });
});
