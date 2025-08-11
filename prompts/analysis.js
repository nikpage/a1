export function buildAnalysisPrompt(cvText, jobText, hasJobText) {
  const systemMessage = {
    role: 'system',
    content: `You are an expert HR strategist and storyteller. Your task is to analyze a CV and job description, providing an honest critique and an actionable roadmap. Your feedback must be insightful, critical where necessary, but always empowering. Use only the provided CV and job ad content. The language of your entire output must match the detected language of the CV.`
  };

  const userMessage = {
    role: 'user',
    content: `
First, detect the CV's language and use it for all output. Then, parse all employment experiences from the CV (title, company, start/end dates, location, responsibilities) and list them chronologically, most recent first.

Next, classify the candidate's career scenario by applying one or more of the following readable tags: experienced professional, entry level candidate, career returner, employment gap present, standard progression, career pivot, overqualified candidate, major career transition, concurrent roles. Use these tags to inform your analysis.

Perform a strategic analysis of the CV against the job description (if provided). All bullet points in your output must use the "•" character followed by a space. The 'action_items' object must contain a comprehensive summary of all actionable advice from your analysis. The 'master_plan' section must be removed, and its points merged into 'action_items.cv_changes' based on priority ('critical', 'advised', 'optional'). The 'cover_letter_guidance' section must be renamed to 'Cover Letter', and its keys renamed to 'Points to Address' and 'Narrative Flow'.

Finally, based on your analysis, create the machine-readable 'generation_framework' and return a single, strictly valid JSON object with the exact structure and keys specified below. Do not use any markdown formatting within the JSON string values.

// REQUIRED JSON OUTPUT STRUCTURE:
{
  "summary": "1–2 sentence TL;DR.",
  "cv_data": { "Name": "...", "Seniority": "...", "Industry": "...", "Country": "..." },
  "job_data": { "Position": "${hasJobText ? '...' : 'n/a'}", "Seniority": "${hasJobText ? '...' : 'n/a'}", "Company": "${hasJobText ? '...' : 'n/a'}", "Industry": "${hasJobText ? '...' : 'n/a'}", "Country": "${hasJobText ? '...' : 'n/a'}", "HR Contact": "${hasJobText ? '...' : 'n/a'}" },
  "jobs_extracted": [ { "title": "...", "company": "...", "start_date": "...", "end_date": "...", "location": "...", "is_current": true/false, "overlaps_with": [], "key_points": [] } ],
  "analysis": {
    "overall_score": "0-10",
    "ats_score": "0-10",
    "scenario_tags": [],
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
      "cv_changes": { "critical": [], "advised": [], "optional": [] },
      "Cover Letter": { "Points to Address": [], "Narrative Flow": [], "Tone and Style": [] }
    }
  },
  "job_match": { "keyword_match": "${hasJobText ? '...' : 'n/a'}", "inferred_keywords": "${hasJobText ? '...' : 'n/a'}", "career_scenario": "${hasJobText ? '...' : 'n/a'}", "positioning_strategy": "${hasJobText ? '...' : 'n/a'}" },
  "final_thought": "...",
  "generation_framework": { /* machine-readable blueprint */ }
}

// PROVIDED DATA:
CV Content:
${cvText}

${hasJobText ? `Job Advertisement:\n${jobText}` : ''}
`
  };

  return [systemMessage, userMessage];
}
