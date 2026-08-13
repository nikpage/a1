// prompts/cover-blueprint.js
//
// The LETTER'S BLUEPRINT block — the plan written FOR the cover letter, stated
// plainly in front of the writer.
//
// The analysis emits `generation_framework.cover_blueprint` (see
// prompts/analysis.js): salutation target, hook angle, the Layer 3 matched
// pairs, the one objection the letter may defuse, and what the close asks for.
// It reaches the prompt inside the generation brief as JSON like everything
// else, but a plan buried in a nested object is read as data and a plan stated
// as instructions is executed — and this is the one object in the brief that
// was written for THIS document rather than for the CV.
//
// Absent or empty (an older analysis, or a blueprint pass that failed) the block
// is '' and the letter falls back to the general rules, which still hold.

function line(label, value) {
  const v = typeof value === 'string' ? value.trim() : '';
  return v ? `\n${label}: ${v}` : '';
}

// The pairs, numbered, requirement first — the order the letter proves them in.
function pairLines(pairs) {
  if (!Array.isArray(pairs)) return '';
  const rendered = pairs
    .map((p) => {
      const requirement = typeof p?.requirement === 'string' ? p.requirement.trim() : '';
      const evidence = typeof p?.evidence === 'string' ? p.evidence.trim() : '';
      // A pair missing either half proves nothing — it is not a pair.
      return requirement && evidence ? `- "${requirement}" ← ${evidence}` : '';
    })
    .filter(Boolean);
  return rendered.length ? `\nMatched pairs (the ad's requirement ← the real evidence that answers it):\n${rendered.join('\n')}` : '';
}

function objectionLine(objection) {
  if (!objection || typeof objection !== 'object') return '';
  const flag = typeof objection.flag === 'string' ? objection.flag.trim() : '';
  const answer = typeof objection.answer_evidence === 'string' ? objection.answer_evidence.trim() : '';
  if (!flag || !answer) return '';
  return `\nThe ONE objection this letter may address: ${flag} — settled by: ${answer}`;
}

// Who the letter is addressed to. The blueprint's own pick when the analysis
// made one; otherwise the raw extraction, which is the ad's contact line as the
// ad wrote it and is often a name with a department bolted on ("Deborah from
// People Team", "Jan Novák, HR"). Only the name half belongs in a salutation, so
// the fallback is cut at the first separator and capped at two words. Returns ''
// when there is nothing usable — the prompt then states the neutral form.
export function salutationName(analysis) {
  const picked = analysis?.generation_framework?.cover_blueprint?.salutation_target;
  if (typeof picked === 'string' && picked.trim()) return picked.trim();

  const raw = analysis?.job_extraction?.hr_contact;
  if (typeof raw !== 'string' || !raw.trim()) return '';
  const head = raw.split(/[,(]| from | at | — |[-–—] /i)[0].trim();
  const parts = head.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.join(' ');
}

export function coverBlueprintBlock(analysis) {
  const bp = analysis?.generation_framework?.cover_blueprint;
  if (!bp || typeof bp !== 'object') return '';

  const body =
    line('Address the letter to', bp.salutation_target) +
    line('Open on', bp.hook_angle) +
    pairLines(bp.matched_pairs) +
    objectionLine(bp.objection_to_defuse) +
    line('Close by asking for', bp.close_ask);

  if (!body.trim()) return '';

  return `
# The plan for THIS letter (written for the letter, not the CV)
Execute this. Everything else in the analysis was written for the CV; this was written for what you are holding.
${body}

## How to use it
- The pairs are the letter's evidence. Prove them as ONE argument, not three sections — pair the requirement to the evidence in the prose, never list them.
- The angle is what the first sentence stands on, not the sentence itself. Write your own opening from it.
- If an objection is named above, it gets ONE clause, once, inside the body — never the opening, never the close. If none is named, the letter raises none: say nothing about a concern nobody put in front of you.
- Anything here still bows to the invariants: if the master does not evidence it, it does not go in the letter, however the plan phrases it.
`;
}
