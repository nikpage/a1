// prompts/voice-check.js
//
// The pass that does most of the work. A first draft drifts toward generic
// business writing no matter what the prompt says, so the finished letter is
// handed back with the voice profile and the divergences are rewritten.
//
// ONE call. It identifies where the draft diverges from the profile AND repairs
// those parts, changing nothing else. It reports its repairs as { quote,
// replacement } spans rather than returning a rewritten letter, so they can be
// applied by literal string match through the same applyGenerationCorrections()
// the truth-verify pass uses — a "repair" quoting text the letter does not
// contain is discarded rather than trusted, which is what stops a style pass
// from quietly rewriting the whole document.
//
// It runs BEFORE the truth-verify pass, never after: a voice rewrite must not be
// able to smuggle a claim past the fact-checker.
//
// There is deliberately no appropriateness or rigidity check layered on top.
// Where the profile and business convention conflict, the profile wins; mild
// informality is an acceptable outcome.

// The profile as the fix pass sees it — List A plus the TRANSLATED half of
// List B plus the user's own lines, numbered so a divergence can point at one.
// The raw List B traits are never included: an untranslated register-bound habit
// must never reach a writer.
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

export function buildVoiceFixPrompt({ document = '', profile = null } = {}) {
  const cleanup = profile?.options?.cleanup === true;

  const systemMessage = {
    role: 'system',
    content:
      'You make a piece of writing match a description of how one specific person writes. You change only what diverges from that description and leave everything else exactly as it is. You return the spans you changed and their replacements, never a rewritten document.',
  };

  const userMessage = {
    role: 'user',
    content: `# Task
Below is a VOICE PROFILE describing how a specific person writes, and a COVER LETTER written on their behalf. Find every place the letter diverges from the profile and rewrite ONLY those parts.

Examples of what to catch:
- The profile says short varied sentences; the draft averages 28 words with little variation.
- The profile says no rhetorical questions; the draft has two.
- The profile says they lead with the point; the draft opens with two sentences of setup.

Drift toward generic business writing is the failure you exist to catch — it is where first drafts go however the writing instructions were phrased. Look hardest for: sentences flattened to one length, hedging this person does not use, abstractions where they are concrete, an opening that sets up instead of landing, corporate transitions ("Furthermore", "Additionally") a person would not write.

# Rules
- Report each change as the smallest span of the letter that contains the divergence and still reads as a unit — the clause or the sentence, not two words, because replacing words mid-sentence leaves wreckage.
- "quote" must appear VERBATIM in the letter, character for character, or the change is discarded.
- The replacement says the SAME THING in this person's manner. Keep every fact, number, employer, date and name exactly as the letter has them.
- ABSOLUTE: never add a fact, a number, a skill, a duration or a claim that is not already in the span you are replacing. This is a style repair. A plainer, shorter span is the correct outcome when nothing else fits, and where a change cannot be made without inventing something, leave that part alone.
- Change nothing that does not diverge. Do not restyle neighbouring sentences, do not reorder paragraphs, do not touch the date, the salutation or the signature block.
- Mild informality is NOT a divergence. If the letter is a little casual and the profile says this person is, that is a match — leave it. Where the profile and business convention pull apart, THE PROFILE WINS.
- Returning no changes is a valid answer when the draft already matches.${cleanup ? `
- The candidate has asked for their writing to be tidied while keeping their voice: you may also fix grammar, repetition and genuinely tangled sentences. Keep the cadence, sentence shapes, punctuation habits and directness — those ARE the voice. Do not "improve" them into standard business prose.` : ''}

# Output — JSON only, no markdown fence, exactly this shape:
{
  "unsupported": [
    { "quote": "", "replacement": "", "reason": "which profile line this brings the letter back to" }
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
