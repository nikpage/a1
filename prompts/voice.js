// prompts/voice.js
//
// Shared "human voice" guidance for CV and cover-letter generation.
// tone.js sets the REGISTER (formal / friendly / enthusiastic / cocky); these
// rules make any tone read like a sharp human wrote it rather than an LLM.
// They never change facts, and they never override the active tone's intentional
// vocabulary — where this guidance and the chosen tone conflict, the tone wins.
// Imported by cv-generator.js and cover-letter.js so the rules live in one place.

// The BANNED PHRASING list (CV_RULES.md, Layer 2). One closed, exact list, held
// here because this module already owns the voice rules — and imported by
// utils/cv-validate.js so the prompt that forbids these phrases and the check
// that catches them can never drift apart. Closed and literal on purpose: it
// grows by adding a phrase actually seen in output, never by inferring a family
// from one member, so it cannot fire on a real achievement.
//
// Grouped only for readability; the checker treats them as one list.
export const BANNED_PHRASES = [
  // Filler that states nothing.
  'results-driven', 'results driven', 'proven track record', 'passionate about',
  'best-in-class', 'best in class', 'value-add', 'value add', 'synergy', 'synergies',
  'in today\'s fast-paced world', 'fast-paced world', 'dynamic environment',
  'seamless', 'seamlessly', 'robust solutions', 'cutting-edge solutions',
  'wide range of', 'wealth of experience', 'track record of success',
  // Cover-letter boilerplate — the wrapper a template reaches for first.
  'i am writing to express', 'i am writing to apply', 'i would like to express',
  'i believe i would be a great fit', 'i believe i am the ideal candidate',
  'as you can see from my cv', 'as you can see from my resume',
  'i am excited about the opportunity', 'i am thrilled at the prospect',
  'please do not hesitate to contact me', 'thank you for your time and consideration',
  'i look forward to hearing from you at your earliest convenience',
  // Manufactured significance.
  'delve into', 'underscore', 'underscores', 'underscoring',
  'leverage my expertise', 'leveraging my expertise', 'paradigm shift',
  'a testament to', 'testament to my', 'navigate the complexities',
  'in the ever-evolving', 'ever-evolving landscape', 'digital landscape',
];

// Rendered into both prompts, so the writer is told exactly what the checker
// will look for rather than a vague instruction to avoid clichés.
function bannedPhraseLine() {
  return `- BANNED PHRASES (exact list, checked in code after generation — a hit is reported to the candidate): ${BANNED_PHRASES.map((p) => `"${p}"`).join(', ')}. Do not write any of them, in any capitalisation, in either document. They state nothing, and they are the phrases that mark a page as machine-written on sight. Say the specific thing instead.`;
}

export function humanVoiceRules() {
  return `
HUMAN VOICE (applies in every tone — the goal is output indistinguishable from a top-tier human writer):
- Vary the rhythm. Do NOT make every sentence or bullet the same length — that uniform 1.5–2 line cadence is the clearest tell of machine writing. Deliberately mix short, punchy lines with longer, detailed ones. Vary how sentences open; never start two or three in a row the same way.
- Break dense, multi-clause sentences into shorter ones. Avoid the rigid "Having spent X doing Y... I am applying... To bring this combined A and B..." construction — that exact template reads as AI-generated.
- Strong, specific action verbs are GOOD CV writing — keep using them (led, drove, built, launched, scaled, spearheaded, won, cut, grew). Two real problems to avoid: (a) empty filler that states nothing — "results-driven", "proven track record", "passionate about", "dynamic", "synergy", "best-in-class", "seamless", "robust", "value-add", "in today's fast-paced world" — cut these entirely; (b) leaning on the SAME few resume verbs over and over (e.g. "spearheaded" / "leveraged" three times in one document) — vary your verbs and back every one with a real, specific result. None of this overrides the active tone's deliberate vocabulary.
- Name facts, not identities. Never describe the candidate as a CATEGORY — "veteran", "seasoned", "accomplished", "industry expert", "technology leader", "thought leader", "world-class", "renowned", "distinguished" and their equivalents are banned in both documents. They assert standing instead of evidence, they are the first phrase a template reaches for, and on a long career "veteran" broadcasts age in the exact spot the CV is managing it. Say what the person DID: "rebuilt how Acme ships" beats "a veteran delivery leader" every time. This is not a tone question — no tone, including cocky, licenses an empty label.
- Let transitions grow out of the candidate's real story instead of snapping mechanically from one topic to the next (e.g. don't bolt a language-requirement sentence onto an unrelated paragraph).
${bannedPhraseLine()}
- Stay internally consistent and truthful: never state or imply a skill or language level that contradicts the source CV (if the CV marks a language as limited, do not imply fluency). The CV and cover letter must agree with each other and with the source facts — improve the framing, never the facts.
`.trim();
}
