// prompts/cover-letter.js
//
// THE WRITING PROMPT FOR THE COVER LETTER. IT IS SHORT ON PURPOSE.
//
// Twice now this file has grown a list of rules describing good writing, and
// twice the letter came back PERFORMING the rules instead of persuading. The
// 51,721-character rule stack (removed 2026-08-15) lost to a four-line prompt
// Nik wrote himself. The three "what actually persuades" bullets added on
// 2026-08-19 — open on their problem, one sentence of seven words or fewer, no
// stock close — produced the Sudolabs letter: an opening that read the ad back
// to its author, "I manage outcomes, not people." as an orphan paragraph, and
// no close at all. Each rule was obeyed. The letter was worse.
//
// So the prompt is the four things that are actually inputs, and nothing else:
//   1. the candidate's career record (the master CV)
//   2. the job ad, verbatim, in the employer's own words
//   3. the candidate's VOICE — their profile and their own writing
//   4. their steering, the output language, and the letter's furniture
//
// Truth is enforced DOWNSTREAM, where it works: the verify pass and
// utils/cv-validate.js. Stock phrasing is caught by the banned-phrase list and
// repaired over its own spans. Shape is MEASURED but never fed back to the
// writer — a rhythm target handed to a model becomes a rhythm target hit.
//
// **Do not add a rule here.** Not a persuasion tip, not a shape target, not a
// negative example. If a letter comes back bad, the fix is better INPUT — a
// richer record, the real ad, a real voice profile — or a downstream check.
// This file's entire history says so.

import { toneInstructions } from './tone.js';
import { languageInstruction } from './language.js';
import { bannedPhraseLine } from './voice.js';
import { currentDateBlock, currentDateReminder } from './current-date.js';
import { targetJobBlock, rawAdBlock } from './job-target.js';
import { salutationName } from './cover-evidence.js';
import { coverLengthRule } from './market.js';
import { voiceProfileBlock, voiceExcerptBlock } from './voice-profile.js';

// The ad, in the employer's own words where the record kept them. The
// extraction is the fallback for analyses saved before job_text existed and for
// standalone reviews with no ad at all.
function adBlock(analysis) {
  return rawAdBlock(analysis) || targetJobBlock(analysis);
}

// How the letter opens its address. A name only where the ad genuinely gave
// one — salutationName() refuses anything that does not look like a person, so
// "Dear Chief Happiness," cannot happen. Czech and Polish decline it.
function salutationRule(analysis, language) {
  const name = salutationName(analysis);
  if (!name) {
    return `- Address it neutrally: "Dear Hiring Team" in English, "Vážená paní, vážený pane," in Czech, "Szanowni Państwo," in Polish. The ad named nobody, so NEVER guess, infer or invent a name.`;
  }
  return `- The ad names its contact: address the letter to ${name}. Using the name the ad printed is the first evidence this letter was written for THIS application.
- **Decline the name into the letter's own language.** English takes it as it stands ("Dear ${name}"). Czech takes the VOCATIVE and so does Polish: "Vážený pane Nováku," for Novák, "Vážená paní Nováková,", "Vážený pane Petře," for Petr, "Szanowny Panie Kowalski,". A nominative name in that slot is a grammatical error in the letter's first line. Where the gender or the declension is genuinely unclear, use the neutral form for that language rather than guessing an ending. "pane"/"paní" and "Panie"/"Pani" are part of the salutation, not titles.`;
}

export function buildCoverPrompt(cv, analysis, tone, tweak = '', core = '', language = 'auto', now = new Date(), voiceProfile = null) {
  const voiceBlock = voiceProfileBlock(voiceProfile);
  const excerptBlock = voiceProfile ? voiceExcerptBlock(voiceProfile) : '';

  // The candidate's own instructions. They outrank everything: the letter is
  // theirs. The one thing steering can never do is add a fact.
  const steeringBlock = tweak && tweak.trim()
    ? `
# The candidate's own instructions for this letter (HIGHEST PRIORITY)
"${tweak.trim()}"

What they asked you to foreground LEADS the letter and is proved with a real fact from the record. What they asked you to play down stays out of the opening entirely — it may still appear once, late and plainly, but it is never the hook, the lead, or the proof you offer. Steering never adds a fact: where they ask you to emphasise something the record does not evidence, foreground the closest thing it DOES evidence and say no more.
`
    : '';

  // The job-agnostic statement of who this candidate is, where they wrote one.
  const coreBlock = core && core.trim()
    ? `\n# How the candidate describes their own durable value\n"${core.trim()}"\nLet it guide what you foreground — never state anything the record does not prove.\n`
    : '';

  const voiceOwnership = voiceBlock
    ? `
# YOU ARE WRITING AS THIS CANDIDATE, IN THEIR VOICE
Their voice is described below and their own writing is quoted after it. Read both before writing a word, and write the whole letter that way from the first sentence. Voice is SHAPE before it is vocabulary: the spread of sentence lengths, how short the shortest sentence gets, how long a paragraph runs, whether the point lands first or last. Uniform sentences in uniform paragraphs are what reads as machine-written, and no word choice fixes that.

The TONE they chose for this letter is "${tone}" — ${toneInstructions(tone)} Their voice is fixed and theirs; the tone is the mood they picked for this one letter. Write the mood they asked for, in their sentence shapes.
${voiceBlock}${excerptBlock}`
    : `
# Tone
Write in a "${tone}" tone. ${toneInstructions(tone)}
Write like a person, not a template: vary the sentence lengths deliberately, go genuinely short at least once, and let the paragraphs differ in weight.`;

  const systemMessage = {
    role: 'system',
    content: voiceBlock
      ? 'You write a cover letter as the candidate themselves, in their own voice, from a description of how they write and samples of their actual writing. Every fact comes from their record and nothing is invented. You return the finished letter only.'
      : 'You write cover letters that get people interviews. Every fact comes from the candidate\'s record and nothing is invented. You return the finished letter only.'
  };

  const userMessage = {
    role: 'user',
    content: `Write a tailored cover letter using the job history and job description below.

Highlight the achievements and skills from the record that align with what this job asks for. Lead with what the candidate actually did and what came of it — a result, a number, a change, wherever the record has one.

Never invent, never inflate, never claim a duration, a number, a skill or a role the record does not state. Where the record cannot answer something the ad asks for, leave it unanswered.
${bannedPhraseLine(language)}
${steeringBlock}${voiceOwnership}${coreBlock}
${adBlock(analysis)}

# The letter's furniture
${currentDateBlock(now)}
${coverLengthRule(analysis)}
- ${languageInstruction(language)}
${salutationRule(analysis, language)}
- Start with the date on its own line at the top. Do NOT put the candidate's name or contact details above the salutation.
- End with a signature block in exactly this form, using the record's own \`identity\` / \`contact\` data. The sign-off is written in the LETTER'S OWN LANGUAGE — "Sincerely," in English, "S pozdravem," in Czech, "Z poważaniem," in Polish; an English sign-off under a Czech letter is the plainest possible sign that a machine filled in a template:
Sincerely,

**[Full Name]**
[Telephone]
[Email]
[LinkedIn URL]
- No placeholders of any kind — no "[Company Address]", no bracketed instructions, nothing for the candidate to fill in.

# Job History
${currentDateReminder(now)}
A \`voice_guide\` in this record, where one exists, is the candidate's OWN written style guide: follow it over any style habit of yours. Like \`voice_samples\` it describes HOW to write, never WHAT is true — neither can license a fact the record does not carry.

${cv}

# Job Description
${adBlock(analysis) ? 'Given above.' : '(No job ad — write from the record\'s strongest evidenced work.)'}

Return only the letter: the date, the salutation, the body, the signature block.`
  };

  return [systemMessage, userMessage];
}
