// prompts/cv-generator.js

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

export function buildCvPrompt(cv, analysis, tone) {
  const systemMessage = {
    role: 'system',
    content: 'You are an expert in writing professional CVs. Follow the formatting instructions exactly and never add commentary or notes.'
  };

  const userMessage = {
    role: 'user',
    content: `
    # MANDATORY STEPS - DO THESE FIRST

    STEP 1 (Context): First, read 'analysis.summary' and 'analysis.overall_commentary' to get a general understanding of the candidate.

    STEP 2 (Implement Actions): You MUST address every point from the 'analysis.quick_wins' and 'analysis.red_flags' arrays.
      - For each item in 'analysis.quick_wins', implement the suggestion directly. For example, if a win is "Quantify leadership impact," you must add metrics (e.g., team size, revenue influenced) to the relevant job descriptions.
      - For each item in 'analysis.red_flags', you must resolve the issue. For example, if a flag is "Overlapping advisory roles," you must clarify or consolidate these roles in the experience section.

    STEP 3 (Rewrite Summary): Based on the context from Step 1 and the actions from Step 2, rewrite the "Professional Summary" to be impactful and sharply focused on the target "Product Director" role.

    # Task
    Generate a new CV in the "${tone}" tone, based ONLY on the provided CV and analysis. Do NOT invent facts, roles, or skills. All claims must be fact-based. Output must match the CV's detected language (fallback to English if unclear). If the job ad is in another language, CV language takes precedence.

    # Rules
    - Use the jobs_extracted array as the definitive source for job history. List ALL jobs from jobs_extracted in exact chronological order by start_date (most recent first).
    - For overlapping jobs (concurrent roles), include ALL jobs and indicate concurrency in descriptions (e.g., 'Concurrent with [Role Title]').
    - For ongoing jobs (where end_date is "ongoing" or is_current is true), show dates as "[start_date] - Present" or equivalent in the detected language.
    - Preserve real employment gaps exactly as they appear between jobs in jobs_extracted. Never create artificial gaps.
    - Write in "${tone}" tone: (${toneInstructions(tone)}).
    - Output ONLY the candidate's CV—no notes, explanations, or commentary.
    - Never include phrases like "Full career history available upon request."

    # Formatting Requirements
    Output in Markdown format with this exact structure:

    ## CENTERED INTRO SECTION (use HTML center tags):
    <center>

    ### **[Full Name]**
    [Optional tagline/headline if present in original CV]
    [Phone] | [Email] | [LinkedIn/Portfolio URLs]

    </center>

    ---

    ## LEFT-ALIGNED SECTIONS:

    ### **Professional Summary**
    [Summary content]

    ---

    ### **Key Skills**
    Format as 2-column bullet list:
    <div style="display: flex; flex-wrap: wrap;">
    <div style="width: 50%; padding-right: 10px;">

    - [Skill 1]
    - [Skill 3]
    - [Skill 5]

    </div>
    <div style="width: 50%;">

    - [Skill 2]
    - [Skill 4]
    - [Skill 6]

    </div>
    </div>

    ---

    ### **Professional Experience**
    For each role from jobs_extracted, emphasize the role title FIRST and most prominently:

    #### **[Job Title]**
    **[Company Name]** | [Start Date] - [End Date or Present] | [Location]
    - [Achievement/responsibility]
    - [Achievement/responsibility]

    ---

    ### **Education**
    [Education content]

    ---

    ### **[Any Other Sections]**
    [Other content as needed]

    # Inputs
    ## CV:
    ${cv}

    ## Analysis:
    ${JSON.stringify(analysis, null, 2)}

    # Output
    Return only the formatted CV in the exact Markdown structure shown above. No additional commentary, notes, or explanations.
    `
  };

  return [systemMessage, userMessage];
}
