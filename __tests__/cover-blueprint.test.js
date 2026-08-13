// __tests__/cover-blueprint.test.js
//
// The letter's own blueprint (CV_RULES.md, Layer 3) and the rules that read off
// it. The defect these pin: a real run produced generation_framework with
// cv_blueprint + target_cover_words and NOTHING for the letter, and
// action_items with only cv_changes — so the cover letter executed a plan
// written for the CV, addressed "Dear Hiring Manager" over a named contact, and
// argued from whatever it could find.
//
// Everything here calls the real modules: the real prompt builders, the real
// renderer, the real validator. No Gemini call is needed — these are pure
// functions over an analysis object.

import { describe, test, expect } from 'vitest';
import { coverBlueprintBlock, salutationName } from '../prompts/cover-blueprint.js';
import { buildCoverPrompt } from '../prompts/cover-letter.js';
import { buildAnalysisPrompt } from '../prompts/analysis.js';
import { validateCoverLetter, coverBody } from '../utils/cv-validate.js';

const MASTER = JSON.stringify({
  identity: { name: 'Nik Page' },
  experience: [
    { title: 'Head of Product', company: 'wflow.com', dates: '01/2022 - 06/2024', achievements: ['Consolidated 3 platforms into one'] },
  ],
});

function analysisWith(coverBlueprint, extra = {}) {
  return {
    job_extraction: { position_title: 'Head of Product', company: 'PLG Group', hr_contact: 'Deborah from People Team', must_have_requirements: ['lead a team of PMs'] },
    job_data: { Country: 'Czechia' },
    generation_framework: { cv_blueprint: {}, cover_blueprint: coverBlueprint, target_cover_words: 250 },
    ...extra,
  };
}

const BLUEPRINT = {
  salutation_target: 'Deborah',
  hook_angle: 'ran the platform consolidation at wflow.com',
  matched_pairs: [
    { requirement: 'lead a team of product managers', evidence: 'coached four PMs at wflow.com' },
    { requirement: 'multi-market platform consolidation', evidence: 'consolidated three platforms at wflow.com' },
    { requirement: 'product operations', evidence: 'built the product operations function at Salsita' },
  ],
  objection_to_defuse: { flag: 'consultancy vs permanence', answer_evidence: 'four years embedded full time at wflow.com' },
  close_ask: 'an interview',
};

describe('coverBlueprintBlock', () => {
  test('renders the plan the letter executes: angle, pairs, objection, close', () => {
    const block = coverBlueprintBlock(analysisWith(BLUEPRINT));
    expect(block).toContain('ran the platform consolidation at wflow.com');
    expect(block).toContain('"lead a team of product managers" ← coached four PMs at wflow.com');
    expect(block).toContain('consultancy vs permanence');
    expect(block).toContain('four years embedded full time at wflow.com');
    expect(block).toContain('an interview');
  });

  test('a pair missing either half is not rendered as a pair', () => {
    const block = coverBlueprintBlock(analysisWith({
      ...BLUEPRINT,
      matched_pairs: [{ requirement: 'lead a team of PMs', evidence: '' }, BLUEPRINT.matched_pairs[1]],
    }));
    expect(block).not.toContain('lead a team of PMs');
    expect(block).toContain('multi-market platform consolidation');
  });

  test('an objection with no answering evidence is not passed to the writer', () => {
    const block = coverBlueprintBlock(analysisWith({
      ...BLUEPRINT,
      objection_to_defuse: { flag: 'employment gap 2019', answer_evidence: '' },
    }));
    expect(block).not.toContain('employment gap 2019');
  });

  test('no blueprint (older analysis) renders nothing rather than an empty scaffold', () => {
    expect(coverBlueprintBlock(analysisWith(undefined))).toBe('');
    expect(coverBlueprintBlock(analysisWith({}))).toBe('');
    expect(coverBlueprintBlock(null)).toBe('');
  });
});

describe('salutationName', () => {
  test('the blueprint pick wins', () => {
    expect(salutationName(analysisWith(BLUEPRINT))).toBe('Deborah');
  });

  test('falls back to the raw contact, cut to the name half', () => {
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
    const text = promptText(analysisWith(BLUEPRINT));
    expect(text).toContain('"Dear Deborah"');
    expect(text).toContain('ran the platform consolidation at wflow.com');
  });

  test('with no contact the letter is told to use the neutral form and never guess', () => {
    const text = promptText({ job_extraction: { position_title: 'Head of Product' } });
    expect(text).toContain('Dear Hiring Manager');
    expect(text).toMatch(/NEVER guess, infer or invent a name/);
  });

  test('the red-flag rule binds the writer to the analysis pick, not to red_flags', () => {
    const text = promptText(analysisWith(BLUEPRINT));
    expect(text).toContain('objection_to_defuse');
    expect(text).toMatch(/never address a second/i);
    expect(text).toMatch(/NOT a list to answer/i);
  });

  test('the opener rule bans the application-act and identity openings', () => {
    const text = promptText(analysisWith(BLUEPRINT));
    expect(text).toContain('I am writing to apply');
    expect(text).toMatch(/As a seasoned leader/);
  });
});

describe('the analysis pass asks for the letter its own plan', () => {
  const build = (jobText) => buildAnalysisPrompt('CV TEXT', jobText, Boolean(jobText && jobText.length > 20), null)
    .map((m) => m.content).join('\n');

  test('with a job ad it requests three matched pairs and the objection slot', () => {
    const text = build('Head of Product at PLG Group, Prague. Lead a team of product managers.');
    expect(text).toContain('generation_framework.cover_blueprint.matched_pairs');
    expect(text).toContain('"cover_blueprint"');
    expect(text).toContain('"objection_to_defuse": null');
    expect(text).toMatch(/exactly THREE objects \{ requirement, evidence \}/);
  });

  test('with no job ad the pairs must be empty — there is nothing to pair against', () => {
    const text = build('');
    expect(text).toContain('generation_framework.cover_blueprint.matched_pairs');
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
    const long = validateCoverLetter(letter(body(400)), { master: MASTER, analysis: analysisWith(BLUEPRINT) });
    expect(long.ok).toBe(false);
    expect(long.hard.join(' ')).toMatch(/300/);

    const short = validateCoverLetter(letter(body(150)), { master: MASTER, analysis: analysisWith(BLUEPRINT) });
    expect(short.ok).toBe(true);
  });

  test('a planned pair that never reached the page is reported', () => {
    const text = letter('I coached the product managers at wflow.com and consolidated three platforms across two markets there.');
    const { warnings } = validateCoverLetter(text, { master: MASTER, analysis: analysisWith(BLUEPRINT) });
    const pairWarning = warnings.find((w) => w.code === 'coverPairsMissing');
    expect(pairWarning).toBeTruthy();
    expect(pairWarning.params).toEqual({ present: 2, planned: 3 });
  });

  test('all three pairs present raises no pair warning', () => {
    const text = letter('Coached product managers at wflow.com, ran a multi-market consolidation of three platforms, and built product operations at Salsita.');
    const { warnings } = validateCoverLetter(text, { master: MASTER, analysis: analysisWith(BLUEPRINT) });
    expect(warnings.find((w) => w.code === 'coverPairsMissing')).toBeFalsy();
  });

  test('a named contact left as "Dear Hiring Manager" is reported', () => {
    const text = letter('Short body.', 'Dear Hiring Manager,');
    const { warnings } = validateCoverLetter(text, { master: MASTER, analysis: analysisWith(BLUEPRINT) });
    expect(warnings.find((w) => w.code === 'coverSalutation')?.params).toEqual({ name: 'Deborah' });
  });

  test('addressing the named contact raises nothing', () => {
    const { warnings } = validateCoverLetter(letter('Short body.'), { master: MASTER, analysis: analysisWith(BLUEPRINT) });
    expect(warnings.find((w) => w.code === 'coverSalutation')).toBeFalsy();
  });

  test('numbers the record does not hold are reported', () => {
    const { warnings } = validateCoverLetter(letter('I cut costs by 47 percent across 3 platforms.'), {
      master: MASTER,
      analysis: analysisWith(BLUEPRINT),
    });
    expect(warnings.find((w) => w.code === 'coverNumber')?.params.list).toBe('47');
  });

  test('answering more than one concern is reported; answering one is not', () => {
    const analysis = analysisWith(BLUEPRINT, {
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
    const { ok, warnings } = validateCoverLetter(letter('Short body.'), { master: '', analysis: null });
    expect(ok).toBe(true);
    expect(warnings.find((w) => w.code === 'coverPairsMissing')).toBeFalsy();
    expect(warnings.find((w) => w.code === 'coverNumber')).toBeFalsy();
  });
});
