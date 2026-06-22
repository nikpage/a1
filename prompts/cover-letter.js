// prompts/cover-letter.js

import { toneInstructions } from './tone.js';
import { humanVoiceRules } from './voice.js';

export function buildCoverPrompt(cv, analysis, tone, tweak = '', core = '') {
  const coreBlock = core && core.trim()
    ? `    # Who this candidate is (steering)\n    The candidate describes the durable value they bring to any role as: "${core.trim()}"\n    Let it guide what you foreground and how you frame the story — never state anything the CV doesn't actually prove.\n`
    : '';
  const tweakBlock = tweak && tweak.trim()
    ? `    # The candidate's own instructions (HIGHEST PRIORITY)\n    Follow this over any conflicting guidance below, but NEVER invent facts to satisfy it:\n    "${tweak.trim()}"\n`
    : '';
  const systemMessage = {
    role: 'system',
    content: 'You are an expert cover-letter writer for CEE tech roles. You write tight, specific, persuasive letters — every sentence earns its place — and you follow formatting rules precisely.'
  };

  const userMessage = {
    role: 'user',
    content: `${tweakBlock}${coreBlock}
    # Task
    Write a cover letter in the "${tone}" tone, using only real facts from the CV and analysis. Do NOT invent information. Output must match the CV's detected language (fall back to English if unclear). If the job ad is in another language, the CV language takes precedence.

    # What makes it land
    - Open with a specific hook tied to this candidate and this role — never a generic "I am writing to apply for...". Keep the opening to one or two short, punchy sentences; do NOT cram the whole pitch into a single dense, multi-clause first sentence.
    - Build a short narrative: why this candidate, why this role, what they bring. Use concrete proof from the CV (real achievements, numbers, scope), not adjectives.
    - The cover letter is the right place to address concerns: where relevant, briefly and confidently turn the items in \`analysis.red_flags\` into a strength or a non-issue. Do this with a light touch — explain, don't apologise. Let any such pivot grow naturally out of the surrounding story rather than appearing as an abrupt, bolted-on sentence.
    - Work through the guidance in \`analysis.action_items["Cover Letter"]\` (Points to Address, Narrative Flow, Tone and Style).

    ${humanVoiceRules()}

    # Rules
    - Start with only the date at the top. Do NOT add the applicant's name or contact details above the salutation.
    - Salutation: "Dear [First Name] [Last Name]" if a name is available, otherwise "Dear Hiring Manager". No titles like Mr./Ms.
    - No generic filler, invented claims, or placeholders like [Company Address].
    - Adhere to target-country norms (CZ, PL, UE, HU, RO) from the analysis. Do not print country-specific suggestion comments in the output.
    - End with a signature block in this exact format, using CV data:
    Sincerely,

    **[Applicant's Full Name]**
    [Applicant's Telephone]
    [Applicant's Email]
    [Applicant's LinkedIn URL]

    # Tone — "${tone}"
    ${toneInstructions(tone)}

    # Inputs
    ## CV:
    ${cv}

    ## Analysis:
    ${JSON.stringify(analysis, null, 2)}

    # Output
    Return only the cover letter. Start with the date, then salutation, body, and end with the signature block.
    `
  };

  return [systemMessage, userMessage];
}
