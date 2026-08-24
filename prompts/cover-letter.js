// prompts/cover-letter.js
//
// THE COVER LETTER'S PROMPT. ONE FILE, READ IT TOP TO BOTTOM.
//
// History, so it is not repeated: this prompt has twice been a rule stack
// (51,721 characters at its peak, removed 2026-08-15) and twice the letter came
// back performing the rules instead of persuading. The reaction was to strip it
// to four lines and compose everything else from eight other prompt modules —
// which produced a 19,041-character prompt that nobody, human or model, could
// read as a single document. On 2026-08-20 Nik read four consecutive letters off
// that path and called them the blandest AI writing he had seen. He was right:
// they answered nothing the ad asked.
//
// The diagnosis was not a missing rule. The writer was handed the ad and the
// record and NOTHING THAT CONNECTS THEM, so it wrote about the field in general.
// So this file now states, in one place and in order:
//
//   1. the job, in the employer's own words
//   2. WHAT THAT AD SAYS IT NEEDS, as a list the letter must work through
//   3. the candidate's record — the only source of fact
//   4. their voice, their steering, the language, the furniture
//
// The register is not set by a tone blurb any more. "Professional and reserved,
// businesslike" was the one instruction in the old prompt that literally asked
// for the prose Nik rejected, and with a voice profile present it fought the
// voice block sitting directly beneath it.
//
// Truth is enforced DOWNSTREAM where it demonstrably works — verifyGeneratedDoc
// and utils/cv-validate.js. Banned phrasing is caught in code after generation
// and repaired over its own spans, so the 2,000-word ban list is no longer read
// to the writer before it starts: a wall of "never write this" produces cautious,
// generic prose, which is the exact failure it was meant to prevent.
//
// Before changing anything here, run it: scripts/test-generate.mjs against a
// real record and a real ad, and read the letter. Then log it in
// COVER_LETTER_LOG.md. A change that was reasoned about and not run is not a
// change, it is a guess.

import { languageInstruction } from './language.js';
import { currentDateBlock, currentDateReminder } from './current-date.js';
import { targetJobBlock, rawAdBlock } from './job-target.js';
import { salutationName, coverEvidenceBlock } from './cover-evidence.js';
import { letterPlanBlock } from './letter-plan.js';
import { letterExemplarBlock } from './letter-exemplar.js';
import { coverLengthRule } from './market.js';
import { voiceProfileBlock, voiceExcerptBlock } from './voice-profile.js';

// The ad, in the employer's own words where the record kept them. The
// extraction is the fallback for analyses saved before job_text existed and for
// standalone reviews with no ad at all.
function adBlock(analysis) {
  return rawAdBlock(analysis) || targetJobBlock(analysis);
}

// WHAT THE AD SAYS IT NEEDS — the block whose absence caused the 2026-08-20
// letters. The extraction is already on the analysis record (job_extraction,
// written by the analysis worker), so this costs no AI call. It is the ad's own
// asks, listed, so the writer has something specific to answer instead of a
// 4,000-character ad to free-associate over.
//
// It lists the ASKS ONLY. It never pairs them with evidence and never orders
// them: which asks the letter answers, in what order, and what proves each is
// the writer's decision, made with the record, the steering and the voice all
// in hand (CV_RULES.md, Layer 3 — the letter is composed, not executed).
function asksBlock(analysis, hasPlan = false) {
  const job = analysis?.job_extraction || {};
  const asks = [
    ...(job.must_have_requirements || []),
    ...(job.required_skills || []),
    ...(job.responsibilities || []),
    ...(job.language_requirements || []),
    ...(job.nice_to_have || []),
    ...(job.desired_skills || [])
  ]
    .map((a) => (typeof a === 'string' ? a.trim() : ''))
    .filter(Boolean);

  if (!asks.length) return '';

  const seen = new Set();
  const lines = asks
    .filter((a) => {
      const k = a.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((a) => `- ${a}`)
    .join('\n');

  return `
# What this employer says it needs
${lines}

${hasPlan
  ? `That list is CONTEXT, not a menu. Which of it the letter answers is already decided in THE PLAN below, and the plan wins: do not add a point because you see it listed here.`
  : `That list is for CHOOSING, not for covering. Work through it before you write, ask what in the record actually answers each, and then pick the TWO OR THREE this employer plainly cares about most and that the record answers best. Those are the letter.

Prove each one with a specific piece of work: what the candidate did, where, and what came of it — the number, the change, the outcome, wherever the record holds one. One proved claim beats six asserted ones, and a letter that touches every item on that list proves nothing about any of them. Leave the rest out entirely.`}

The rest of the list is not your problem. Where the record does not answer an ask, say nothing about it at all — no hedge, no adjacent skill, no borrowing the employer's own wording to cover the hole. An unanswered ask is honest; a papered-over one is a lie the interview will find.

If the ad asks the applicant for something directly — why this role, why this company, a few words about anything — answer it plainly and in your own terms. Do not answer it with praise of the company.
`;
}

// THE OBJECTION is no longer built here. coverEvidenceBlock() (prompts/cover-evidence.js)
// renders the analysis's paired concerns AND the full red_flags list under one
// heading, so the writer sees the flag and the fact that settles it together.
// Two blocks listing the same flags was the duplication this replaced.

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

export function buildCoverPrompt(cv, analysis, tone, tweak = '', core = '', language = 'auto', now = new Date(), voiceProfile = null, plan = null) {
  // The plan (prompts/letter-plan.js) decides the letter's SHAPE — order, the one
  // instance per point, what the first and last sentence must do. Absent, the
  // writer chooses as it did before; present, it executes.
  const planBlock = letterPlanBlock(plan);
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

  // The register. With a voice profile it is theirs; without one it is still a
  // person's, not a template's. Neither branch asks for "reserved" or
  // "businesslike" prose — that instruction produced the letters this file's
  // header describes.
  const voiceOwnership = voiceBlock
    ? `
# YOU ARE WRITING AS THIS CANDIDATE, IN THEIR VOICE
Their voice is described below and their own writing is quoted after it. Read both before writing a word, and write the whole letter that way from the first sentence. Voice is SHAPE before it is vocabulary: the spread of sentence lengths, how short the shortest sentence gets, how long a paragraph runs, whether the point lands first or last. Uniform sentences in uniform paragraphs are what reads as machine-written, and no word choice fixes that.

This is a job application, so it stays professional: no slang, no exclamation marks, nothing that would embarrass the candidate in front of a hiring manager. That is the ONLY limit on the voice below. It is not an instruction to write even, reserved, businesslike prose — sanding their voice into that is the failure this block exists to prevent, and a letter that reads slightly too direct beats one that reads like a template.
${voiceBlock}${excerptBlock}`
    : `
# Write like a person, not a template
Vary the sentence lengths deliberately, go genuinely short at least once, and let the paragraphs differ in weight. It stays professional — no slang, no exclamation marks — but even, uniform business prose is what marks a letter as machine-written, and no word choice fixes that.`;

  const systemMessage = {
    role: 'system',
    content: voiceBlock
      ? 'You write a cover letter as the candidate themselves, in their own voice, from a description of how they write and samples of their actual writing. Every fact comes from their record and nothing is invented. You return the finished letter only.'
      : 'You write cover letters that get people interviews. Every fact comes from the candidate\'s record and nothing is invented. You return the finished letter only.'
  };

  const userMessage = {
    role: 'user',
    content: `Write this candidate's application letter for the job below.

The letter has one job: the person reading it decides to call this candidate in. It is written in the FIRST PERSON, as the candidate — "I did X", never "product decisions hinged on X". A letter with no "I" in it is not an application.

What the letter is ABOUT is what this candidate and this company have in common — a shared way of working, shown through things the candidate actually did. Not a narration of their CV. Walking the reader through the candidate's roles in prose is the one thing this letter must not be: the CV is attached and does that better, and a letter that duplicates it has no reason to exist.

Two failures follow from getting that wrong, and both are fatal on the first line:
- **Do not lecture the reader about their own industry.** An opening thesis about what makes companies of this kind succeed or fail, or an explanation of the employer's own market back to them, is marketing copy, not a letter. The reader knows their business.
- **Do not write aphorisms.** A short declarative line dropped in to sound weighty — "Friction kills adoption.", "Specification is an execution problem." — is a slogan, and slogans are what a machine writes when it has nothing to say. Every sentence carries a fact, an argument, or a question. Going short is about rhythm, never about scoring a point.

Never invent, never inflate, never claim a duration, a number, a skill or a role the record does not state.
${steeringBlock}
${adBlock(analysis)}
${asksBlock(analysis, Boolean(planBlock))}${coverEvidenceBlock(analysis)}${planBlock}${letterExemplarBlock()}${voiceOwnership}${coreBlock}

# The letter's furniture
${currentDateBlock(now)}
${coverLengthRule(analysis)}
- ${languageInstruction(language)}
${salutationRule(analysis, language)}
- Open with a professional header, styled to match the CV: the candidate's name, then their contact details from the record's own \`identity\` / \`contact\` data, one per line, then the date on its own line. Then the salutation.
- End with a signature block in exactly this form, using the record's own \`identity\` / \`contact\` data. The sign-off is written in the LETTER'S OWN LANGUAGE — "Sincerely," in English, "S pozdravem," in Czech, "Z poważaniem," in Polish; an English sign-off under a Czech letter is the plainest possible sign that a machine filled in a template:
Sincerely,

**[Full Name]**
[Telephone]
[Email]
[LinkedIn URL]
- No placeholders of any kind — no "[Company Address]", no bracketed instructions, nothing for the candidate to fill in.

# The candidate's record — the ONLY source of fact
${currentDateReminder(now)}
A \`voice_guide\` in this record, where one exists, is the candidate's OWN written style guide: follow it over any style habit of yours. Like \`voice_samples\` it describes HOW to write, never WHAT is true — neither can license a fact the record does not carry.

${cv}

Return only the letter: the header, the date, the salutation, the body, the signature block.`
  };

  return [systemMessage, userMessage];
}
