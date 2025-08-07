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
    # Task
    Generate a new CV in the "${tone}" tone, based ONLY on the provided CV and analysis. Do NOT invent facts, roles, or skills. All claims must be fact-based. Output must match the CV's detected language (fallback to English if unclear). If the job ad is in another language, CV language takes precedence.

    # Rules
    - Use analysis to guide structure, emphasis, and keyword usage.
    - Implement all critical and advised action items from analysis.action_items.cv_changes.
    - Use the jobs_extracted array as the definitive source for job history. List ALL jobs from jobs_extracted in exact chronological order by start_date (most recent first).
    - For overlapping jobs (concurrent roles), include ALL jobs and indicate concurrency in descriptions (e.g., 'Concurrent with [Role Title]').
    - For ongoing jobs (where end_date is "ongoing" or is_current is true), show dates as "[start_date] - Present" or equivalent in the detected language.
    - Preserve real employment gaps exactly as they appear between jobs in jobs_extracted. Never create artificial gaps.
    - Match and highlight ATS keywords from analysis.ats_keywords and job_match.inferred_keywords.
    - Adhere to target country format (CZ, PL, UE, HU, RO) from analysis. Do not include country-specific suggestion comments in output.
    - Write in "${tone}" tone: (${toneInstructions(tone)}).
    - CV must perform well if re-analyzed by our analysis engine.
    - Style can be creative but factual accuracy is required.
    - Output ONLY the candidate's CV—no notes, explanations, or commentary.
    - Never include phrases like "Full career history available upon request."

    - CRITICAL ACTION ITEMS: Review analysis.action_items.cv_changes.critical array. Each item MUST be addressed in the CV output.
    - ADVISED ACTION ITEMS: Review analysis.action_items.cv_changes.advised array. Implement unless there's a clear conflict.
    - For each action item, identify the specific CV section it affects and modify accordingly.

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
