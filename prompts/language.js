// prompts/language.js
//
// Output-language control for generated documents — the single source of truth
// shared by cv-generator.js and cover-letter.js (like tone.js and voice.js), so
// the CV and the cover letter can never disagree about what language to write in.
//
// Default is 'auto': the historic behaviour — write in the master CV's own
// language, and if the job ad is in another language the master CV still wins.
// That is right for most users but wrong for anyone applying across languages:
// an English master CV could never produce a Czech application.
//
// An explicit choice overrides it. The candidate's REAL facts never change with
// the language — names, employers and locations stay as they are; this governs
// the prose only, and never licenses inventing a language skill the record
// doesn't evidence.

export const GENERATION_LANGUAGES = {
  auto: 'Match the CV',
  en: 'English',
  cs: 'Čeština',
};

const NATIVE_INSTRUCTION = {
  en: 'Write the ENTIRE document in English. Native, professional, idiomatic English — never a translation-flavoured rendering of another language.',
  cs: 'Write the ENTIRE document in Czech (čeština). Native, professional, idiomatic Czech with correct declension — never a word-for-word translation from English. Use the Czech CV conventions a Czech recruiter expects.',
};

export function languageInstruction(language = 'auto') {
  const explicit = NATIVE_INSTRUCTION[language];
  if (!explicit) {
    // 'auto' (and any unknown value) → the original rule, unchanged.
    return "Output must match the master CV's detected language (fall back to English if unclear); if the job ad is in another language, the master CV's language wins.";
  }
  return `OUTPUT LANGUAGE (overrides any language signal in the master CV or the job ad): ${explicit} Proper nouns stay as they are — a person's name, employer names and place names are facts, not text to translate (you may add the local form of a city where that is the normal convention). Never claim or imply a level of this language the candidate's record does not evidence.`;
}
