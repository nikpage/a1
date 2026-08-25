// prompts/letter-pick.js
//
// THE ONLY AI CALL THE LETTER MAKES.
//
// It does not write the letter. It reads the ad and returns which of the
// candidate's own paragraphs (prompts/letter-library.js) answer it, plus — only
// where none of their openings fits — the opening stance, which is the single
// piece of generated prose in the finished document.
//
// Owner decision, 2026-08-25: five weeks of levers aimed at making a model write
// at his standard (rule stack, minimal prompt, plan pass, hand-written exemplars
// as register targets) produced accurate letters that still read as a machine's.
// So the model stops writing and starts choosing. COVER_LETTER_LOG.md holds the
// runs.
//
// This module is shared by utils/openai.js (the app) and scripts/assemble-cover.mjs
// (the harness) so there is ONE prompt, not two that drift.

import { rawAdBlock, targetJobBlock } from './job-target.js';
import { libraryIndex } from './letter-library.js';

const str = (v) => (typeof v === 'string' ? v.trim() : '');

// The ad in the employer's own words where the record kept them; the extraction
// is the fallback for analyses saved before job_text existed.
const adFor = (analysis, job) => str(job) || rawAdBlock(analysis) || targetJobBlock(analysis);

export function buildLetterPickPrompt({ analysis = null, job = '', master = '', tweak = '' } = {}) {
  // Steering reaches the PICKER, which is where it belongs now: emphasise and
  // play-down are statements about which of his stories should carry the letter,
  // and a picker can act on that far more directly than a writer ever did.
  const steering = str(tweak)
    ? `\n# The candidate's own instructions for this application (HIGHEST PRIORITY)\n"${str(tweak)}"\nWhat they asked you to foreground decides the FIRST instance if any of his paragraphs proves it. What they asked you to play down is not picked at all unless nothing else answers the ad. Steering never adds a fact and never licenses a claim in the opening.\n`
    : '';

  return [
    {
      role: 'system',
      content:
        'You choose which of a candidate\'s own written paragraphs go into their application letter. He wrote all of them himself. You never rewrite them, never summarise them, and never write new ones. You return JSON only.'
    },
    {
      role: 'user',
      content: `Choose the paragraphs for this candidate's application letter for the job below.

Return ONE JSON object and nothing else, in this exact shape:

{
  "contact_name": "the person the ad names as the contact, as printed, or \\"\\" if it names nobody",
  "opening": "an opening id from the list, or \\"custom\\"",
  "opening_text": "only if opening is \\"custom\\": two to four sentences, otherwise \\"\\"",
  "instances": ["id", "id"],
  "day_to_day": "id",
  "close": "id",
  "language_line": true or false
}

How to choose:

- "instances": TWO, and the order is the order they will be printed. Pick the two whose evidence this employer plainly cares about most. The first answers the ad's central ask.
- "opening": use one of his if it genuinely fits this ad. Choose "custom" only when neither does — typically when what this company builds is itself the reason he is writing.
  A custom opening is two to four sentences, first person, plain spoken words, contractions welcome. It says what this company is actually doing and why that is the problem he cares about, and it leads into the first instance. This is the one he wrote himself for a crypto company, and it is the register to match:
    "Invity caught my eye because you are actually fixing Bitcoin's usability problem rather than just talking about it. Turning crypto into a simple, automated habit for everyday people is the exact product challenge I care about."
  NEVER open by summarising his career. "I've spent years leading product strategy and user experience across fintech and blockchain projects" is the sentence a machine writes and it is banned in every form: no "years of", no "extensive experience", no list of the fields he has worked in, no "proven". Never grade the employer's market back to them and never write a slogan. Every fact in it comes from the record below.
- "day_to_day" and "close": one each, whichever fits the role.
- "language_line": true only if the employer is Czech or Slovak and the ad is in English.
- "contact_name": only a real person's name printed in the ad. Never a job title, never an email address, never a guess.
${steering}
${libraryIndex()}

His record — the only source of fact for a custom opening:

${master}

The job ad:

${adFor(analysis, job)}`
    }
  ];
}
