// prompts/voice-check.js
//
// The pass that does most of the work. A first draft drifts toward generic
// business writing no matter what the prompt says, so the voice profile is
// checked against the finished letter and the misses are repaired.
//
// Two calls, deliberately separate:
//   1. CHECK — reads the draft against the profile and lists concrete misses,
//      each naming the profile line it violates and quoting the text that does.
//      It never rewrites. A checker that also rewrites rewrites everything.
//   2. FIX — repairs ONLY the flagged spans and changes nothing else. Returns
//      { quote, replacement } pairs, applied by literal string match through the
//      same applyGenerationCorrections() the truth-verify pass uses, so anything
//      it invents that is not verbatim in the document is discarded.
//
// The fix pass runs BEFORE the truth-verify pass, never after: a voice rewrite
// must not be able to smuggle a claim past the fact-checker.

import { SAMPLE_LABELS } from './voice-profile.js';

// The profile as the CHECKER sees it — List A plus the TRANSLATED half of List B
// plus the user's own lines, numbered so a miss can point at one of them.
function numberedProfile(profile) {
  const lines = [];
  for (const o of Array.isArray(profile?.list_a) ? profile.list_a : []) {
    const t = String(o || '').trim();
    if (t) lines.push(t);
  }
  for (const b of Array.isArray(profile?.list_b) ? profile.list_b : []) {
    const t = String(b?.translation || '').trim();
    if (t) lines.push(t);
  }
  const own = String(profile?.profile_text || '').trim();
  if (own) {
    for (const l of own.split('\n').map((x) => x.trim()).filter(Boolean)) lines.push(l);
  }
  return lines.map((l, i) => `${i + 1}. ${l}`).join('\n');
}

export function buildVoiceCheckPrompt({ document = '', profile = null } = {}) {
  const systemMessage = {
    role: 'system',
    content:
      'You compare a piece of writing against a description of how one specific person writes, and report where the writing does not match. You are literal and concrete. You never rewrite the document, and you never comment on whether it is good.',
  };

  const userMessage = {
    role: 'user',
    content: `# Task
Below is a VOICE PROFILE describing how a specific person writes, and a COVER LETTER written on their behalf. Report every place the letter does not match the profile.

A miss is concrete and measurable against a numbered profile line. Examples of the form required:
- "Profile 3 says short varied sentences; the draft averages 28 words with little variation."
- "Profile 7 says no rhetorical questions; the draft has two."
- "Profile 1 says they lead with the point; the draft opens with two sentences of setup."

# Rules
- Every miss names the profile line NUMBER it violates and quotes the offending text EXACTLY from the letter.
- Report only mismatches with the profile. Not grammar, not strategy, not whether a claim is true, not whether the letter is persuasive — other passes own those.
- Drift toward generic business writing is the failure you exist to catch. Look hardest for: sentences that have flattened to one length, hedging the person does not use, abstractions where they are concrete, an opening that sets up instead of landing, corporate transitions ("Furthermore", "Additionally") a person would not write.
- Mild informality is NOT a miss. If the letter is a little casual and the profile says the person is, that is a match. Only flag informality the profile does not support.
- Do not invent misses to fill the list. An empty list is a valid and useful answer.

# Output — JSON only, no markdown fence, exactly this shape:
{
  "misses": [
    { "profile_line": 3, "miss": "what the profile says versus what the draft does", "quote": "the offending text, copied exactly from the letter" }
  ]
}

# VOICE PROFILE (numbered)
${numberedProfile(profile)}

# COVER LETTER
${document}
`,
  };

  return [systemMessage, userMessage];
}

export function buildVoiceFixPrompt({ document = '', profile = null, misses = [] } = {}) {
  const list = (Array.isArray(misses) ? misses : [])
    .map((m, i) => `${i + 1}. ${String(m?.miss || '').trim()}\n   TEXT: "${String(m?.quote || '').trim()}"`)
    .join('\n');

  const systemMessage = {
    role: 'system',
    content:
      'You repair specific, listed defects in a document and change nothing else. You return exact spans and their replacements, never a rewritten document.',
  };

  const userMessage = {
    role: 'user',
    content: `# Task
A cover letter has been checked against a description of how its author actually writes. The misses are listed below. Fix ONLY those, by returning the smallest span that contains each one and the text that should replace it.

# Rules
- "quote" must appear VERBATIM in the letter, character for character, or your correction is discarded.
- Quote the smallest span that contains the miss and still reads as a unit — the clause or the sentence, not two words, because replacing words mid-sentence leaves wreckage.
- The replacement says the SAME THING in the author's manner. Keep every fact, number, employer, date and name exactly as the letter has them.
- ABSOLUTE: never add a fact, a number, a skill, a duration or a claim that is not already in the span you are replacing. This is a style repair. A plainer, shorter span is the correct outcome when nothing else fits.
- Change nothing that was not flagged. Do not restyle neighbouring sentences, do not reorder paragraphs, do not touch the date, the salutation or the signature block.
- Where a fix cannot be made without inventing something, omit that item. A remaining miss is better than a fabrication.

# The profile being matched
${numberedProfile(profile)}

# The misses to fix
${list}

# Output — JSON only, no markdown fence, exactly this shape:
{
  "unsupported": [
    { "quote": "", "replacement": "", "reason": "voice: which miss this fixes" }
  ]
}

# COVER LETTER
${document}
`,
  };

  return [systemMessage, userMessage];
}

// Re-exported so callers building the review UI have one import for the labels.
export { SAMPLE_LABELS };
