// prompts/cover-letter.js

import { toneInstructions } from './tone.js';

export function buildCoverPrompt(cv, analysis, tone) {
  const systemMessage = {
    role: 'system',
    content: 'You are an expert cover-letter writer for CEE tech roles. You write tight, specific, persuasive letters — every sentence earns its place — and you follow formatting rules precisely.'
  };

  const userMessage = {
    role: 'user',
    content: `
    # Task
    Write a cover letter in the "${tone}" tone, using only real facts from the CV and analysis. Do NOT invent information. Output must match the CV's detected language (fall back to English if unclear). If the job ad is in another language, the CV language takes precedence.

    # What makes it land
    - Open with a specific hook tied to this candidate and this role — never a generic "I am writing to apply for...".
    - Build a short narrative: why this candidate, why this role, what they bring. Use concrete proof from the CV (real achievements, numbers, scope), not adjectives.
    - The cover letter is the right place to address concerns: where relevant, briefly and confidently turn the items in \`analysis.red_flags\` into a strength or a non-issue. Do this with a light touch — explain, don't apologise.
    - Work through the guidance in \`analysis.action_items["Cover Letter"]\` (Points to Address, Narrative Flow, Tone and Style).

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
