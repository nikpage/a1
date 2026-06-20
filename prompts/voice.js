// prompts/voice.js
//
// Shared "human voice" guidance for CV and cover-letter generation.
// tone.js sets the REGISTER (formal / friendly / enthusiastic / cocky); these
// rules make any tone read like a sharp human wrote it rather than an LLM.
// They never change facts, and they never override the active tone's intentional
// vocabulary — where this guidance and the chosen tone conflict, the tone wins.
// Imported by cv-generator.js and cover-letter.js so the rules live in one place.

export function humanVoiceRules() {
  return `
HUMAN VOICE (applies in every tone — the goal is output indistinguishable from a top-tier human writer):
- Vary the rhythm. Do NOT make every sentence or bullet the same length — that uniform 1.5–2 line cadence is the clearest tell of machine writing. Deliberately mix short, punchy lines with longer, detailed ones. Vary how sentences open; never start two or three in a row the same way.
- Break dense, multi-clause sentences into shorter ones. Avoid the rigid "Having spent X doing Y... I am applying... To bring this combined A and B..." construction — that exact template reads as AI-generated.
- Strong, specific action verbs are GOOD CV writing — keep using them (led, drove, built, launched, scaled, spearheaded, won, cut, grew). Two real problems to avoid: (a) empty filler that states nothing — "results-driven", "proven track record", "passionate about", "dynamic", "synergy", "best-in-class", "seamless", "robust", "value-add", "in today's fast-paced world" — cut these entirely; (b) leaning on the SAME few resume verbs over and over (e.g. "spearheaded" / "leveraged" three times in one document) — vary your verbs and back every one with a real, specific result. None of this overrides the active tone's deliberate vocabulary.
- Let transitions grow out of the candidate's real story instead of snapping mechanically from one topic to the next (e.g. don't bolt a language-requirement sentence onto an unrelated paragraph).
- Stay internally consistent and truthful: never state or imply a skill or language level that contradicts the source CV (if the CV marks a language as limited, do not imply fluency). The CV and cover letter must agree with each other and with the source facts — improve the framing, never the facts.
`.trim();
}
