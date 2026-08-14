// prompts/cover-evidence.js
//
// The LETTER'S EVIDENCE block — the material the letter is given to argue from,
// stated plainly in front of the writer.
//
// The analysis emits `generation_framework.cover_evidence` (see
// prompts/analysis.js): the ad's requirements the record can genuinely answer
// with the achievement that answers each, and the recruiter concerns that have a
// real answering fact. It reaches the prompt inside the generation brief as JSON
// like everything else, and JSON nested three deep is read as data — but unlike
// the CV blueprint, this material was gathered for THIS document, so it is put
// where the writer will see it.
//
// It is EVIDENCE, not a plan (CV_RULES.md, Layer 3: "The letter is composed, not
// executed"). It names nothing about the letter's shape: not the hook, not which
// requirements to answer, not their order, not whether a concern is addressed at
// all. Those are the writer's, decided with the candidate's steering, the tone,
// the voice profile and the market's length all in hand — none of which existed
// when this material was gathered.
//
// Absent or empty (an older analysis, or a blueprint pass that failed) the block
// is '' and the letter argues from the record and the ad directly, which the
// general rules already cover.

// One requirement and the achievement that answers it. Order here is the order
// the analysis happened to emit; it carries no meaning and the block says so.
function requirementLines(pairs) {
  if (!Array.isArray(pairs)) return '';
  const rendered = pairs
    .map((p) => {
      const requirement = typeof p?.requirement === 'string' ? p.requirement.trim() : '';
      const evidence = typeof p?.evidence === 'string' ? p.evidence.trim() : '';
      // A half without its other half proves nothing and is not evidence.
      return requirement && evidence ? `- "${requirement}" ← ${evidence}` : '';
    })
    .filter(Boolean);
  return rendered.length
    ? `\n## What the ad asks for, and the real evidence that answers it\n${rendered.join('\n')}`
    : '';
}

// The concerns that have an answer behind them. The letter may use one of these
// or none; it may not raise a concern that is not here, because a concern with
// no answering fact is one the letter cannot improve.
function concernLines(concerns) {
  if (!Array.isArray(concerns)) return '';
  const rendered = concerns
    .map((c) => {
      const flag = typeof c?.flag === 'string' ? c.flag.trim() : '';
      const answer = typeof c?.answer_evidence === 'string' ? c.answer_evidence.trim() : '';
      return flag && answer ? `- ${flag} — settled by: ${answer}` : '';
    })
    .filter(Boolean);
  return rendered.length
    ? `\n## Concerns a recruiter may raise that this record CAN answer\n${rendered.join('\n')}`
    : '';
}

// Who the letter is addressed to. A fact off the job data, never a plan: the
// ad's own contact line as the ad wrote it, which is often a name with a
// department bolted on ("Deborah from People Team", "Jan Novák, HR"). Only the
// name half belongs in a salutation, so it is cut at the first separator and
// capped at two words. Returns '' when there is nothing usable — the prompt then
// states the neutral form, and no name is ever guessed at.
export function salutationName(analysis) {
  const raw = analysis?.job_extraction?.hr_contact;
  if (typeof raw !== 'string' || !raw.trim()) return '';
  const head = raw.split(/[,(]| from | at | — |[-–—] /i)[0].trim();
  const parts = head.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.join(' ');
}

export function coverEvidenceBlock(analysis) {
  const ev = analysis?.generation_framework?.cover_evidence;
  if (!ev || typeof ev !== 'object') return '';

  const body = requirementLines(ev.requirement_evidence) + concernLines(ev.concerns);
  if (!body.trim()) return '';

  return `
# Evidence gathered for THIS letter
Material, not a plan. Everything else in the analysis was gathered for the CV; this was gathered for what you are holding — but it decides nothing about the letter.
${body}

## How to use it
- YOU decide what this letter argues: which of these the letter uses, which it leaves out, what it opens on, the order it proves things in, and what it asks for at the close. This list is unranked and its order means nothing.
- Use the ones that serve the argument. A requirement that does not fit the letter you are writing is left unanswered — better than a letter that walks a list.
- Prove what you use IN THE PROSE, pairing the requirement to the evidence. Never list them, never devote a paragraph to each.
- The concerns are optional and at most ONE may be addressed, in one clause inside the body. Addressing none is a common, correct answer; a concern not listed here is never raised, because the record cannot answer it.
- The candidate's own instructions outrank every line of this: evidence they asked you to play down is not evidence here either, however well it answers a requirement.
- All of it still bows to the invariants: if the master does not evidence it, it does not go in the letter, however this block phrases it.
`;
}
