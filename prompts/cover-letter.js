// prompts/cover-letter.js

function toneInstructions(tone) {
  switch ((tone || '').toLowerCase()) {
    case 'formal':
      return "Use a professional, reserved style. Avoid slang. Clear and businesslike.";
    case 'friendly':
      return "Warm, approachable, positive. Slightly informal but still professional.";
    case 'confident':
      return "Assertive, self-promoting, positive, but not arrogant. Highlight strengths clearly.";
    case 'cocky':
      return "Borderline arrogant, punchy, use colloquialisms if relevant: 'shit-hot', 'kick-ass', 'rock star', 'BOOM!'. Walk the line between boldness and professionalism.";
    default:
      return "Professional default style.";
  }
}

export function buildCoverPrompt(cv, analysis, tone) {
  const systemMessage = {
    role: 'system',
    content: 'You are an expert in writing professional cover letters for CEE tech roles who follows formatting rules precisely.'
  };

  const userMessage = {
    role: 'user',
    content: `
    # Task
    Write a cover letter in the "${tone}" tone, using only real facts from the CV and analysis. Do NOT invent information. Output must match the CV's detected language (fallback to English if unclear). If the job ad is in another language, CV language takes precedence.

    # Rules
    - Start with only the date at the top. Do NOT add applicant's name or contact details.
    - Salutation must be "Dear [First Name] [Last Name]" or "Dear Hiring Manager" if no name is available. Do not use titles like Mr., Ms.
    - Address all action items from analysis.action_items.cover_letter (critical, advised, optional).
    - End with a signature block in this format, using CV data:
    Sincerely,

    **[Applicant's Full Name]**
    [Applicant's Telephone]
    [Applicant's Email]
    [Applicant's LinkedIn URL]
    - No generic filler, invented claims, or placeholders like [Company Address].
    - Adhere to target country norms (CZ, PL, UE, HU, RO) from analysis. Do not include country-specific suggestion comments in output.
    - Write in "${tone}" tone: (${toneInstructions(tone)}).

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
