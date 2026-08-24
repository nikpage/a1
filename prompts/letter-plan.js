// prompts/letter-plan.js
//
// THE LETTER PLAN. Structure before prose.
//
// Why this stage exists: a model handed an argument and asked for a letter
// produces the SHAPE of a letter rather than the argument. It opens by
// announcing the application, spends a paragraph per theme because a letter has
// paragraphs, touches every requirement it was shown, and closes by hoping to
// hear back. Every one of those is the form asserting itself over the content.
//
// So the decisions that a writer makes badly under the pressure of producing
// fluent prose are made HERE, with nothing to produce but decisions:
//   - which two points carry the letter, and in which order
//   - the ONE instance that proves each, and the concrete detail inside it
//   - what the first sentence has to do
//   - whether a shortfall is stated at all, and where
//   - what the last sentence has to do
//
// It decides SHAPE, never prose. It writes no sentence the letter will use;
// prompts/cover-letter.js owns every word. That separation is the point — the
// defect this repo has hit twice is two models owning one document (see the
// removed applyVoice pass in CLAUDE.md). The plan is not a second writer: it is
// the brief the one writer executes.
//
// The evidence it chooses from is the analysis's cover_evidence — unranked
// pairs the record genuinely answers (prompts/cover-evidence.js). Ranking them
// is exactly this stage's job and was previously nobody's.

import { currentDateBlock } from './current-date.js';
import { rawAdBlock, targetJobBlock } from './job-target.js';

const arr = (v) => (Array.isArray(v) ? v : []);
const str = (v) => (typeof v === 'string' ? v.trim() : '');

// The ad, in the employer's own words where the record kept them.
function adFor(analysis) {
  return rawAdBlock(analysis) || targetJobBlock(analysis);
}

// The evidence pool the plan ranks. Rendered flat and UNRANKED — the order here
// is the analysis's arrival order and carries no meaning, which is stated so the
// planner does not mistake position for priority.
function evidencePool(analysis) {
  const ev = analysis?.generation_framework?.cover_evidence || {};
  const pairs = arr(ev.requirement_evidence).filter((p) => str(p?.requirement) || str(p?.evidence));
  const concerns = arr(ev.concerns).filter((c) => str(c?.flag));
  const flags = arr(analysis?.analysis?.red_flags).map(str).filter(Boolean);

  const lines = [];
  if (pairs.length) {
    lines.push('# What this employer asked for, and the real work that answers it');
    lines.push('UNRANKED — the order below is arrival order and means nothing. Ranking them is your job.');
    for (const p of pairs) lines.push(`- THEY ASK: ${str(p.requirement)}\n  THE RECORD ANSWERS: ${str(p.evidence)}`);
  }
  if (concerns.length) {
    lines.push('\n# Concerns a recruiter would raise, and what in the record settles each');
    for (const c of concerns) lines.push(`- CONCERN: ${str(c.flag)}\n  THE RECORD ANSWERS: ${str(c.answer_evidence)}`);
  }
  const unanswered = flags.filter((f) => !concerns.some((c) => str(c.flag) === f));
  if (unanswered.length) {
    lines.push('\n# Concerns the record CANNOT answer (there is no fact that settles these)');
    for (const f of unanswered) lines.push(`- ${f}`);
    lines.push('A concern with nothing behind it is covered by SILENCE. Never plan a sentence that raises one and then hedges.');
  }
  return lines.join('\n');
}

const INSTRUCTIONS = `Here is the case for this person and the advert it answers. PLAN the letter. Do not write it.

Decide the ORDER the two carrying points are made in, and why that order. The stronger one does not automatically go first: the one that answers what these people are most uneasy about goes first.

TWO points. If you name three you have not decided. They must answer what this employer is hiring someone to DO — not how they like it done, and not what the office is like.

For each, name the SINGLE piece of evidence that will be told — one, not three. Then name the concrete detail inside it that does the persuading. It is one of these, and they rank equally:
  - a POSITION this person holds and has pushed somewhere real — a belief about how the work should be done, and where they argued or built it. This is the strongest kind and the one most often missed.
  - a DECISION they took that another person in that seat could have taken differently.
  - a CONSTRAINT that was in the way, and what they did about it.
  - something they REFUSED, cut, or said no to — one the record actually states. Never a refusal you construct by negating what they did do ("we did not simply hand over a document"); if the record does not say they turned something down, they did not.
  - a NUMBER the record actually states.

A NUMBER IS ONE OPTION AMONG FIVE, NEVER THE TARGET. Reaching for a metric because metrics feel like proof is how a letter ends up reading like a performance review; the best letter written for this candidate by hand contains no number at all. If the evidence you picked has no such detail in the record, pick different evidence — do not plan to invent one.

Where BOTH points come from the same kind of work, say what the two instances have in COMMON — the lesson that recurs across them. A shared lesson stated once is worth more than two separate proofs, and it is what turns a list of clients into an argument.

Decide the FIRST SENTENCE'S JOB. It says WHAT THIS CANDIDATE NOTICED ABOUT THIS EMPLOYER AND WHY IT MATTERS TO THEM. It is anchored to the candidate — what caught their attention, what they care about, why this one and not another. It is NEVER a verdict on the employer's business.

THE LINE BETWEEN THE TWO IS THE WHOLE GAME:
- "Your app caught my eye because you are actually fixing X instead of talking about it, and X is the problem I care about" — correct. It reports what one person noticed and wants. They cannot dispute it and they have not been told anything about themselves.
- "You are showing Europe that compliance does not have to make an app a maze" / "You are getting right what others in your field get wrong" — WRONG. That is a verdict on their market position, delivered to the people who work there and know it far better than the applicant. It reads as an outsider grading them, and they stop reading.

Say what the candidate saw and why it matters to them. Never how the employer is doing, never what their industry gets wrong, never what their approach proves. Not a claim about the candidate's capabilities either. State the job that sentence has to do — never write the sentence.

HARD CONSTRAINTS ON WHAT YOU WRITE IN "opening_claim":
- FIFTEEN WORDS MAXIMUM. A long opening claim is an abstraction, and the writer will turn an abstraction into a thesis. Short forces you to name the actual thing.
- Plain words a person says out loud. No "strategic", "disciplined approach", "viable path", "positioning", "leverage", "ecosystem", "landscape". If it reads like a consulting deck, it is wrong.
- It must NOT contain the job title, the words "apply", "application", "role", "position", or "reaching out". A first sentence built on any of those announces the application, which is the one thing it may never do.
- Name what THEY do, in your own words, and the judgement about it. "They are actually fixing X instead of talking about it" is the shape. "To validate their strategic decision to pursue X" is not.

ARGUE AGAINST SOMETHING REAL, OR AGAINST NOTHING AT ALL. Where the advert rules something out, states a frustration, or describes how its field usually gets this wrong, name that in "argue_against" — the contrast is what makes the letter impossible to paste into another application.

BUT IT MUST BE SOMETHING PEOPLE ACTUALLY DO. Point at it: this advert says it, or this record shows the candidate meeting it. A thing you invented so it could be rejected is a straw man, and a straw man reads as machine-written far more loudly than a flat sentence does. If you cannot point at who does the thing, leave "argue_against" EMPTY. Empty is correct and costs the letter nothing; a manufactured opposite costs it everything.

The test: would a real company, team or person recognise themselves in what you are arguing against? "Products that lecture users about why they should want the technology" passes — plenty of them do exactly that. "Handing business teams theoretical papers about regulations" fails, because nobody was ever going to do it. Where the material lets you, plan the letter to ARGUE AGAINST SOMETHING — the thing this employer has ruled out, or the way their field usually gets this wrong. An advert states its fear in the negative, and naming that fear and answering it with something real is the most persuasive move available. It is also the move that cannot be pasted into a different application.

Decide whether a SHORTFALL is stated at all, and if so where. Only where this employer asked for something the record is near but not at, and only where the record itself supports the true level. Stated once, plainly, inside a sentence that is doing something else as well — never in a paragraph of its own, never argued up, never apologised for. Where the record answers nothing at all, it is covered by silence: plan no mention.

Decide the LAST SENTENCE'S JOB. It does not thank, does not hope, and does not ask for consideration. State the job — never write the sentence.

THE SAME HARD CONSTRAINTS BIND "close" AS BIND "opening_claim": fifteen words maximum, plain words a person says out loud, no consulting-deck vocabulary. Additionally it may NOT contain "opportunity", "discuss how", "applied to", "roadmap", "welcome the", or "look forward" — a close built on any of those is the stock ending every applicant sends, and it would survive being pasted into a different application.

A close asks for a specific human next thing, or names what this person would go and look at first. "Buy them a coffee and talk" is a real close. "Discuss how my experience can be applied to their roadmap" is not.

PICK THE INSTANCE THAT SHOWS THE BELIEF, NOT THE BIGGEST LOGO. A talk, an unpaid project, an advisory engagement or a small client counts for more than a famous employer when it is the one that shows this person acting on what they care about. The record's prestige names are what the CV already carries; the letter is where the smaller, truer instance earns its place.

Every instance you name must be real work already in the material below, named the way the record names it. You are choosing among facts, never adding one.`;

const SHAPE = `Return VALID JSON only — no markdown fence, no commentary — in exactly this shape:

{
  "opening_claim": "the JOB the first sentence must do, as an instruction to the writer — what this candidate noticed about this employer and why it matters to THEM. Anchored to the candidate, never a verdict on the employer's business. Not the sentence itself.",
  "argue_against": "the thing this employer has ruled out, the frustration they state, or the way their field usually gets this wrong — which this letter argues against. Plain words, under fifteen. Leave empty ONLY if the advert and the record between them offer nothing to push against, which is rare.",
  "order_reason": "one sentence: why the first point goes first — what this employer is most uneasy about.",
  "points": [
    {
      "answers": "the ask or concern of theirs this point answers, in their own words",
      "instance": "the ONE piece of real work that proves it, named as the record names it",
      "detail": "the concrete thing inside that instance which does the persuading — the position pushed, the decision, the constraint, the refusal, or a number the record states"
    }
  ],
  "shared_lesson": "what the two instances have in common, where they have something in common — the lesson that recurs. Empty string where they genuinely do not.",
  "shortfall": { "state": true, "what": "the true level, plainly", "placement": "where in the letter it is said, and what the sentence is also doing" },
  "close": "the JOB the last sentence must do. Not the sentence itself."
}

"points" holds EXACTLY TWO entries, in the order the letter makes them.
"shortfall" is { "state": false } where nothing should be stated.
EVERY FIELD YOU WRITE IS READ AND EXECUTED LITERALLY BY THE WRITER, SO THE REGISTER OF YOUR PLAN BECOMES THE REGISTER OF THE LETTER. Write all of it in plain, spoken words. If any field of your plan reads like a consulting deck or a performance review, the letter will too, and it will be indistinguishable from the letter every other applicant sent.

Write the plan in the same language as the candidate's record.`;

export function buildLetterPlanPrompt({ analysis, tweak = '', now = new Date() } = {}) {
  const steering = str(tweak)
    ? `\n# The candidate's own instructions (HIGHEST PRIORITY)\n"${str(tweak)}"\nWhat they asked you to foreground is a carrying point if the record proves it at all. What they asked you to play down is never a carrying point and never the opening claim. Steering never adds a fact.\n`
    : '';

  return [
    {
      role: 'system',
      content: `${currentDateBlock(now)}\n\nYou plan cover letters for a hiring audience. You decide what the letter argues, in what order, and on which single piece of evidence each point rests. You never write the letter's prose and you never invent a fact. You return JSON only.`,
    },
    {
      role: 'user',
      content: `${INSTRUCTIONS}\n${steering}\n${adFor(analysis)}\n\n${evidencePool(analysis)}\n\n${SHAPE}`,
    },
  ];
}

// The plan as the WRITER reads it. Renders nothing when the plan is missing or
// malformed, so a failed plan call degrades to the old behaviour rather than
// putting an empty scaffold in front of the writer.
export function letterPlanBlock(plan) {
  if (!plan || typeof plan !== 'object') return '';
  const points = arr(plan.points).filter((p) => str(p?.instance) || str(p?.answers));
  if (points.length < 1) return '';

  const rendered = points
    .slice(0, 2)
    .map((p, i) => {
      const bits = [`${i + 1}. ANSWERS: ${str(p.answers) || '(their ask)'}`];
      if (str(p.instance)) bits.push(`   TELL THIS ONE INSTANCE: ${str(p.instance)}`);
      if (str(p.detail)) bits.push(`   THE DETAIL THAT PERSUADES: ${str(p.detail)}`);
      return bits.join('\n');
    })
    .join('\n');

  const shortfall =
    plan.shortfall && plan.shortfall.state
      ? `- STATE THE SHORTFALL ONCE: ${str(plan.shortfall.what)}. Where: ${str(plan.shortfall.placement) || 'inside a sentence that is doing something else as well'}. Plainly, never argued up, never apologised for, never a paragraph of its own.`
      : `- STATE NO SHORTFALL. Nothing in this letter hedges, pre-empts or explains away a gap. Silence is the plan.`;

  const against = str(plan.argue_against)
    ? `- ARGUE AGAINST THIS: ${str(plan.argue_against)}. Name it and answer it with something this candidate actually did. A letter that says what the work is NOT cannot be pasted into a different application.\n`
    : '';
  const lesson = str(plan.shared_lesson)
    ? `- WHAT THE TWO INSTANCES SHARE: ${str(plan.shared_lesson)}. Say it once, in the candidate's own terms, after both are told. This is the argument; the two instances are only its evidence.\n`
    : '';

  return `
# THE PLAN FOR THIS LETTER — execute it

This is already decided. You are not choosing what to argue; you are writing it.

- THE FIRST SENTENCE'S JOB: ${str(plan.opening_claim) || 'carry a judgement about this employer and why it matters to this candidate'}. Write the sentence yourself — do not repeat this instruction back. It says what the candidate NOTICED and why it matters to them — never a verdict on how this employer is doing, never a thesis about their industry, never a claim about the candidate's own qualities. Do not tell these people anything about their own business: they know it, and being graded by an applicant is why a letter gets put down. It never announces the application, never names the job title back at them, and never says where the ad was seen.
${str(plan.order_reason) ? `- WHY THIS ORDER: ${str(plan.order_reason)}\n` : ''}- THE TWO POINTS, IN THIS ORDER:
${rendered}
${against}${lesson}${shortfall}
- THE LAST SENTENCE'S JOB: ${str(plan.close) || 'land the argument'}. It does not thank, does not hope, and does not ask for consideration. THE LETTER ENDS ON IT: the last line of the body does this job and nothing comes after it. THERE IS NO CONCLUDING SENTENCE BETWEEN THE LAST POINT AND THIS ONE: the second point ends with what happened, and the very next sentence is the close. Do not write a sentence that sums up what the two points showed — a summary of the argument just made is the letter grading its own work, and it displaces the one line that asks for the next human step.

TELL each instance — what happened, with its specifics — rather than summarising what it demonstrates. The specifics are the ones the plan named: a position pushed, a decision, a constraint, a refusal. A NUMBER IS NOT REQUIRED AND IS NOT THE TARGET — do not reach for a metric to make a point feel proved, and never state one the record does not carry. A reader who is told what happened draws the conclusion themselves and believes it; a reader handed the conclusion does not. ONE instance per point: a second example does not strengthen the first, it dilutes it.

EVERY SENTENCE IN THIS LETTER HAS THE CANDIDATE IN IT — what they saw, did, chose, refused, built, or want. A sentence stating a general truth about the world has no place here, however true it is. These are the exact sentences this letter has produced and every one of them is a defect:
- "Strict boundaries sharpen product decisions."
- "Complex technologies only succeed when you design them around actual human habits."
- "Treating regulatory parameters as firm boundaries sharpens design decisions rather than slowing execution down."
- "Complex constraints are guardrails that speed up execution rather than slow it down."
- "My work is about active, technical execution."
They are maxims. They are what a machine writes when it wants to sound like it has a view. TEST EVERY SENTENCE: if it would still be true with this candidate deleted from it, cut it and write what they actually did instead. No exceptions, not even for the sentence that opens a paragraph.

NEVER WRITE A SENTENCE WHOSE JOB IS TO SET UP THE NEXT ONE. "We didn't do X. Instead, I did Y." — where nobody proposed X — is the letter inventing an opponent so it has something to beat. Cut the setup and write Y. What the candidate actually did is interesting on its own, and if it is not, the plan picked the wrong instance.

A POSITION IS SHOWN BY WHAT IT MADE THE CANDIDATE DO — NEVER STATED AS A MAXIM. Where the plan names a position, do not write the general truth of it. Write what it made this person do, where, and what came of it, and let the reader arrive at the general truth themselves. "Treating regulation as a firm boundary sharpens design" is a slogan and a machine wrote it; "the compliance team's constraints decided the flow, so I built it that way first" is a person. A sentence that would still be true if a different person had written it is not doing any work in this letter.

DO NOT SUM UP. Never write a sentence that tells the reader what the two instances demonstrate, prove, show, reflect, or have in common as a statement about the candidate's professional character — "both of these show how I work as a…", "this combination demonstrates…". The instances make the point. Restating the point on the reader's behalf is the single clearest sign that a model assembled the letter, and it wastes the words that could have carried another specific.

NEVER NAME THE ROLE BACK AT THEM. The job title does not appear in this letter — not in the opening, not as a description of the candidate, not in the close. They wrote the advert; they know what they advertised.

Two points is the whole letter. Every other ask this employer listed stays out — not hedged, not touched in passing, out.
`;
}
