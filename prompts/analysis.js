// prompts/analysis.js

export function buildAnalysisPrompt(cvText, jobText, hasJobText) {
  return [
    {
      role: 'system',
      content: `Expert HR strategist. Analyze the CV from an HR recruiter's perspective. Provide honest, critical feedback on how the CV is perceived and specific rewrite strategies to make it attractive. MUST use the CV's language for all output, even if the job ad is in another language. Base cultural norms on the job's country (fall back to EU norms if unknown).`
    },
    {
      role: 'user',
      content: `
ANALYSIS FRAMEWORK:
1. Detect CV language and use it consistently for all output.
2. Extract all jobs with: title, company, dates, location, achievements.
3. Identify the most recent country from the CV for 'cv_data.Country'.
4. Classify primary career scenario (choose 1-2 MAX from strict list below).
5. Provide a 'positioning_strategy' that directly addresses the chosen scenario(s).
6. Critically review CV length, style, and format (e.g., 8-page CV must be addressed).
7. Return exact JSON schema.

STRICT SCENARIO LIST (Choose 1-2):
- Recent Grad
- Job Returner
- Older Applicant
${hasJobText ? `- Overqualified\n- Under-qualified\n- Career Pivot\n- Major Pivot\n- Standard Career Progression` : ''}

JSON OUTPUT SCHEMA:
{
  "summary": "",
  "cv_data": { "Name": "", "Seniority": "", "Industry": "", "Country": "" },
  "job_data": { "Position": "n/a", "Seniority": "n/a", "Company": "n/a", "Industry": "n/a", "Country": "n/a", "HR Contact": "" },
  "jobs_extracted": [],
  "analysis": {
    "overall_score": "0-10",
    "ats_score": "0-10",
    "scenario_tags": [],
    "cv_format_analysis": "", // MUST include review of length, style, design
    "cultural_fit": "", // Review of CV against customs of the JOB's country
    "red_flags": "",
    "overall_commentary": "",
    "suitable_positions": "",
    "career_arc": "",
    "parallel_experience": "",
    "transferable_skills": "",
    "style_wording": "", // MUST include length-related advice
    "ats_keywords": "",
    "action_items": {
      "cv_changes": {
        "critical": [], // MUST include length reduction if needed
        "advised": [],
        "optional": []
      },
      "Cover Letter": {
        "Points to Address": [],
        "Narrative Flow": [],
        "Tone and Style": []
      }
    }
  },
  "job_match": {
    "keyword_match": "n/a",
    "inferred_keywords": "n/a",
    "career_scenario": "n/a",
    "positioning_strategy": "" // Strategy heavily based on the scenario tags
  },
  "final_thought": ""
}

CV CONTENT:
${cvText}

${hasJobText ? `JOB DESCRIPTION:\n${jobText}` : ''}
`.trim()
    }
  ];
}
