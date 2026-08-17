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
export const BANNED_PHRASES = {
  en: [
    // Filler that states nothing.
    'results-driven', 'results driven', 'proven track record', 'passionate about',
    'best-in-class', 'best in class', 'value-add', 'value add', 'synergy', 'synergies',
    "in today's fast-paced world", 'fast-paced world', 'dynamic environment',
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
    // Seen in real letters: the sentence whose job is to admire the employer,
    // and the constructions that carry no fact.
    'aligns directly with', 'aligns perfectly with', 'aligns with your mission',
    'resonates with', 'positions me to', 'this ensures',
    'i am confident that i can', 'i believe i can bring',
  ],
  // Czech tells are their OWN set, not these translated: "results-driven" has no
  // Czech equivalent anyone writes, while "v neposlední řadě" has no English one.
  // Seeded with the obvious ones and grown from real Czech output.
  cs: [
    'v dnešní dynamické době', 'v dnešní době', 'dynamické prostředí',
    'proaktivní přístup', 'komplexní řešení', 'široké spektrum', 'široká škála',
    'týmový hráč', 'klíčový hráč', 'v neposlední řadě', 'na denní bázi',
    'bohaté zkušenosti', 'silné komunikační dovednosti', 'orientace na výsledek',
    's nadšením se ucházím', 'dovoluji si ucházet se o pozici',
    'věřím, že jsem vhodným kandidátem', 'jak je patrné z mého životopisu',
    'v případě zájmu mě neváhejte kontaktovat',
    'předem děkuji za váš čas', 'těším se na vaši odpověď',
  ],
  pl: [
    'w dzisiejszych dynamicznych czasach', 'dynamiczne środowisko',
    'proaktywne podejście', 'kompleksowe rozwiązania', 'szeroki wachlarz',
    'gracz zespołowy', 'nastawienie na wynik', 'bogate doświadczenie',
    'silne umiejętności komunikacyjne', 'na co dzień',
    'z entuzjazmem aplikuję', 'zwracam się z prośbą o rozpatrzenie mojej kandydatury',
    'wierzę, że jestem odpowiednim kandydatem', 'jak wynika z mojego CV',
    'w razie pytań proszę o kontakt', 'z góry dziękuję za poświęcony czas',
  ],
};

// IDENTITY EPITHETS AND TRAIT CLAIMS — per language, on the same footing as the
// banned phrases, and for the same reason: a Czech CV headline is not judged by
// translating an English list. This is the ONE registry; `utils/cv-validate.js`
// check 12 imports it rather than keeping a second copy, which is how the
// English list drifted into two files and then did nothing at all in Czech.
//
// A trait claim is the same defect as a noun epithet: a category asserted about
// the candidate in place of something they did. "High-agency Senior Product
// Manager" reached the top line of a delivered CV because the list held nouns
// only. Closed and exact — it grows by adding a term actually seen in output.
//
// Stock filler already in BANNED_PHRASES is deliberately absent here
// ("results-driven", "orientace na výsledek"): that list repairs the span in
// place rather than regenerating the document. One defect, one owner.
const EPITHETS = {
  en: [
    'veteran', 'seasoned', 'accomplished', 'industry expert', 'technology leader',
    'thought leader', 'world-class', 'renowned', 'distinguished',
    'high-agency', 'self-starter', 'highly motivated', 'hands-on leader',
    'visionary', 'battle-tested', 'proven leader', 'strategic thinker',
  ],
  // cs and pl are DELIBERATELY EMPTY, not forgotten. Every English entry above
  // was seen in real output; not one Czech or Polish epithet has been. Seeding
  // them by translating the English list is exactly what the banned-phrase
  // registry refuses to do, and a guessed list is worse than none: it blocks
  // wording no Czech writer would flag while missing whatever they actually
  // write. Add an entry the first time a Czech or Polish run produces one.
  cs: [],
  pl: [],
};

// Same resolution rule as bannedPhrases: 'auto' applies every registered list,
// because the document is in one of them and the writer picked which.
export function identityEpithets(language = 'auto') {
  const key = String(language || 'auto').toLowerCase();
  if (key === 'auto' || !key) return Object.values(EPITHETS).flat();
  return EPITHETS[key] || [];
}

// The phrases that apply to a document in this language. On 'auto' the writer
// resolves the language from the master CV, so every registered list applies —
// the document is in one of them, and an English cliché in a Czech CV is its own
// defect. An unregistered language gets nothing rather than being judged on
// English assumptions, exactly as the bullet band is.
export function bannedPhrases(language = 'auto') {
  const key = String(language || 'auto').toLowerCase();
  if (key === 'auto' || !key) return Object.values(BANNED_PHRASES).flat();
  return BANNED_PHRASES[key] || [];
}

// Rendered into both prompts, so the writer is told exactly what the checker
// will look for rather than a vague instruction to avoid clichés.
export function bannedPhraseLine(language) {
  const list = bannedPhrases(language);
  if (!list.length) return '';
  return `- BANNED PHRASES (exact list, checked in code after generation and repaired before the candidate sees the document): ${list.map((p) => `"${p}"`).join(', ')}. Do not write any of them, in any capitalisation, in either document. They state nothing, and they are the phrases that mark a page as machine-written on sight. Say the specific thing instead.`;
}

export function humanVoiceRules(language = 'auto') {
  return `
HUMAN VOICE (applies in every tone — the goal is output indistinguishable from a top-tier human writer):
- Vary the rhythm. Do NOT make every sentence or bullet the same length — that uniform 1.5–2 line cadence is the clearest tell of machine writing. Deliberately mix short, punchy lines with longer, detailed ones. Vary how sentences open; never start two or three in a row the same way.
- Break dense, multi-clause sentences into shorter ones. Avoid the rigid "Having spent X doing Y... I am applying... To bring this combined A and B..." construction — that exact template reads as AI-generated.
- Strong, specific action verbs are GOOD CV writing — keep using them (led, drove, built, launched, scaled, spearheaded, won, cut, grew). Two real problems to avoid: (a) empty filler that states nothing — "results-driven", "proven track record", "passionate about", "dynamic", "synergy", "best-in-class", "seamless", "robust", "value-add", "in today's fast-paced world" — cut these entirely; (b) leaning on the SAME few resume verbs over and over (e.g. "spearheaded" / "leveraged" three times in one document) — vary your verbs and back every one with a real, specific result. None of this overrides the active tone's deliberate vocabulary.
- Name facts, not identities. Never describe the candidate as a CATEGORY or assert a TRAIT about them — ${identityEpithets(language).map((e) => `"${e}"`).join(', ')} and their equivalents are banned in both documents. They assert standing instead of evidence, they are the first phrase a template reaches for, and on a long career "veteran" broadcasts age in the exact spot the CV is managing it. Say what the person DID: "rebuilt how Acme ships" beats "a veteran delivery leader" every time. This is not a tone question — no tone, including cocky, licenses an empty label.
- Let transitions grow out of the candidate's real story instead of snapping mechanically from one topic to the next (e.g. don't bolt a language-requirement sentence onto an unrelated paragraph).
${bannedPhraseLine(language)}
- Stay internally consistent and truthful: never state or imply a skill or language level that contradicts the source CV (if the CV marks a language as limited, do not imply fluency). The CV and cover letter must agree with each other and with the source facts — improve the framing, never the facts.
`.trim();
}
