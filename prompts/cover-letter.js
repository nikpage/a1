// prompts/cover-letter.js

import { toneInstructions } from './tone.js';
import { humanVoiceRules } from './voice.js';
import { languageInstruction } from './language.js';
import { currentDateBlock, currentDateReminder } from './current-date.js';
import { targetJobBlock, rawAdBlock } from './job-target.js';
import { cvInvariants, coverMatchingRule, coverOpeningRules, coverRedFlagRule } from './cv-rules.js';
import { coverBrief } from './analysis-brief.js';
import { coverEvidenceBlock, salutationName } from './cover-evidence.js';
import { scenarioCoverRules } from './scenarios.js';
import { coverLengthRule } from './market.js';
import { voiceProfileBlock, voiceExcerptBlock } from './voice-profile.js';

export function buildCoverPrompt(cv, analysis, tone, tweak = '', core = '', language = 'auto', now = new Date(), voiceProfile = null) {
  // The ad itself — the letter is addressed to THIS job, so it reads it
  // directly, IN THE EMPLOYER'S OWN WORDS where the analysis kept them. The
  // extraction is the fallback for analyses saved before job_text existed and
  // for standalone reviews with no ad at all.
  const jobBlock = rawAdBlock(analysis) || targetJobBlock(analysis);
  // The letter is bound by the same invariants as the CV, plus the Layer 3
  // requirement-answering rule when there is an ad to match against.
  const matchingRule = coverMatchingRule(Boolean(jobBlock));
  // The material gathered for THIS document (Layer 3) — evidence the writer
  // chooses from, never a plan it executes.
  const evidenceBlock = coverEvidenceBlock(analysis);
  const openingRules = coverOpeningRules(salutationName(analysis));
  const redFlagRule = coverRedFlagRule();
  // Layer 4 reaches the letter as well as the CV, in its own letter-specific
  // form — the tags the analysis already chose, capped at two by the module.
  const scenarioBlock = scenarioCoverRules(analysis?.analysis?.scenario_tags);
  const coreBlock = core && core.trim()
    ? `    # Who this candidate is (steering)\n    The candidate describes the durable value they bring to any role as: "${core.trim()}"\n    Let it guide what you foreground and how you frame the story — never state anything the CV doesn't actually prove.\n`
    : '';
  // The candidate's own writing voice, built once from samples of their own prose
  // (prompts/voice-profile.js). It is a constraint on HOW to write and carries no
  // facts — which is why it lives outside the master record, not inside it.
  const voiceBlock = voiceProfileBlock(voiceProfile);
  // Short excerpts, so the model can hear the rhythm a description loses. Fenced
  // hard: manner only, nothing taken.
  const excerptBlock = voiceProfile ? voiceExcerptBlock(voiceProfile) : '';
  // Steering is in scope when the letter is COMPOSED — it reaches the writer at
  // the moment the writer decides what the letter says, which is the whole point
  // of the writer deciding. It still has to be stated concretely: the evidence
  // block and the target-job block were both gathered during analysis, before
  // the candidate typed a word, so a writer reading them uncritically foregrounds
  // exactly the experience the candidate just asked to bury.
  // The candidate's own words. The RULES for applying them are C4 of the
  // contract, stated once at the top — repeating them here would be the same
  // requirement in two voices, which is what crowded this prompt out of room.
  const tweakBlock = tweak && tweak.trim()
    ? `    # The candidate's own instructions (HIGHEST PRIORITY — contract clause C4)
    "${tweak.trim()}"

    This is the candidate speaking about their own letter. It wins over every block that follows, including the evidence gathered below and the target-job instruction to lead with evidence for each requirement. Demoted content is not evidence: it may not be the hook, the lead, or the proof you offer for a requirement — find other real evidence, or leave that requirement unanswered. It is not deleted either; it may appear once, late and plainly. And steering never adds a fact: if they ask you to emphasise something the master does not evidence, foreground the closest thing it DOES evidence and say no more.
`
    : '';

  // THE CONTRACT (CV_RULES.md, "The cover letter's contract"). Four clauses,
  // stated ONCE, at the top, before anything else — and checked in code after
  // the letter is written (checks 26-30), with a failure regenerating the letter
  // with that failure named. Everything below this block is judgement; these
  // four are not. They are stated once deliberately: the same requirement
  // restated in three blocks does not bind three times harder, it dilutes and it
  // takes the room the writer needs to compose.
  const contractBlock = `    # THE CONTRACT — four things this letter must do
    Everything else in this prompt is guidance you weigh. These four are checked by code after you write, and a letter that misses one is sent back to you to write again.

    **C1 — Answer the ad's requirements with the record's evidence.** Where evidence is given below for a requirement this record can genuinely answer, at least one of those requirements is answered IN THE PROSE, with the achievement that proves it. Not the ad's words restated. Not an assertion of fit. The evidence.
    **C2 — Address a red flag where one exists and the record answers it.** One concern, one flat clause, inside the body — never the opening, never the close — carrying a fact from the master. This applies to EVERY applicant, not only the difficult cases. Where the record settles none of the listed concerns, address none.
    **C3 — Write in this candidate's voice${voiceBlock ? '' : ', and where there is none recorded, in deliberately plain human prose'}.**${voiceBlock ? ' Their recorded voice owns this letter from its first sentence, as set out below.' : ' No voice profile exists for this candidate, and that is NOT permission to fall back on a professional-letter register: short words, sentence lengths that genuinely vary, the point first, no throat-clearing, no stock phrase.'}
    **C4 — Obey the candidate's steering, and write in the requested language.** What they asked you to emphasise is in the FIRST paragraph, proved with a fact from the record. What they asked you to play down is NOT in the first paragraph at all. ${languageInstruction(language)}
`;
  // THE WRITER OWNS THE LETTER, VOICE INCLUDED.
  //
  // The letter used to be written cold and then restyled by a second call. Two
  // models, neither owning the document: the first produced a career summary,
  // the second reshaped someone else's outline, and reshaping an outline
  // produces fragments — orphan one-line paragraphs, stub sentences, a weak
  // close. So the voice is handed to the WRITER, at the top, before the rules,
  // with the candidate's actual writing in front of it. The rewrite still
  // exists, but only as a fallback when the finished letter measures flat
  // (utils/openai.js).
  const voiceOwnership = voiceBlock
    ? `    # WHO IS WRITING THIS, AND IN WHAT MOOD
    You are writing AS this candidate, in their own voice, not as a professional letter service writing on their behalf.

    ## The tone they chose: "${tone}"
    ${toneInstructions(tone)}

    **Voice and tone are different things and both apply.** The VOICE is how this person writes — sentence shapes, rhythm, punctuation, vocabulary — and it is fixed: it is theirs. The TONE is the mood they have chosen for THIS letter, and it is a deliberate choice they made, not a default to be softened. Their voice does not override it: the same person writes warmly or bluntly depending on the letter, and you are writing the one they asked for. The samples below show HOW they write, in whatever mood they happened to be in when they wrote them — do not copy that mood, copy the manner. If the samples read reserved and the chosen tone is enthusiastic, the letter is enthusiastic, in their sentence shapes. Their voice is described below and their own writing is quoted further down. Read both before you write a word, and write the whole letter that way from the first sentence — this is not a polish applied at the end, it is how the letter is composed.

    Voice is SHAPE before it is vocabulary: the spread of sentence lengths, how short the shortest sentence gets, how long a paragraph runs, whether the point lands first or last. Uniform sentences in uniform paragraphs are what makes writing read as machine-made, and no word choice fixes them. Match the proportions their samples show — their long sentences as well as their short ones.

    Concretely, and this is checked after you write:
    - At least ONE sentence in the letter is SIX WORDS OR FEWER. Not as a trick — a short sentence lands a conclusion, a pivot, or a fact that needs no qualifying. A letter whose shortest sentence is nine words has no rhythm at all.
    - Sentence lengths vary WIDELY across the letter. Some sentences run past twenty-five words. Others are four.
    - No paragraph runs past about ninety words.
    - Do NOT manufacture rhythm by chopping one thought into three stubs ("I apply AI." "I organize user research."): that is a list with full stops in it and it reads worse than a flat paragraph. Short sentences are for landing points, never for breaking up a thought that belongs together.
    - The opening is one concrete thing this candidate DID. Never a summary of their career or their interests ("My work has long centered on…" is brochure copy, not a person talking).
${voiceBlock}${excerptBlock}
`
    : `    # The tone they chose: "${tone}"
    ${toneInstructions(tone)}
`;

  const systemMessage = {
    role: 'system',
    content: voiceBlock
      ? 'You write a cover letter as the candidate themselves, in their own voice, from a description of how they write and samples of their actual writing. Every fact comes from their record and nothing is invented. You return the finished letter only.'
      : 'You are an expert cover-letter writer for CEE tech roles. You write tight, specific, persuasive letters — every sentence earns its place — and you follow formatting rules precisely.'
  };

  const userMessage = {
    role: 'user',
    content: `${contractBlock}${tweakBlock}${voiceOwnership}${coreBlock}
    ${currentDateBlock(now)}
${jobBlock}
${cvInvariants()}

    # Task
    Write a cover letter in the "${tone}" tone, using only real facts from the master CV and analysis. Do NOT invent information. The output language is stated in C4 above and is not restated here.

    # What makes it land
    - **The letter makes ONE argument, and it is one only THIS candidate could make for THIS ad.** Before you write a word, decide the single claim: read the ad as written above, read this record, and name the thing that connects them that a generically strong applicant could NOT say. Then prove it in 3-4 paragraphs. If the claim you have chosen would fit fifty other applicants for this role, or this applicant for fifty other roles, it is the wrong claim — go back and find the specific one. Everything the record holds that does not serve it stays on the CV. Every paragraph advances that claim or is cut. You are handed a strategy, evidence for the ad's requirements, red flags, an active scenario and a body of guidance below: they are inputs to the argument, NOT a checklist to satisfy in turn. Nothing below decides the letter's shape for you — what it opens on, which evidence it uses, the order it proves things in and what it asks for at the close are YOUR calls, made here, with the candidate's instructions, the tone and their voice in hand. A letter that answers each instruction with its own sentence has no through-line, and the seams between the instructions are obvious to anyone reading it. Ignore anything that does not serve the argument, however prominently it is stated.
    - **The last line is this candidate speaking, in the first person, asking for the next step.** What they ask for is your call — a conversation, a meeting, the chance to show something specific. How it is worded is theirs. What it may NEVER be is a THIRD-PERSON MAXIM about the role or the industry ("Managing a recommendation engine requires a product leader who…", "Great products are built by people who…"): a general truth about the job is not a close, it is the letter clearing its throat on the way out, and it puts a stranger's voice in the last thing the reader reads. Do not summarise the letter either — the reader has just read it.
    - Open with a specific hook tied to this candidate and this role — never a generic "I am writing to apply for...". Keep the opening to one or two short, punchy sentences; do NOT cram the whole pitch into a single dense, multi-clause first sentence.
    - Build a short narrative: why this candidate, why this role, what they bring. Use concrete proof from the master CV (real achievements, numbers, scope from \`experience[]\`), not adjectives.
    - **Never state a span of experience the record doesn't state.** No "14 years of AI solution design", no "a decade in fintech", no "X+ years" of anything. Durations are facts: the only ones that exist are those written in \`experience[].dates\`. Never sum roles into a career total, never stretch a domain label across roles that weren't in that domain. Lead with what they did, not with how long they've been doing it.
${voiceBlock ? '' : `    - **Voice is SHAPE before it is vocabulary (C3).** The spread of sentence lengths, how short the shortest sentence gets, how long a paragraph runs, whether the point lands first or last. Uniform sentences in uniform paragraphs are what reads as machine-written and no word choice fixes it: vary the lengths deliberately, go genuinely short at least once, let paragraphs differ in weight. The master CV's \`voice_samples\` are verbatim sentences in the candidate's real writing — echo their cadence and register, for manner only, never copied wholesale and never treated as a fact about this role. A \`voice_guide\` is the candidate's own written style guide: follow it over any style habit of yours, with the tone deciding attitude and the guide deciding cadence. Both describe HOW to write, never WHAT is true.
`}    - **How far that voice travels is set by the AD'S OWN REGISTER.** Read how the employer writes above: how formal, how personal, how warm. A warm, informal, first-person ad earns this candidate's voice close to full strength — their narrative shape, their casual cadence, their way of opening. A terse, formal, corporate ad earns the same voice held closer in: the same rhythm, the same directness, less of the informality. Either way it stays THEIR voice; holding it in never means flattening it into business prose. Samples from a blog or a personal message are evidence of how they write, never proof that a blog's manner suits this application.
${redFlagRule}
    - Where the concern you chose to address (if any) is a gap or short tenure and the matching master \`experience[]\` entry carries a \`clarification\`, use the candidate's own words for it. Never invent a reason the clarification does not state; if there is no clarification, do not speculate about the gap.
    - **The guidance is material, not a running order.** \`analysis.cover_action_items\` (Points to Address, Narrative Flow, Tone and Style) tells you what is worth proving and what evidence proves it. Mine it — do not walk it. One paragraph may answer several items; an item that does not advance the argument is dropped; nothing is included merely because it appears on the list. If any item arrives as a finished sentence or a quoted opening line, treat it as raw material only: rewrite it in this candidate's voice and this tone, at the length you actually have. Never paste it, and never restate an item the active scenario forbids you to say.
${matchingRule}
${openingRules}

${evidenceBlock}
${scenarioBlock}
    ${humanVoiceRules(language)}

    # Rules
    ${coverLengthRule(analysis)}
    - Start with only the date at the top. Do NOT add the applicant's name or contact details above the salutation.
    - No generic filler, invented claims, or placeholders like [Company Address].
    - Adhere to target-country norms (CZ, PL, UE, HU, RO) from the analysis. Do not print country-specific suggestion comments in the output.
    - End with a signature block in this exact format, using the master CV's \`identity\` / \`contact\` data:
    Sincerely,

    **[Applicant's Full Name]**
    [Applicant's Telephone]
    [Applicant's Email]
    [Applicant's LinkedIn URL]

    # Inputs
    ## Master CV (the candidate's complete, structured career record — your sole factual source; includes \`voice_samples\` and, where present, \`voice_guide\` for the candidate's writing voice):
    ${currentDateReminder(now)}
    ${cv}

    ## Analysis (background for the argument — not a list to work through):
    ${JSON.stringify(coverBrief(analysis), null, 2)}

    # Output
    Return only the cover letter. Start with the date, then salutation, body, and end with the signature block.
    `
  };

  return [systemMessage, userMessage];
}
