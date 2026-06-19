// prompts/tone.js
//
// Shared tone guidance for CV and cover-letter generation.
// Tone shapes the VOICE and word choice of the writing — it never changes the facts.
// Imported by cv-generator.js and cover-letter.js so the tone definitions live in one place.

export function toneInstructions(tone) {
  switch ((tone || '').toLowerCase()) {
    case 'formal':
      return "Professional and reserved — the safe default most candidates should ship. Precise, businesslike language; no slang, no exclamation marks. State results plainly and let them speak for themselves.";
    case 'friendly':
      return "Warm and approachable while staying fully professional. Use plain, human phrasing over corporate jargon. Confident and positive, never boastful — the reader should feel they'd enjoy working with this person.";
    case 'enthusiastic':
      return "Energetic and positive — genuine excitement about the work and the role. Upbeat, momentum-driven phrasing and strong positive verbs ('Drove', 'Delivered', 'Championed', 'Scaled'), while staying professional. Let passion show without tipping into hype.";
    case 'cocky':
      return "MAXIMUM SWAGGER — this is the whole point of this tone, do not water it down. This candidate is shit-hot and knows it: write like they're the best hire the reader will see all year and faintly amused that anyone needs convincing. Short, punchy, cocky lines that land like a mic drop. Lead with a bold claim, then slam down the real number that proves it. Use the swagger vocabulary OUT LOUD and often — 'shit-hot', 'kick-ass', 'rock star', 'crushed it', 'BOOM', 'no contest' — this is the actual voice, not a rare garnish. Yes, use mild profanity like 'shit-hot' verbatim when it fits; it's intentional brand voice, not a mistake to sanitize. Kill all corporate hedging: never 'helped', 'contributed to', 'responsible for', 'assisted with'. The ONLY limit: every brag is backed by a true fact from the CV — cocky as hell, never fabricated.";
    default:
      return "Professional and polished: clear, results-first, no filler.";
  }
}
