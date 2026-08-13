// prompts/voice-profile.js
//
// The VOICE PROFILE: a written description of how one specific person writes,
// extracted from samples of their own writing. It exists because a cover letter
// that reads like a language model loses, and no amount of tone selection fixes
// that — tone picks an attitude, voice is the person.
//
// It is deliberately NOT the CV. Bullet fragments carry no voice, so the CV is
// never accepted as a sample. It is also deliberately NOT part of the master
// record: the master is the evidence set the truth-verify pass and the Layer 6
// validator check every generated claim against, and voice text sitting inside
// it would launder a claim into "supported". Voice lives in its own column
// (`cv_data.voice_profile`) for exactly that reason.
//
// The profile has two halves, and the split is the whole idea:
//
//   List A — traits that carry across registers. Applied directly, always.
//            Sentence length and variation, whether they lead with the point,
//            hedging, concreteness, punctuation habits, how they open and close.
//   List B — traits bound to the register they were written in: profanity,
//            slang, rhetorical questions, emoji, fragments. NEVER applied
//            directly. Each one is TRANSLATED into its business-appropriate
//            equivalent, because deleting it loses the person ("swears when
//            emphatic" is not "no emphasis" — it is "states it flat, no
//            hedging"). The translation is stored and shown to the user.
//
// How far the translation has to travel is what the sample LABEL is for: a work
// email needs almost none, a personal chat needs a lot.

// What the user tells us each sample is. The label travels with the sample into
// the prompt, because "so anyway" in a forum post and in a work email are not
// the same signal about how this person writes at work.
export const SAMPLE_LABELS = {
  application: 'Previous application or cover letter',
  work_doc: 'Work email or work document',
  public: 'Blog post, article, or public writing',
  personal: 'Personal message, chat, forum post',
  other: 'Other',
};

// How much translation each register needs. Used by the prompt to calibrate, and
// by the UI to warn the user when their samples are all far from business prose.
export const LABEL_DISTANCE = {
  application: 'almost none — this is already business writing',
  work_doc: 'almost none — this is already business writing',
  public: 'some — public prose is looser than a letter but still written for strangers',
  personal: 'a lot — private register; expect most of List B to need translating',
  other: 'unknown — judge from the writing itself',
};

// A single model call over ALL samples together: traits show up as patterns
// across samples, and one call can see the pattern where per-sample calls only
// see instances.
export function buildVoiceProfilePrompt({ samples = [] } = {}) {
  const blocks = samples
    .map((s, i) => {
      const label = SAMPLE_LABELS[s?.label] || SAMPLE_LABELS.other;
      const distance = LABEL_DISTANCE[s?.label] || LABEL_DISTANCE.other;
      return `--- SAMPLE ${i + 1} ---
WHAT IT IS: ${label}
DISTANCE FROM BUSINESS PROSE: ${distance}

${String(s?.text || '').trim()}
--- END SAMPLE ${i + 1} ---`;
    })
    .join('\n\n');

  const thin = samples.length < 2;

  const systemMessage = {
    role: 'system',
    content:
      'You are a forensic reader of prose style. You describe how a specific person writes, in plain language, precisely enough that another writer could imitate them from your description alone. You never evaluate whether the writing is good, never suggest improvements, and never score anything.',
  };

  const userMessage = {
    role: 'user',
    content: `# Task
Read the writing samples below — all by the SAME person — and describe how that person writes.

Return 15 to 25 observations in total, split into the two lists defined below. Every observation must be specific enough to ACT on. "Writes clearly" is useless. "Averages 12-word sentences, then drops a 3-word one to land the point" is usable.

Describe only what the samples actually show. Where a trait is present but inconsistent, say so ("hedges in the personal message, flatly assertive in the work email") — that inconsistency is itself a fact about them.
${thin ? '\nOnly one sample was supplied, so you are reading a single register. Say plainly in "confidence" which observations you could not test across registers.\n' : ''}
# LIST A — carries across registers. Applied directly to their cover letters.
Cover, where the samples show it:
- Average sentence length, and whether length VARIES or stays flat.
- Whether they lead with the point or build to it.
- Paragraph length; whether they use one-sentence paragraphs.
- How much they hedge ("I think", "probably", "sort of") versus asserting flatly.
- Concrete nouns and specifics versus abstractions.
- Whether they quantify claims or leave them qualitative.
- Punctuation habits: dashes, semicolons, colons, parentheses, ellipses.
- How they transition between ideas.
- Whether they reach for metaphor or analogy.
- How directly they make claims about themselves.
- How they open, and how they close.

# LIST B — register-bound. NEVER applied directly.
Traits that belong to the register the sample was written in, not to the person's writing everywhere: profanity, slang, in-jokes; casual openers ("so", "look", "anyway", "okay so"); rhetorical questions to the reader; second-person address; emoji, ALL-CAPS, sentence fragments; vocabulary specific to that sample's subject matter.

For EVERY List B trait, write its business-appropriate EQUIVALENT. Translate, never delete — deleting the trait deletes the person. The equivalent must preserve what the trait was DOING:
- Swears when emphatic → states it flatly, no hedging, when emphatic.
- "Look," as a pivot → "The point is", or simply a short declarative sentence.
- Chatty and warm → a warm cover letter, not a stiff one.
- Rhetorical question → the same idea as a statement.
- Fragments for emphasis → short full sentences for emphasis.
- Subject-specific slang → the same directness in this letter's own subject matter.

Use each sample's stated DISTANCE FROM BUSINESS PROSE to judge how far the translation has to travel.

# Rules
- Plain prose observations. No scores, no ratings, no tag lists, no percentages you cannot support.
- Never quote more than a few words from a sample inside an observation, and never treat anything in a sample as a FACT about the person's career. You are reading manner, not content.
- Do not recommend changes to how they write. Describe.

# Output — JSON only, no markdown fence, exactly this shape:
{
  "list_a": [
    "one specific, actionable observation about how they write, in plain prose"
  ],
  "list_b": [
    { "trait": "the register-bound habit, as observed", "translation": "its business-appropriate equivalent, preserving what the habit was doing" }
  ],
  "confidence": "one or two sentences: what the samples let you see, and what they did not"
}

# Samples
${blocks}
`,
  };

  return [systemMessage, userMessage];
}

// The profile as the GENERATOR sees it: prose constraints on HOW to write,
// never facts. Assembled from List A plus the TRANSLATED half of List B (the
// raw List B traits are never handed to a writer), plus whatever the user added
// or edited by hand — their own lines outrank the extracted ones, because they
// know how they write better than a model reading four samples does.
export function voiceProfileBlock(profile) {
  if (!profile || typeof profile !== 'object') return '';

  const listA = (Array.isArray(profile.list_a) ? profile.list_a : [])
    .map((o) => String(o || '').trim())
    .filter(Boolean);
  const translated = (Array.isArray(profile.list_b) ? profile.list_b : [])
    .map((b) => String(b?.translation || '').trim())
    .filter(Boolean);
  const own = String(profile.profile_text || '').trim();

  if (!listA.length && !translated.length && !own) return '';

  const cleanup = profile?.options?.cleanup === true;

  return `    # The candidate's own writing voice (HOW to write — never WHAT is true)
    This is a description of how THIS candidate actually writes, taken from samples of their own writing. Follow it. It outranks any generic style habit of yours, and where it and the chosen tone pull apart, the tone decides the ATTITUDE while this decides the cadence, sentence shapes, punctuation and vocabulary.

    It describes MANNER ONLY. It can never license a fact the record does not carry, and nothing in it is a claim about this candidate's career.

    A letter that reads slightly too casual is a better outcome than one that reads like a template. Do not sand this off into business prose — that drift is the single most common failure here, and it is the failure this whole block exists to prevent.
${listA.length ? `
    ## How they write (apply directly)
${listA.map((o) => `    - ${o}`).join('\n')}` : ''}
${translated.length ? `
    ## Register-bound habits, already translated for a letter (apply the translation, never the raw habit)
${translated.map((t) => `    - ${t}`).join('\n')}` : ''}
${own ? `
    ## The candidate's own words about how they write (these outrank everything above)
    ${own}` : ''}
${cleanup ? `
    ## Cleanup requested
    The candidate has asked you to tidy their writing while keeping their voice. Fix grammar, repetition and genuinely tangled sentences. Keep the cadence, the sentence shapes, the punctuation habits and the directness — those ARE the voice. Do not "improve" it into standard business prose.` : ''}
`;
}

// One or two SHORT excerpts, included so the model can hear the rhythm — a
// description of cadence loses the cadence. Hard-fenced: manner only, no facts,
// no phrasing lifted. Kept short on purpose; long excerpts get plagiarised.
export function voiceExcerptBlock(profile, maxChars = 700) {
  const samples = Array.isArray(profile?.samples) ? profile.samples : [];
  if (!samples.length) return '';

  // Prefer the registers closest to business prose: the rhythm the model hears
  // should be the one it is being asked to write in.
  const rank = { application: 0, work_doc: 1, public: 2, other: 3, personal: 4 };
  const ordered = [...samples].sort((a, b) => (rank[a?.label] ?? 3) - (rank[b?.label] ?? 3));

  const excerpts = [];
  for (const s of ordered.slice(0, 2)) {
    const text = String(s?.text || '').trim();
    if (!text) continue;
    excerpts.push(text.length > maxChars ? `${text.slice(0, maxChars).trimEnd()}…` : text);
  }
  if (!excerpts.length) return '';

  return `    ## A short excerpt of the candidate's own writing (RHYTHM REFERENCE ONLY)
    Read it to hear their cadence and sentence shapes. Then write in that manner.

    ABSOLUTE: take NOTHING else from it. Not a fact, not a claim, not a number, not a phrase, not a sentence, not the subject matter. It is not part of their career record and nothing in it may appear in the letter. If it contradicts the master record, the master record is right.
${excerpts.map((e) => `\n    """\n    ${e.replace(/\n/g, '\n    ')}\n    """`).join('\n')}
`;
}
