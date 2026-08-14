// prompts/voice-check.js
//
// The pass that does most of the work. A first draft drifts toward generic
// business writing no matter what the writing prompt said, so the finished
// letter is handed back with the candidate's recorded voice and REWRITTEN in it.
//
// It rewrites the WHOLE letter, and that is the point (CV_RULES.md, Layer 6
// check 24). It used to return { quote, replacement } spans applied by literal
// string match — safe, and useless: what makes a letter read as machine-written
// is its SHAPE (every sentence the same length, every paragraph the same weight,
// the point always arriving in the same position), and no span replacement can
// split a paragraph, land a four-word sentence or move where the point arrives.
// The clause-level pass polished the words of a document whose shape it could
// not touch, so the output stayed flat and the profile appeared to do nothing.
//
// Safety comes from ORDER, not from the size of the edit: this runs BEFORE the
// truth-verify pass, so every fact in the rewrite is checked exactly as a first
// draft's would be, and from an explicit fact lock — the rewrite may not add,
// remove or alter a single fact, number, name or date.
//
// It is given three things a description of a voice cannot carry on its own:
// the candidate's own writing, verbatim, so the cadence is heard rather than
// described; the measured shape faults of the draft, so the flatness it must fix
// is named in numbers; and the job ad's own register, because how far a recorded
// voice travels is judged against the target (Layer 2), not applied at full
// strength regardless.

// The profile as the rewrite sees it — List A plus the TRANSLATED half of
// List B plus the user's own lines, numbered so the model can work through them.
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

// The candidate's own writing, verbatim. Longer here than in the writing prompt
// on purpose: this pass exists to reproduce a cadence, and a cadence needs more
// than two sentences to be audible. Fenced the same way — manner only.
function sampleBlock(profile, maxChars = 1800) {
  const samples = Array.isArray(profile?.samples) ? profile.samples : [];
  const texts = [];
  for (const s of samples.slice(0, 2)) {
    const t = String(s?.text || '').trim();
    if (t) texts.push(t.length > maxChars ? `${t.slice(0, maxChars).trimEnd()}…` : t);
  }
  if (!texts.length) return '';
  return `
# The candidate's own writing (RHYTHM REFERENCE — manner only)
This is them, writing. Read it for pace, sentence shapes, punctuation and how they land a point. Then write like this.

ABSOLUTE: take NOTHING else from it. Not a fact, not a claim, not a number, not a phrase, not the subject matter. None of it belongs to this application.
${texts.map((t) => `\n"""\n${t}\n"""`).join('\n')}
`;
}

// The ad, as evidence of the REGISTER this letter is landing in. Layer 2: a warm
// informal ad earns the candidate's own casual shape; a terse corporate one
// earns the same voice held closer in. The model reads the register off the ad's
// own wording — we do not classify it here, because a label ("formal") is a
// cruder signal than the sentences themselves.
function registerBlock(jobText) {
  const t = String(jobText || '').trim();
  if (!t) return '';
  return `
# The employer's own words (how far the voice travels)
Read the register of this ad — how formal it is, how personal, how much warmth it shows. It sets HOW FAR the candidate's voice is carried in this letter.
- A warm, informal, first-person ad earns their voice close to full strength: their narrative shape, their casual cadence, their way of opening.
- A terse, formal, corporate ad earns the same voice held closer in: the same rhythm, the same directness, the same sentence shapes — less of the informality.
Either way it is THEIR voice. Holding it in never means flattening it into business prose.

"""
${t.slice(0, 2500)}
"""
`;
}

// The measured flatness of the draft (utils/cv-validate.js, check 24), stated as
// the problem to fix. Numbers rather than adjectives: "no sentence under 12
// words" is actionable where "vary your rhythm" is not.
function shapeBlock(faults) {
  const list = (Array.isArray(faults) ? faults : []).filter(Boolean);
  if (!list.length) return '';
  return `
# Measured faults in the draft's shape (fix these — they are not opinions)
${list.map((f) => `- ${f}`).join('\n')}
`;
}

export function buildVoiceRewritePrompt({ document = '', profile = null, jobText = '', shapeFaults = [] } = {}) {
  const cleanup = profile?.options?.cleanup === true;

  const systemMessage = {
    role: 'system',
    content:
      'You rewrite a piece of writing so that it reads as though one specific person wrote it. You are given how that person writes and, usually, samples of their actual writing. You change the shape and the wording freely and you change the facts not at all. You return the rewritten piece and nothing else.',
  };

  const userMessage = {
    role: 'user',
    content: `# Task
Below is a COVER LETTER drafted on someone's behalf, and a description of how that person actually writes. Rewrite the letter so it reads like them.

Rewrite it properly. Restructure the sentences, split or merge the paragraphs, move where the point lands, change how it opens and how it closes — whatever their voice requires. A light edit is the wrong answer here: the draft was written by a model and reads like one, and that is a fault of its SHAPE, not of its vocabulary.

# The fact lock (absolute)
The facts are settled and they are not yours to touch. Every employer, job title, date, number, metric, client, tool, place and name stays exactly as the draft has it.
- Add nothing. No new achievement, no new number, no duration, no claim, no colour, no scene, no detail that is not already in the draft in front of you.
- CUTTING IS ALLOWED, AND OFTEN THE ANSWER. You may drop a whole sentence, a whole example, a whole employer — dropping evidence invents nothing, and everything you drop is still on the CV. If the draft touches five employers, keep the two strongest for this job and cut the rest; a letter that goes deep on two beats one that names five. What you may never do is CHANGE a fact you keep.
- Do not sharpen a fact. "grew billing to over $100k" does not become "grew billing tenfold"; "a team of 12" does not become "a large team".
If their voice would want a detail the draft does not contain, their voice does not get it. Write the sentence without it.

# What to change
- **The shape, first.** Vary sentence length hard: their long sentences and their short ones, in the proportion the samples show. Let paragraphs differ in weight. Where they use a one-line paragraph as a pivot, use one.
- **Variation follows MEANING, never a target.** A short sentence earns its place by landing a point — a conclusion, a pivot, a fact that needs no qualifying. Do NOT manufacture rhythm by chopping one thought into three stubs ("I led the eBay account there. We scaled billing. The team grew."): that is a list with full stops in it, and it reads worse than the flat draft it replaced. If a thought is one thought, it is one sentence, however long.
- **The opening.** Open the way they open — but only on something the draft already states. Never invent a scene, a memory, a year or a mood to open on. And never open on a career summary: a first sentence that stacks abstractions ("Guiding companies through critical phases of digital product development — from strategic discovery to delivery — has been my core work since 2016") is brochure copy, not a person talking. Open on one concrete thing they did.
- **The closing.** Close the way they close.
- **The wording.** Their vocabulary, their punctuation habits, their level of hedging or bluntness.
- Keep the date line, the salutation and the signature block exactly as they are.
- Keep the letter's argument and its evidence: the same points, proved by the same facts. You are changing how it reads, not what it says.${cleanup ? `
- The candidate has asked for their writing to be tidied while keeping their voice: fix grammar, repetition and genuinely tangled sentences. Keep the cadence, sentence shapes, punctuation habits and directness — those ARE the voice.` : ''}

# What not to do
- Do not sand it into business prose. A letter that reads slightly too casual is a better outcome than one that reads like a template. That drift is the single most common failure here and it is the failure this pass exists to prevent.
- Do not pad. The rewrite is the same length as the draft or SHORTER — cutting is how it gets better.
- Do not turn the letter into a run of stubs. Six sentences of eight words each is not rhythm, it is a list with full stops. Their long sentences are as much a part of their voice as their short ones: if the samples show 25-word sentences, write 25-word sentences.
- Do not reach for the constructions that mark writing as machine-made, whatever the draft did: "not only X but also Y", "This ensures…", "positions me to…", "aligns directly with your mission", "I believe" as a hedge before a claim, and any sentence whose job is to admire the employer rather than state a fact. If a sentence would survive on another candidate's letter to another company, cut it or replace it with something only this person could write.
- Do not explain yourself, do not comment, do not add a preamble or a note.
${shapeBlock(shapeFaults)}${registerBlock(jobText)}
# How this person writes (numbered)
${numberedProfile(profile)}
${sampleBlock(profile)}
# The draft
${document}

# Output
Return the rewritten letter only — date, salutation, body, signature block. No JSON, no markdown fence, no commentary.
`,
  };

  return [systemMessage, userMessage];
}
