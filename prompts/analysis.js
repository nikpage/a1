// prompts/analysis.js

export function buildAnalysisPrompt(cvText, jobText, hasJobText) {
  const systemMessage = {
    role: 'system',
    content: `Expert HR strategist: Deliver honest, actionable CV critiques in the CV's language (default: English). Use only provided CV/job content. Output narrative JSON: summary (TL;DR), cv_data (candidate), job_data (target), analysis (critique), job_match (fit), final_thought (motivation).`
  };

  const userMessage = {
    role: 'user',
    content: `
Detect CV language; use it for output.

Extract CV jobs (recent first): title, company, start/end dates ('ongoing' for current), location, key_points (string array).

Classify scenario (multiple): experienced, entry-level, career returner, employment gap, standard progression, pivot, overqualified, major transition, concurrent roles.

Analyze CV vs. job (if given). Output simple JSON—no markdown, bullets, special chars, or placeholders (use '', infer values). Lists as string arrays. Ensure substantive, specific content.

{
  "summary": "1-2 sentence overview (20+ chars).",
  "cv_data": {"Name":"","Seniority":"Junior/Mid/Senior","Industry":"","Country":"Prioritize CZ/PL/UE/HU/RO"},
  "job_data": {"Position":"","Seniority":"","Company":"","Industry":"","Country":"","HR Contact":""},
  "jobs_extracted": [{"title":"","company":"","start_date":"","end_date":"","location":"","key_points":[]}],
  "analysis": {
    "overall_score": "0-10",
    "ats_score": "0-10",
    "scenario_tags": [],
    "cv_format_analysis": "Format notes.",
    "cultural_fit": "Market fit notes.",
    "red_flags": [],
    "overall_commentary": "Detailed critique (50+ chars).",
    "suitable_positions": [],
    "career_arc": "1-4 sentence story.",
    "parallel_experience": "Side projects/certifications.",
    "transferable_skills": "Skills for target role.",
    "style_wording": "Tone notes.",
    "ats_keywords": "Keyword analysis.",
    "action_items": {
      "cv_changes": {"critical":[],"advised":[],"optional":[]},
      "Cover Letter": {"Points to Address":[],"Narrative Flow":[],"Tone and Style":[]}
    }
  },
  "job_match": {
    "keyword_match": "Keyword fit.",
    "inferred_keywords": "Keywords to add.",
    "career_scenario": "Relevant scenario.",
    "positioning_strategy": "Candidate positioning."
  },
  "final_thought": "Motivational note (30+ chars)."
}

CV Content:
${cvText}
${hasJobText ? `Job Ad: ${jobText}` : ''}
`
  };

  return [systemMessage, userMessage];
}
