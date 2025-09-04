// prompts/analysis.js

export function buildAnalysisPrompt(cvText, jobText, hasJobText) {
  const systemMessage = {
    role: 'system',
    content: `You are an expert HR strategist and storyteller. Your role is to analyze a CV and job description, crafting a narrative that is an honest critique and actionable roadmap. Feedback must be insightful, critical where necessary, but always empowering. Identify weaknesses but focus on a clear success strategy. All output must match the CV's detected language (fallback to English if unclear). If the job ad is in a different language, prioritize CV language. Use only provided CV and job ad content—never invent information.

NARRATIVE FLOW: Write sections as a story: summary as engaging TL;DR, cv_data introduces the candidate, job_data shows the target, analysis evaluates presentation, job_match shows fit, final_thought motivates. Each feels like a chapter.

WRITING QUALITY: Reference specific CV phrases and experiences. Be specific, actionable, and avoid generic examples. Make all guidance sound intentional and professional, not like coding elements.`
  };

  const userMessage = {
    role: 'user',
    content: `
// STEP 0: DETECT LANGUAGE
Detect the CV's language. All output, including field labels, summaries, and commentary, must be in this language. If detection fails, default to English. If the job ad is in another language, CV language takes precedence.

// STEP 1: EXTRACT JOBS WITH DATES
Parse all employment experiences from the CV. For each job, extract:
- Exact job title
- Company name
- Start date
- End date (or "ongoing")
- Location if available
- Key responsibilities/achievements

List jobs in reverse chronological order. Include overlaps and mark them clearly.

// STEP 2: DETECT CAREER SCENARIO
Classify the candidate's situation using readable descriptions:
- experienced professional
- entry level candidate
- career returner
- employment gap present
- standard progression
- career pivot
- overqualified candidate
- major career transition
- concurrent roles
A candidate can have multiple tags. Use these to guide tone and analysis.

// STEP 3: STRATEGIC ANALYSIS
Critically analyze the CV in context of the job (if provided). Always provide critical action items. Reference only real CV content. Identify real employment gaps and overlaps.

Ensure the 'action_items' object contains comprehensive, clear bullet points.
Each bullet point must begin with exactly one bullet character "•". Do not add extra bullets. No markdown.


All bullet points inside string values must use the bullet character "•" and line breaks. No markdown.

// STEP 4: OUTPUT STRICT JSON
Return a single strict JSON object with these top-level keys exactly:

{
  "summary": "...",
  "cv_data": {
    "Name": "...",
    "Seniority": "...",
    "Industry": "...",
    "Country": "..."
  },
  "job_data": {
    "Position": "${hasJobText ? '...' : 'n/a'}",
    "Seniority": "${hasJobText ? '...' : 'n/a'}",
    "Company": "${hasJobText ? '...' : 'n/a'}",
    "Industry": "${hasJobText ? '...' : 'n/a'}",
    "Country": "${hasJobText ? '...' : 'n/a'}",
    "HR Contact": "${hasJobText ? '...' : 'n/a'}"
  },
  "jobs_extracted": [
    {
      "title": "...",
      "company": "...",
      "start_date": "...",
      "end_date": "...",
      "location": "...",
      "is_current": true/false,
      "overlaps_with": ["..."],
      "key_points": ["..."]
    }
  ],
  "analysis": {
    "overall_score": "0-10",
    "ats_score": "0-10",
    "scenario_tags": ["..."],
    "cv_format_analysis": "...",
    "cultural_fit": "...",
    "red_flags": "• ...",
    "overall_commentary": "...",
    "suitable_positions": "• ...",
    "career_arc": "...",
    "parallel_experience": "...",
    "transferable_skills": "...",
    "style_wording": "...",
    "ats_keywords": "...",
    "action_items": {
      "cv_changes": {
        "critical": ["• ..."],
        "advised": ["• ..."],
        "optional": ["• ..."]
      },
      "Cover Letter": {
        "Points to Address": ["• ..."],
        "Narrative Flow": ["• ..."],
        "Tone and Style": ["• ..."]
      }
    }
  },
  "job_match": {
    "keyword_match": "${hasJobText ? '...' : 'n/a'}",
    "inferred_keywords": "${hasJobText ? '...' : 'n/a'}",
    "career_scenario": "${hasJobText ? '...' : 'n/a'}",
    "positioning_strategy": "${hasJobText ? '...' : 'n/a'}"
  },
  "final_thought": "..."
}

CV Content:
${cvText}

${hasJobText ? `Job Advertisement:\n${jobText}` : ''}
`
  };

  return [systemMessage, userMessage];
}
