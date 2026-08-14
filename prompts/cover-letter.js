// prompts/cover-letter.js

import { toneInstructions } from './tone.js';
import { humanVoiceRules } from './voice.js';
import { languageInstruction } from './language.js';
import { currentDateBlock, currentDateReminder } from './current-date.js';
import { targetJobBlock } from './job-target.js';
import { cvInvariants, coverMatchingRule, coverOpeningRules, coverRedFlagRule } from './cv-rules.js';
import { generationBrief } from './analysis-brief.js';
import { coverEvidenceBlock, salutationName } from './cover-evidence.js';
import { scenarioCoverRules } from './scenarios.js';
import { coverLengthRule } from './market.js';
import { voiceProfileBlock, voiceExcerptBlock } from './voice-profile.js';

export function buildCoverPrompt(cv, analysis, tone, tweak = '', core = '', language = 'auto', now = new Date(), voiceProfile = null) {
  // The ad itself — the letter is addressed to THIS job, so it reads it directly.
  const jobBlock = targetJobBlock(analysis);
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
  const tweakBlock = tweak && tweak.trim()
    ? `    # The candidate's own instructions (HIGHEST PRIORITY)
    "${tweak.trim()}"

    This is the candidate speaking about their own letter. It wins over every block that follows, including the evidence gathered below and the target-job instruction to lead with evidence for each requirement. Apply it like this:
    - **Demoted content is not evidence.** Where they ask you to play something down, it may NOT be the proof you lead with, the hook, or what you offer against a requirement in the ad — however well it answers one. Find other real evidence in the master for that requirement. If the master has none, leave that requirement UNANSWERED and make the letter's argument with fewer: an unanswered requirement is honest, and the candidate has decided what this letter argues.
    - **Demoted content is not deleted.** It may still appear once, late, plainly, where leaving it out would make the story incoherent — never as the letter's centre of gravity, never named repeatedly.
    - **Emphasised content leads and is proved.** What they ask you to foreground belongs in the opening and carries the letter's argument, with the specific facts the master records for it. An emphasis reduced to one passing clause has been ignored, not applied.
    - **NEVER invent a fact to satisfy any of this.** Steering reorders, reframes and cuts real content. It never adds. If they ask you to emphasise something the master does not evidence, foreground the closest thing the master DOES evidence and say no more.
`
    : '';
  const systemMessage = {
    role: 'system',
    content: 'You are an expert cover-letter writer for CEE tech roles. You write tight, specific, persuasive letters — every sentence earns its place — and you follow formatting rules precisely.'
  };

  const userMessage = {
    role: 'user',
    content: `${tweakBlock}${coreBlock}
    ${currentDateBlock(now)}
${jobBlock}
${cvInvariants()}

    # Task
    Write a cover letter in the "${tone}" tone, using only real facts from the master CV and analysis. Do NOT invent information. ${languageInstruction(language)}

    # What makes it land
    - **The letter makes ONE argument.** Decide the single claim this letter proves — why THIS candidate and THIS role belong together — before you write a word, then prove it in 3-4 paragraphs. Every paragraph advances that claim or is cut. You are handed a strategy, evidence for the ad's requirements, red flags, an active scenario and a body of guidance below: they are inputs to the argument, NOT a checklist to satisfy in turn. Nothing below decides the letter's shape for you — what it opens on, which evidence it uses, the order it proves things in and what it asks for at the close are YOUR calls, made here, with the candidate's instructions, the tone and their voice in hand. A letter that answers each instruction with its own sentence has no through-line, and the seams between the instructions are obvious to anyone reading it. Ignore anything that does not serve the argument, however prominently it is stated.
    - Open with a specific hook tied to this candidate and this role — never a generic "I am writing to apply for...". Keep the opening to one or two short, punchy sentences; do NOT cram the whole pitch into a single dense, multi-clause first sentence.
    - Build a short narrative: why this candidate, why this role, what they bring. Use concrete proof from the master CV (real achievements, numbers, scope from \`experience[]\`), not adjectives.
    - **Never state a span of experience the record doesn't state.** No "14 years of AI solution design", no "a decade in fintech", no "X+ years" of anything. Durations are facts: the only ones that exist are those written in \`experience[].dates\`. Never sum roles into a career total, never stretch a domain label across roles that weren't in that domain. Lead with what they did, not with how long they've been doing it.
    - **Match the candidate's own voice.**${voiceBlock ? ' Their writing voice is described in its own block below — that description is the authority on HOW this letter reads, and a letter that sounds slightly too casual is a better outcome than one that reads like a template.' : ''} The master CV's \`voice_samples\` are verbatim sentences in the candidate's real writing style — echo their cadence, vocabulary and register so the letter reads as written by them, not by a machine. Use them for tone only; never copy a sample wholesale or treat it as a fact about this role. If the master CV carries a \`voice_guide\`, it is the candidate's own written style guide — how THEY write, stated in their words. Follow it: it outranks any generic style habit of yours, and where it and the chosen tone pull apart, the tone decides the attitude while the guide decides the cadence, sentence shapes and vocabulary. It describes HOW to write, never WHAT is true — it can never license a fact the record does not carry.
${redFlagRule}
    - Where the concern you chose to address (if any) is a gap or short tenure and the matching master \`experience[]\` entry carries a \`clarification\`, use the candidate's own words for it. Never invent a reason the clarification does not state; if there is no clarification, do not speculate about the gap.
    - **The guidance is material, not a running order.** \`analysis.action_items["Cover Letter"]\` (Points to Address, Narrative Flow, Tone and Style) tells you what is worth proving and what evidence proves it. Mine it — do not walk it. One paragraph may answer several items; an item that does not advance the argument is dropped; nothing is included merely because it appears on the list. If any item arrives as a finished sentence or a quoted opening line, treat it as raw material only: rewrite it in this candidate's voice and this tone, at the length you actually have. Never paste it, and never restate an item the active scenario forbids you to say.
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

    # Tone — "${tone}"
    ${toneInstructions(tone)}

${voiceBlock}
    # Inputs
    ## Master CV (the candidate's complete, structured career record — your sole factual source; includes \`voice_samples\` and, where present, \`voice_guide\` for the candidate's writing voice):
    ${currentDateReminder(now)}
    ${cv}

    ## Analysis (the strategic brief — the plan to execute, not a review to answer):
    ${JSON.stringify(generationBrief(analysis), null, 2)}

${excerptBlock}
    # Output
    Return only the cover letter. Start with the date, then salutation, body, and end with the signature block.
    `
  };

  return [systemMessage, userMessage];
}
