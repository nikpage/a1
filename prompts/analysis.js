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
7. Produce a 'generation_framework' — a concrete rewrite blueprint the CV writer will execute directly. Be specific and decisive: name exact jobs to include/condense/rewrite, draft the actual summary text, list the exact skills to highlight.
8. Return VALID JSON only — no comments, no trailing commas, no markdown.

STRICT SCENARIO LIST (Choose 1-2):
- Recent Grad
- Job Returner
- Older Applicant
${hasJobText ? `- Overqualified\n- Under-qualified\n- Career Pivot\n- Major Pivot\n- Standard Career Progression` : ''}

FIELD INSTRUCTIONS (apply when filling the schema below):
- analysis.cv_format_analysis: MUST include review of length, style, and design
- analysis.cultural_fit: review CV against customs of the JOB's country
- analysis.style_wording: MUST include length-related advice
- analysis.action_items.cv_changes.critical: MUST include length reduction if needed
- job_match.positioning_strategy: strategy heavily based on the scenario tags
- generation_framework.cv_blueprint.target_length_pages: e.g. "1 page" or "2 pages" based on seniority
- generation_framework.cv_blueprint.section_order: ordered list of section names the CV writer must follow
- generation_framework.cv_blueprint.job_selection.include_jobs: job titles+company to include with full detail
- generation_framework.cv_blueprint.job_selection.condense_jobs: job titles+company to summarise in 1-2 lines
- generation_framework.cv_blueprint.job_selection.rewrite_jobs: job titles+company to reframe/reposition entirely
- generation_framework.cv_blueprint.summary_rewrite: WRITE THE ACTUAL SUMMARY TEXT HERE — max 3 sentences, impact-first, no "Seeking to" or "Looking to" openers, no repeated phrases, ready to paste verbatim
- generation_framework.cv_blueprint.skills_to_highlight: 8-12 specific skills drawn from transferable_skills and ats_keywords, ordered by relevance

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
    "cv_format_analysis": "",
    "cultural_fit": "",
    "red_flags": "",
    "overall_commentary": "",
    "suitable_positions": "",
    "career_arc": "",
    "parallel_experience": "",
    "transferable_skills": "",
    "style_wording": "",
    "ats_keywords": "",
    "action_items": {
      "cv_changes": {
        "critical": [],
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
    "positioning_strategy": ""
  },
  "generation_framework": {
    "cv_blueprint": {
      "target_length_pages": "",
      "section_order": [],
      "job_selection": {
        "include_jobs": [],
        "condense_jobs": [],
        "rewrite_jobs": []
      },
      "summary_rewrite": "",
      "skills_to_highlight": []
    }
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
