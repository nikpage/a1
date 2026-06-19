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
    case 'confident':
      return "Assertive and self-assured. Lead with strong action verbs and the outcome ('Drove', 'Owned', 'Delivered', 'Scaled'). Own every achievement directly without hedging or qualifiers. Proud, decisive — but never arrogant.";
    case 'cocky':
      return "Bold, punchy and memorable — this candidate knows they're good and isn't shy about it. Short, high-energy sentences. The occasional swagger phrase ('shit-hot', 'kick-ass', 'rock star', 'BOOM') is allowed where it genuinely lands, but keep it a light sprinkle, not every line. Hard rule: every brag must be backed by a real fact from the CV. Aim for wit and swagger, never cringe.";
    default:
      return "Professional and polished: clear, results-first, no filler.";
  }
}
