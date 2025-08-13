// prompts/analysis.js

// prompts/analysis.js

export function buildAnalysisPrompt(cvText, jobText, hasJobText) {
  const systemMessage = {
    role: 'system',
    content: `You are an expert HR analyst. Your job: parse the CV and optional job ad, then return a strict JSON analysis.
Use the CV's detected language (fallback to English if unclear; CV language takes priority over job ad).
Do not invent facts or change dates. Keep overlapping roles. Mark ongoing jobs when end date is absent or terms like "Present"/"Current" are used.`
  };

  const userMessage = {
    role: 'user',
    content: `
1. Detect CV language. All labels and text in that language.
2. Extract all employment experiences:
   - title, company, start_date, end_date (or "ongoing"), location, is_current, overlaps_with, key_points.
   - Keep all jobs, even overlaps. Mark overlaps explicitly.
3. Classify career scenario(s) from the given list.
4. Analyze CV in context of job ad (if provided). Reference only real CV content. Identify actual employment gaps (>6 months) from extracted dates.
5. Return strict JSON using this structure:

{
  "summary": "...",
  "cv_data": { "Name": "...", "Seniority": "...", "Industry": "...", "Country": "..." },
  "job_data": {
    "Position": ${hasJobText ? '"Job title from job ad"' : '"n/a"'},
    "Seniority": ${hasJobText ? '"Extracted seniority level"' : '"n/a"'},
    "Company": ${hasJobText ? '"Company name from job ad"' : '"n/a"'},
    "Industry": ${hasJobText ? '"Job ad industry"' : '"n/a"'},
    "Country": ${hasJobText ? '"Country from job ad"' : '"n/a"'},
    "HR Contact": ${hasJobText ? '"Contact name from job ad or n/a"' : '"n/a"'}
  },
  "jobs_extracted": [
    {
      "title": "...",
      "company": "...",
      "start_date": "YYYY-MM or detail",
      "end_date": "YYYY-MM or 'ongoing'",
      "location": "...",
      "is_current": true,
      "overlaps_with": ["..."],
      "key_points": ["..."]
    }
  ],
  "analysis": {
    "overall_score": "0-10",
    "ats_score": "0-10",
    "scenario_tags": ["..."],
    "quick_wins": "• ...",
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
    "keyword_match": ${hasJobText ? '"...matches..."' : '"n/a"'},
    "inferred_keywords": ${hasJobText ? '"...to add..."' : '"n/a"'},
    "career_scenario": ${hasJobText ? '"...scenario..."' : '"n/a"'},
    "positioning_strategy": ${hasJobText ? '"...strategy..."' : '"n/a"'}
  },
  "final_thought": "...",
  "generation_framework": { /* unchanged */ }
}

CV:
${cvText}

${hasJobText ? `Job Advertisement:\n${jobText}` : ''}
`
  };

  return [systemMessage, userMessage];
}
