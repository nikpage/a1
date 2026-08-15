// prompts/cover-letter.js
//
// THE WRITING PROMPT FOR THE COVER LETTER.
//
// This file was 165 lines of rules and produced a 51,721-character prompt of
// which ~33,000 characters were byte-identical for every user and every job. On
// 2026-08-15 it was measured against a four-line prompt Nik wrote himself — the
// master record, the ad, and "highlight the achievements that align with the
// requirements, professional tone, 250-400 words" — run on the same model,
// against the same record, for the same ads. The four-line prompt won every
// comparison, decisively, and did so while breaking three of the rules this
// file used to enforce.
//
// What the rules were costing, seen in the outputs:
//   - the letter opened on the candidate's most recent job instead of the
//     employer's mission, because a rule said "open on a fact the candidate did"
//   - it never answered what the ad said it did NOT want, because no rule
//     mentioned that an ad's negative space is where the employer states its
//     fear
//   - it reached for recent evidence over relevant evidence
//   - it wrote flowing prose where labelled themes would have shown the match
//     faster, because the shape was prescribed rather than chosen
//
// So the rules are gone and the purpose leads (CV_RULES.md, "What the cover
// letter IS"): the letter exists to make the reader decide to call this person.
// What remains here is Nik's prompt plus the four things that demonstrably earn
// their place — the candidate's VOICE, their STEERING, the output LANGUAGE, and
// the letter's furniture (salutation, date, signature, length). Truth is
// enforced downstream, where it belongs and where it works: the verify pass and
// utils/cv-validate.js, both of which ran clean over the minimal prompt's
// output.
//
// **Do not restore a rule here without a run that shows the letter is better
// with it.** That is the whole lesson of this file's history.

import { toneInstructions } from './tone.js';
import { languageInstruction } from './language.js';
import { currentDateBlock, currentDateReminder } from './current-date.js';
import { bannedPhraseLine } from './voice.js';
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

Highlight the key achievements and skills from the history that directly align with the core requirements, responsibilities and qualifications in the job description.

# What this letter is for
One job: the reader finishes it and decides to call this person for an interview. Nothing else. Every choice serves that — a letter that reads correctly and gives the reader no reason to pick up the phone has failed.

One thing is absolute, and it is the only one: **never invent, never inflate, never claim a duration, a number, a skill or a role the record does not state.** A letter that lies is worthless however well it reads. If the record does not evidence something the ad asks for, leave it unanswered — an unclaimed gap is honest, a papered-over one is a lie.

## What actually persuades
- **Answer what the ad says it does NOT want.** Ads state their fear in the negative — "not someone who cold-calls all day", "not just a coordinator". That sentence tells you what worries them about the people who will apply. Find it and answer it with a real fact: an achievement reframed against their fear is the most persuasive sentence you can write.
- **Open on THEIR problem, not this candidate's latest job.** The reader cares about what they are building. A letter that opens on the applicant's most recent role reads as a self-description that happened to be posted to them.
- **Relevance beats recency, every time.** The right evidence is whatever answers THIS ad, whether it happened last month or nine years ago. Reaching back for the right proof is the difference between a tailored letter and a career update.
- **Let the ad set the shape.** Where the ad lists several distinct things it wants, answering them under short labelled themes is clearer than prose and entirely permitted. Flowing paragraphs are a default, not a requirement. Choose whatever makes the reader see the match fastest.
- **Prove, never assert.** "Excellent communicator" is worth nothing; the workshop, the audience and what changed is worth everything.
${bannedPhraseLine(language)}
- **Never state a span of experience the record does not state.** No "14 years of AI solution design", no "a decade in fintech". Durations are facts: the only ones that exist are those written in the record's own dates. A multiple computed from two real figures is fine where the record's own bounds make it a floor ("under $20k to over $100k" IS more than fivefold); a duration nobody wrote down is not.
${steeringBlock}${voiceOwnership}${coreBlock}
${adBlock(analysis)}

# The letter's furniture
${currentDateBlock(now)}
${coverLengthRule(analysis)}
- ${languageInstruction(language)}
${salutationRule(analysis, language)}
- Start with the date on its own line at the top. Do NOT put the candidate's name or contact details above the salutation.
- End with a signature block in exactly this form, using the record's own \`identity\` / \`contact\` data:
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
