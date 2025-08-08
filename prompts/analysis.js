// prompts/analysis.js

export function buildAnalysisPrompt(cvText, jobText, hasJobText) {
  const systemMessage = {
    role: 'system',
    content: `You are an expert HR strategist and storyteller. Your role is to analyze a CV and job description, crafting a narrative that is an honest critique and actionable roadmap. Feedback must be insightful, critical where necessary, but always empowering. Identify weaknesses but focus on a clear success strategy. All output, including in "cocky" tone, must match the CV's detected language (fallback to English if unclear). If the job ad is in a different language, prioritize CV language. Use only provided CV and job ad content—never invent information.

NARRATIVE FLOW: Write sections as a story: summary as engaging TL;DR, cv_data introduces the candidate, job_data shows the target, analysis evaluates presentation, job_match shows fit, final_thought motivates. Each feels like a chapter.

WRITING QUALITY: Reference specific CV phrases and experiences. Be specific, actionable, and avoid generic examples. Make all guidance sound intentional and professional, not like coding elements.`
  };

  const userMessage = {
    role: 'user',
    content: `
// STEP 0: DETECT LANGUAGE
Detect the CV's language. All output, including field labels, summaries, and commentary, must be in this language. If detection fails (e.g., ambiguous or mixed), default to English. If the job ad is in another language, CV language takes precedence.

// STEP 1: EXTRACT JOBS WITH DATES
Parse all employment experiences from the CV. For each job, extract:
- Exact job title
- Company name
- Start date (parse from CV text)
- End date (parse from CV text, or mark as "ongoing" if no end date, currently employed, or uses terms like "Present", "current", "now", etc. in any language)
- Location if available
- Key responsibilities/achievements

List jobs in chronological order by start date (most recent first). Include ALL jobs, even if dates overlap. Mark overlapping roles clearly.

// STEP 2: DETECT CAREER SCENARIO
Classify the candidate's situation using these readable descriptions:
- experienced professional: Over 50 or clear age indicators in CV.
- entry level candidate: Entry-level, <2 years experience.
- career returner: Returning after a career break.
- employment gap present: Unexplained employment gaps >6 months between jobs (based on extracted dates).
- standard progression: Normal career progression.
- career pivot: Shifting to a new role/industry.
- overqualified candidate: Significantly more skills/experience than job requires.
- major career transition: Major career change (e.g., finance to fishing).
- concurrent roles: Multiple roles with overlapping date ranges.
A candidate can have multiple tags. Use these to guide tone and analysis.

// STEP 3: PERFORM STRATEGIC ANALYSIS
Critically analyze the CV in context of the job (if provided). Be strategic, honest, and practical, like a top-tier HR consultant. Always provide critical action items, even for bad, mismatched, or extreme pivot profiles. Reference only real CV content—never invent or assume. Identify real employment gaps (>6 months) and overlapping roles from the extracted job list for analysis.

Ensure the 'action_items' object contains comprehensive, clear, natural language bullet points summarizing ALL actionable advice from the entire analysis.

**Remove** the 'master_plan' section entirely.

**Merge** the bullet points from 'master_plan.quick_wins_to_implement' and 'master_plan.keyword_integration_plan' into the 'cv_changes' categories as follows based on priority and impact:
- high-impact quick wins → put into 'cv_changes.critical'
- keyword integration plan items → distribute into 'cv_changes.advised' or 'cv_changes.optional' as suitable

Rename 'cover_letter_guidance' to 'Cover Letter', and rename its inner keys:
- 'critical_points_to_address' → 'Points to Address'
- 'suggested_narrative_flow' → 'Narrative Flow'

All bullet points inside string values must use the bullet character "•" and line breaks for readability.

Avoid any markdown syntax like bold or code blocks inside strings.

Maintain the full JSON structure so output remains strict valid JSON.

// STEP 4: CREATE GENERATION FRAMEWORK
Based on the strategic analysis in STEP 3, create a machine-readable blueprint for the subsequent CV and cover letter writing prompts. This framework should be invisible to the end user and remain unchanged.

// STEP 5: OUTPUT STRICT JSON
Return a single strict JSON object with these top-level keys exactly, formatting all bullet lists as newline-separated text strings with "•" bullets inside string values. No markdown or code blocks.

{
  "summary": "1–2 sentence TL;DR that grabs attention, reflects the candidate's real situation, and encourages deeper reading.",
  "cv_data": {
    "Name": "Full name from CV",
    "Seniority": "Junior/Mid/Senior/etc.",
    "Industry": "Industry from CV",
    "Country": "Most relevant country based on recent work (prioritize CZ, PL, UE, HU, RO if mentioned)"
  },
  "job_data": {
    "Position": "${hasJobText ? 'Job title from job ad' : 'n/a'}",
    "Seniority": "${hasJobText ? 'Extracted seniority level' : 'n/a'}",
    "Company": "${hasJobText ? 'Company name from job ad' : 'n/a'}",
    "Industry": "${hasJobText ? 'Job ad industry' : 'n/a'}",
    "Country": "${hasJobText ? 'Country from job ad (CZ, PL, UE, HU, RO, DE, UK, US)' : 'n/a'}",
    "HR Contact": "${hasJobText ? 'Contact name from job ad if present, else n/a' : 'n/a'}"
  },
  "jobs_extracted": [
    {
      "title": "Job title from CV",
      "company": "Company name",
      "start_date": "Parsed start date",
      "end_date": "Parsed end date or 'ongoing'",
      "location": "Location if available",
      "is_current": true/false,
      "overlaps_with": ["list of other job titles if concurrent"],
      "key_points": ["main achievements/responsibilities"]
    }
  ],
  "analysis": {
    "overall_score": "0-10",
    "ats_score": "0-10",
    "scenario_tags": ["array of readable scenario descriptions from Step 2"],
    "quick_wins": "• ... (moved inside cv_changes critical/advised/optional as noted)",
    "cv_format_analysis": "Evaluate CV length, structure, format for candidate's country. Include country-specific suggestions as natural text.",
    "cultural_fit": "Assess market norms fit with natural language guidance.",
    "red_flags": "• ...",
    "overall_commentary": "Detailed expert commentary—strengths, weaknesses, positioning.",
    "suitable_positions": "• ...",
    "career_arc": "1–4 sentence flattering but honest summary of career story.",
    "parallel_experience": "Side projects, speaking, teaching, certifications—use CV only.",
    "transferable_skills": "Skills from past jobs supporting pivot/target—quote exact CV phrases.",
    "style_wording": "Tone, professionalism, clarity—refer to CV wording directly.",
    "ats_keywords": "Detect strong/missing ATS terms, prioritizing job ad terms if available—quote exact CV and job ad phrases.",
    "action_items": {
      "cv_changes": {
        "critical": [
          /* include must-fix points and high priority quick wins here, as newline-separated bullet strings */
        ],
        "advised": [
          /* include advised improvements and keyword integration plan items as bullet strings */
        ],
        "optional": [
          /* minor fixes and optional keyword integration as bullet strings */
        ]
      },
      "Cover Letter": {
        "Points to Address": [
          /* critical cover letter points from original critical_points_to_address */
        ],
        "Narrative Flow": [
          /* suggested narrative structure for cover letter */
        ],
        "Tone and Style": [
          /* style guidance drawn from CV style analysis */
        ]
      }
    }
  },
  "job_match": {
    "keyword_match": "${hasJobText ? 'Exact and near matches (e.g., \"Frontend\" vs \"FE\") between CV and job ad' : 'n/a'}",
    "inferred_keywords": "${hasJobText ? 'Keywords/synonyms to add/emphasize for better matching' : 'n/a'}",
    "career_scenario": "${hasJobText ? 'One readable scenario description like: standard progression, career pivot, overqualified candidate, major career transition' : 'n/a'}",
    "positioning_strategy": "${hasJobText ? 'Specific strategy—emphasize/reframe/de-emphasize CV content; quote exact phrases' : 'n/a'}"
  },
  "final_thought": "Motivational closing—practical, optimistic, tailored to scenario.",
  "generation_framework": {
    /* unchanged, machine-readable blueprint as before */
  }
}

CV Content:
${cvText}

${hasJobText ? `
Job Advertisement:
${jobText}
` : ''}
`
  };

  return [systemMessage, userMessage];
}
