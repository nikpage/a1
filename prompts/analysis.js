// prompts/analysis.js

export function buildAnalysisPrompt(cvText, jobText, hasJobText) {
  const systemMessage = {
    role: 'system',
    content: `You are an expert HR strategist providing honest, insightful CV critiques and actionable roadmaps. Output exclusively in the CV's detected language (default: English). Use only provided CV/job content. Structure as a narrative: summary (TL;DR), cv_data (candidate intro), job_data (target), analysis (critique), job_match (fit), final_thought (motivation).`
  };

  const userMessage = {
    role: 'user',
    content: `
Detect CV language and use it for all output.

Extract all jobs from CV chronologically (recent first): title, company, start/end dates ('ongoing' for current), location, key_points as string array.

Classify scenario (multiple OK): experienced professional, entry level, career returner, employment gap, standard progression, career pivot, overqualified, major transition, concurrent roles.

Analyze CV vs. job (if provided). Output simple JSON only—no bullets, markdown, special chars, placeholders (e.g., no 'n/a'—use '' or infer). Lists as plain string arrays.

{
  "summary": "1-2 sentence TL;DR.",
  "cv_data": {
    "Name": "Full name",
    "Seniority": "Junior/Mid/Senior",
    "Industry": "From CV",
    "Country": "Prioritize CZ/PL/UE/HU/RO"
  },
  "job_data": {
    "Position": "Title or ''",
    "Seniority": "Extracted or ''",
    "Company": "Name or ''",
    "Industry": "Or ''",
    "Country": "Or ''",
    "HR Contact": "Or ''"
  },
  "jobs_extracted": [{"title":"","company":"","start_date":"","end_date":"","location":"","key_points":[]}],
  "analysis": {
    "overall_score": "0-10",
    "ats_score": "0-10",
    "scenario_tags": ["Tags"],
    "cv_format_analysis": "Format comments.",
    "cultural_fit": "Market fit.",
    "red_flags": ["Flags"],
    "overall_commentary": "Detailed commentary (min 50 chars).",
    "suitable_positions": ["Positions"],
    "career_arc": "1-4 sentence arc.",
    "parallel_experience": "Side elements.",
    "transferable_skills": "Skills analysis.",
    "style_wording": "Tone comments.",
    "ats_keywords": "Keywords analysis.",
    "action_items": {
      "cv_changes": {"critical":[],"advised":[],"optional":[]},
      "Cover Letter": {"Points to Address":[],"Narrative Flow":[],"Tone and Style":[]}
    }
  },
  "job_match": {
    "keyword_match": "Matches.",
    "inferred_keywords": "To add.",
    "career_scenario": "Scenario.",
    "positioning_strategy": "Strategy."
  },
  "final_thought": "Motivational close (min 30 chars)."
}

CV Content:
${cvText}

${hasJobText ? `Job Advertisement: ${jobText}` : ''}
`
  };

  return [systemMessage, userMessage];
}
