// The letter is PLANNED before it is written, and the plan is judged COLD.
//
// Two stages, one defect each:
//   - buildLetterPlanPrompt / letterPlanBlock: a model handed an argument and
//     asked for a letter produces the shape of a letter rather than the
//     argument. The plan fixes order, one instance per point, and what the first
//     and last sentence must do, BEFORE any prose exists.
//   - buildProsePassPrompt: every other check in this repo reads the letter
//     against the ad, the record or a phrase list, so all of them grade the
//     MATCH. This one must see the letter and nothing else, or it grades the
//     match too and the whole point is lost.

import { describe, it, expect } from 'vitest';
import { buildLetterPlanPrompt, letterPlanBlock } from '../prompts/letter-plan.js';
import { buildProsePassPrompt } from '../prompts/prose-pass.js';
import { buildCoverPrompt } from '../prompts/cover-letter.js';

const ANALYSIS = {
  analysis: { red_flags: ['14-month gap 2021-2022', 'no crypto experience'] },
  job_data: { Country: 'Czech Republic' },
  job_text: 'We need someone who has actually shipped B2B SaaS to Czech SMEs. Nebojíme se experimentů.',
  job_extraction: {
    position_title: 'Product Lead',
    company: 'PLG Group',
    must_have_requirements: ['shipped B2B SaaS', 'works with engineers', 'Czech and English'],
  },
  generation_framework: {
    cover_evidence: {
      requirement_evidence: [
        { requirement: 'shipped B2B SaaS', evidence: 'led product at wflow.com, took invoicing live for 400 Czech SMEs' },
        { requirement: 'works with engineers', evidence: 'coached four PMs at wflow.com' },
      ],
      concerns: [{ flag: '14-month gap 2021-2022', answer_evidence: 'ran an independent practice through 2021' }],
    },
  },
};

const PLAN = {
  opening_claim: 'commit to having taken a Czech B2B invoicing product live',
  order_reason: 'they are most uneasy about someone who has never shipped to Czech SMEs',
  points: [
    { answers: 'shipped B2B SaaS', instance: 'wflow.com invoicing launch', detail: 'refused the enterprise tier to keep onboarding under a day' },
    { answers: 'works with engineers', instance: 'coaching four PMs at wflow.com', detail: 'handed the roadmap to the team that built it' },
  ],
  argue_against: 'vendors who lecture SMEs about why they should want the tech',
  shared_lesson: 'complex tooling fails unless the first run takes under a day',
  shortfall: { state: true, what: 'no crypto experience', placement: 'inside the sentence about the invoicing launch' },
  close: 'name what they would do first in this role',
};

describe('buildLetterPlanPrompt — the planner decides shape, never prose', () => {
  const user = () => buildLetterPlanPrompt({ analysis: ANALYSIS }).find((m) => m.role === 'user').content;

  it('demands exactly two points and says three means it did not decide', () => {
    const p = user();
    expect(p).toMatch(/TWO points/);
    expect(p).toMatch(/If you name three you have not decided/);
  });

  it('hands the evidence over UNRANKED and says the order means nothing', () => {
    const p = user();
    expect(p).toContain('led product at wflow.com, took invoicing live for 400 Czech SMEs');
    expect(p).toContain('coached four PMs at wflow.com');
    expect(p).toMatch(/UNRANKED/);
    expect(p).toMatch(/arrival order and means nothing/);
  });

  it('separates the concern the record answers from the one it cannot', () => {
    const p = user();
    // Answerable: paired with the fact that settles it.
    expect(p).toContain('ran an independent practice through 2021');
    // Unanswerable: listed under its own heading, with the silence rule.
    const cannot = p.slice(p.indexOf('CANNOT answer'));
    expect(cannot).toContain('no crypto experience');
    expect(cannot).not.toContain('14-month gap 2021-2022');
    expect(cannot).toMatch(/covered by SILENCE/);
  });

  it('reads the ad in the employer\'s own words, not the extraction', () => {
    expect(user()).toContain('Nebojíme se experimentů');
  });

  it('asks for the first and last sentence\'s JOB, never the sentence', () => {
    const p = user();
    expect(p).toMatch(/State the job that sentence has to do — never write the sentence/);
    expect(p).toMatch(/It does not thank, does not hope, and does not ask for consideration/);
  });

  it('forbids planning an instance whose persuading detail is not in the record', () => {
    expect(user()).toMatch(/pick different evidence — do not plan to invent one/);
  });
});

describe('letterPlanBlock — what the writer executes', () => {
  it('renders the two points in the planned order with their instances', () => {
    const block = letterPlanBlock(PLAN);
    expect(block.indexOf('wflow.com invoicing launch')).toBeLessThan(block.indexOf('coaching four PMs at wflow.com'));
    expect(block).toContain('refused the enterprise tier to keep onboarding under a day');
    expect(block).toMatch(/THE TWO POINTS, IN THIS ORDER/);
  });

  it('states a planned shortfall once, and states SILENCE when none is planned', () => {
    expect(letterPlanBlock(PLAN)).toMatch(/STATE THE SHORTFALL ONCE: no crypto experience/);
    const silent = letterPlanBlock({ ...PLAN, shortfall: { state: false } });
    expect(silent).toMatch(/STATE NO SHORTFALL/);
    expect(silent).not.toMatch(/STATE THE SHORTFALL ONCE/);
  });

  it('never carries more than two points even if the plan came back with three', () => {
    const greedy = { ...PLAN, points: [...PLAN.points, { answers: 'third', instance: 'third instance', detail: 'x' }] };
    expect(letterPlanBlock(greedy)).not.toContain('third instance');
  });

  // A failed plan call must cost the letter nothing.
  it('renders nothing at all for a missing or empty plan', () => {
    expect(letterPlanBlock(null)).toBe('');
    expect(letterPlanBlock({})).toBe('');
    expect(letterPlanBlock({ points: [] })).toBe('');
  });
});

describe('the plan reaches the writer and overrides its own choosing', () => {
  const cover = (plan) =>
    buildCoverPrompt('MASTER RECORD', ANALYSIS, 'Formal', '', '', 'auto', new Date(), null, plan)
      .find((m) => m.role === 'user').content;

  it('puts the plan in front of the writer as a decision already made', () => {
    const p = cover(PLAN);
    expect(p).toMatch(/THE PLAN FOR THIS LETTER — execute it/);
    expect(p).toContain('refused the enterprise tier to keep onboarding under a day');
  });

  it('stops the ad\'s ask list being a second menu once a plan exists', () => {
    expect(cover(PLAN)).toMatch(/That list is CONTEXT, not a menu/);
    expect(cover(PLAN)).not.toMatch(/pick the TWO OR THREE this employer plainly cares about most/);
  });

  it('leaves the writer choosing for itself when there is no plan', () => {
    const p = cover(null);
    expect(p).not.toMatch(/THE PLAN FOR THIS LETTER/);
    expect(p).toMatch(/pick the TWO OR THREE this employer plainly cares about most/);
  });
});

describe('buildProsePassPrompt — the cold read sees the letter and NOTHING else', () => {
  const LETTER = 'Dear Deborah,\n\nI took wflow.com invoicing live for 400 Czech SMEs.\n\nSincerely,\nNik';
  const text = () => JSON.stringify(buildProsePassPrompt({ letter: LETTER }));

  it('carries the letter', () => {
    expect(text()).toContain('I took wflow.com invoicing live for 400 Czech SMEs');
  });

  // THE POINT OF THE STAGE. If any of this leaks in, the pass grades relevance
  // like every other check and stops answering "did a person write this".
  it('carries no ad, no record, no plan and no analysis', () => {
    const t = text();
    expect(t).not.toContain('Nebojíme se experimentů');
    expect(t).not.toContain('MASTER RECORD');
    expect(t).not.toContain('PLG Group');
    expect(t).not.toContain('refused the enterprise tier');
    expect(t).toMatch(/You do not know the job and you do not know the person/);
  });

  it('asks for the remembered thing and permits the answer to be nothing', () => {
    expect(text()).toMatch(/remember tomorrow/);
    expect(text()).toMatch(/do not invent something to be kind/);
  });

  it('reports only — it never rewrites', () => {
    const t = text();
    expect(t).toMatch(/Do not rewrite anything/);
    expect(t).toMatch(/Do not suggest replacement wording/);
  });
});

// 2026-08-23. Nik's own hand-written Invity letter
// (scripts/fixtures/golden/target-invity-cover.md) beat the pipeline's on the
// same ad, and it contains NO NUMBER at all. The plan prompt had listed a number
// alongside decisions and refusals, and the planner reached for one every time.
describe('the plan aims at what Nik\'s own letter does', () => {
  const user = () => buildLetterPlanPrompt({ analysis: ANALYSIS }).find((m) => m.role === 'user').content;

  it('makes a number one option among five, never the target', () => {
    const p = user();
    expect(p).toMatch(/A NUMBER IS ONE OPTION AMONG FIVE, NEVER THE TARGET/);
    expect(p).toMatch(/a POSITION this person holds and has pushed somewhere real/);
    expect(p).toMatch(/This is the strongest kind and the one most often missed/);
  });

  it('asks the opening for a judgement about the EMPLOYER, not a claim about the candidate', () => {
    const p = user();
    expect(p).toMatch(/carries a JUDGEMENT ABOUT THIS EMPLOYER/);
    expect(p).toMatch(/Not a claim about the candidate's capabilities/);
    expect(p).toMatch(/never a thesis about the industry/);
    // The old instruction produced the capability thesis. It must be gone.
    expect(p).not.toMatch(/It commits to a claim about this person against this job/);
  });

  it('asks the letter to argue against something, and for the lesson the two instances share', () => {
    const p = user();
    expect(p).toMatch(/ARGUE AGAINST SOMETHING/);
    expect(p).toMatch(/An advert states its fear in the negative/);
    expect(p).toMatch(/say what the two instances have in COMMON/);
    expect(p).toContain('"argue_against"');
    expect(p).toContain('"shared_lesson"');
  });

  it('carries both new decisions to the writer, and neither when the plan omits them', () => {
    const full = letterPlanBlock(PLAN);
    expect(full).toMatch(/ARGUE AGAINST THIS: vendors who lecture SMEs/);
    expect(full).toMatch(/WHAT THE TWO INSTANCES SHARE: complex tooling fails/);

    const bare = letterPlanBlock({ ...PLAN, argue_against: '', shared_lesson: '' });
    expect(bare).not.toMatch(/ARGUE AGAINST THIS/);
    expect(bare).not.toMatch(/WHAT THE TWO INSTANCES SHARE/);
  });

  it('tells the writer a number is not required', () => {
    expect(letterPlanBlock(PLAN)).toMatch(/A NUMBER IS NOT REQUIRED AND IS NOT THE TARGET/);
  });
});

// Run 2 (2026-08-23, Invity) opened "…is precisely why I am reaching out
// regarding the Product Manager role" — announcing the application and naming
// the title back, both of which the plan block already forbade. The
// instructions were obeyed; the planner's own opening claim was forty words of
// consultant abstraction and the writer executed it. The fix is a shape
// constraint on what the planner may write, not another rule for the writer.
describe('the planner is constrained in its OWN prose', () => {
  const user = () => buildLetterPlanPrompt({ analysis: ANALYSIS }).find((m) => m.role === 'user').content;

  it('caps the opening claim and bans the words that made it a thesis', () => {
    const p = user();
    expect(p).toMatch(/FIFTEEN WORDS MAXIMUM/);
    expect(p).toMatch(/strategic/);
    expect(p).toMatch(/If it reads like a consulting deck, it is wrong/);
  });

  it('bans the announcement vocabulary from the opening claim itself', () => {
    const p = user();
    const block = p.slice(p.indexOf('HARD CONSTRAINTS ON WHAT YOU WRITE'));
    expect(block).toMatch(/must NOT contain the job title/);
    expect(block).toMatch(/"reaching out"/);
    expect(block).toMatch(/announces the application, which is the one thing it may never do/);
  });

  it('shows the shape it wants and the shape it rejects', () => {
    const p = user();
    expect(p).toMatch(/actually fixing X instead of talking about it/);
    expect(p).toMatch(/To validate their strategic decision to pursue X" is not/);
  });

});

// Run 3 fixed the opening and left the close as "…would welcome the opportunity
// to discuss how my experience can be applied to Invity's scaling roadmap",
// which the cold read flagged as portable. The constraint had been written for
// one FIELD instead of for the planner.
describe('the plain-speech constraint binds the whole plan, not one field', () => {
  const user = () => buildLetterPlanPrompt({ analysis: ANALYSIS }).find((m) => m.role === 'user').content;

  it('binds the close with the same constraints as the opening claim', () => {
    const p = user();
    const block = p.slice(p.indexOf('THE SAME HARD CONSTRAINTS BIND'));
    expect(block).toMatch(/fifteen words maximum/);
    expect(block).toMatch(/"opportunity"/);
    expect(block).toMatch(/"look forward"/);
    expect(block).toMatch(/the stock ending every applicant sends/);
  });

  it('shows the close it wants and the close it rejects', () => {
    const p = user();
    expect(p).toMatch(/Buy them a coffee and talk" is a real close/);
    expect(p).toMatch(/Discuss how my experience can be applied to their roadmap" is not/);
  });

  it('states once that the plan\'s register becomes the letter\'s register', () => {
    expect(user()).toMatch(/THE REGISTER OF YOUR PLAN BECOMES THE REGISTER OF THE LETTER/);
  });
});

// Run 4 (2026-08-23, Invity): the planner was right and the writer still wrote
// "Treating regulatory parameters as firm boundaries sharpens design decisions"
// (an aphorism, already banned in cover-letter.js) and "Both environments
// demonstrate how I work as a Product Manager" (the conclusion, plus the title
// handed back). Both are now answered where the writer reads last.
describe('the writer is told how to USE a position, not restate it', () => {
  const block = () => letterPlanBlock(PLAN);

  it('says a position is shown by what it made the candidate do', () => {
    const b = block();
    expect(b).toMatch(/NEVER STATED AS A MAXIM/);
    expect(b).toMatch(/is a slogan and a machine wrote it/);
    expect(b).toMatch(/still be true if a different person had written it/);
  });

  it('bans the sentence that sums up what the instances demonstrate', () => {
    const b = block();
    expect(b).toMatch(/DO NOT SUM UP/);
    expect(b).toMatch(/both of these show how I work as a/);
    expect(b).toMatch(/Restating the point on the reader's behalf/);
  });

  it('bans naming the job title back at the employer anywhere in the letter', () => {
    const b = block();
    expect(b).toMatch(/NEVER NAME THE ROLE BACK AT THEM/);
    expect(b).toMatch(/not in the opening, not as a description of the candidate, not in the close/);
  });

  // These rules ride with the plan, so a letter written without one is unchanged.
  it('does not leak into a letter written with no plan', () => {
    expect(letterPlanBlock(null)).toBe('');
  });
});

// Run 5 (2026-08-23, Invity): "We didn't hand business teams theoretical papers
// on heavy banking regulations." Nobody was ever going to. The instruction to
// argue against something, with no constraint on WHAT, manufactures an opponent
// whenever the record holds no real refusal — and a straw man reads as
// machine-written more loudly than the flat sentence it replaced.
describe('what the letter argues against must be real', () => {
  const user = () => buildLetterPlanPrompt({ analysis: ANALYSIS }).find((m) => m.role === 'user').content;

  it('requires the thing argued against to be pointed at in the ad or the record', () => {
    const p = user();
    expect(p).toMatch(/IT MUST BE SOMETHING PEOPLE ACTUALLY DO/);
    expect(p).toMatch(/this advert says it, or this record shows the candidate meeting it/);
  });

  it('prefers an empty argue_against to an invented one', () => {
    const p = user();
    expect(p).toMatch(/leave "argue_against" EMPTY/);
    expect(p).toMatch(/Empty is correct and costs the letter nothing/);
    // The previous wording pushed the opposite way and caused the straw man.
    expect(p).not.toMatch(/An empty "argue_against" is a plan that gave up/);
  });

  it('gives the recognition test, with the run that produced the straw man', () => {
    const p = user();
    expect(p).toMatch(/would a real company, team or person recognise themselves/);
    expect(p).toMatch(/Handing business teams theoretical papers about regulations" fails/);
  });

  it('forbids a refusal constructed by negating what was done', () => {
    expect(user()).toMatch(/Never a refusal you construct by negating what they did do/);
  });

  it('tells the writer to cut a sentence that only sets up the next one', () => {
    const b = letterPlanBlock(PLAN);
    expect(b).toMatch(/NEVER WRITE A SENTENCE WHOSE JOB IS TO SET UP THE NEXT ONE/);
    expect(b).toMatch(/inventing an opponent so it has something to beat/);
    expect(b).toMatch(/Cut the setup and write Y/);
  });
});
