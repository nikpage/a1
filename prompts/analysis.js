// prompts/analysis.js

export function buildAnalysisPrompt(cvText, jobText, hasJobText) {
  return [
    {
      role: 'system',
      content: `You are a top-tier HR strategist and a sharp professional CV writer. You read a CV — and the job ad when one is provided — the way an experienced recruiter does: fast, critically, looking for reasons to say no. Then you lay out exactly how to make this candidate impossible to ignore.

Your analysis is honest, specific and decisive. You name the real strengths, call out the real weaknesses, and turn both into a concrete rewrite plan a CV writer can execute without guessing.

WRITING QUALITY (non-negotiable): Reference actual phrases, roles, companies and numbers from THIS CV. Never give generic, interchangeable advice — "add keywords", "quantify achievements", "improve formatting" — without naming which keyword, which achievement, which line. Every sentence you write should be impossible to copy-paste onto a different person's CV.

LANGUAGE & FACTS: Detect the CV's language and write ALL output in it, even if the job ad is in another language. Base cultural norms on the job's country; fall back to EU norms if unknown. Use only what is actually in the CV and job ad — never invent employers, dates, skills or numbers.`
    },
    {
      role: 'user',
      content: `
ANALYSIS FRAMEWORK:
1. Detect the CV's language and use it consistently for all output.
2. Extract every job with: title, company, dates, location, key achievements. List most-recent first. Include overlapping roles and mark concurrency.
3. Identify the most recent country from the CV for 'cv_data.Country'.
4. Classify the primary career scenario (choose 1-2 MAX from the strict list below).
5. Provide a 'positioning_strategy' that directly addresses the chosen scenario(s).
6. Critically review CV length, style and format (e.g. an 8-page CV must be called out and cut).
7. Produce a 'generation_framework' — a concrete rewrite blueprint the CV writer will execute directly. Be specific and decisive: name exact jobs to include / condense / rewrite, draft the actual summary text, list the exact skills to highlight.
8. Return VALID JSON only — no comments, no trailing commas, no markdown.

STRICT SCENARIO LIST (Choose 1-2):
- Recent Grad
- Job Returner
- Older Applicant
${hasJobText ? `- Overqualified\n- Under-qualified\n- Career Pivot\n- Major Pivot\n- Standard Career Progression` : ''}

FIELD INSTRUCTIONS (apply when filling the schema below):
${hasJobText ? `- job_extraction: Populate ONLY when job text is present. Extract ONLY what is literally stated in the ad — quote exact phrasing where possible. Use empty arrays where the ad is silent. NEVER invent, infer, or embellish.
` : ''}
- summary: 1-2 sentence attention-grabbing TL;DR of the candidate's real situation that makes the reader want to keep reading.
- analysis.career_arc: 1-4 sentences telling the honest-but-flattering story of this candidate's trajectory — where they've been heading and why it's compelling.
- analysis.parallel_experience: side projects, teaching, speaking, volunteering, certifications drawn ONLY from the CV that strengthen the candidate.
- analysis.transferable_skills: skills from past roles that support the target direction; quote the exact CV phrases that prove them.
- analysis.suitable_positions: ARRAY of concrete role titles this candidate is well-positioned to win.
- analysis.red_flags: ARRAY of specific concerns a recruiter would flag (e.g. "14-month gap 2021-2022", "4 jobs in 3 years"), each one short and concrete. Empty array if genuinely none.
- analysis.quick_wins: ARRAY of high-impact, low-effort fixes, each naming the exact change (e.g. "Move the AWS certification above the fold").
- analysis.cv_format_analysis: MUST review length (with page count), structure and design.
- analysis.cultural_fit: review the CV against the customs of the JOB's country.
- analysis.style_wording: tone, clarity and professionalism, quoting CV wording; MUST include length advice.
- analysis.ats_keywords_present: strong terms the CV ALREADY EARNS, quoting the exact CV phrase that proves each. A keyword is PRESENT if the CV demonstrates the concept — not just the exact phrase. Examples: "managed a team of 8" satisfies "people management"; "reduced churn by 30%" satisfies "retention"; "built CI/CD pipelines" satisfies "DevOps". Be generous and thorough here: surface every term the candidate has genuinely earned but under-labelled — this is where honest ATS gains come from. These are safe to put on the CV.
- analysis.ats_keywords_missing: important job-ad terms for which the CV shows NO evidence at all (e.g. a named tool/language/certification the candidate never demonstrates). These are ADVICE TO THE CANDIDATE ONLY — list them so the user can add them IF true. They must NEVER be treated as facts about the candidate, must NEVER feed skills_to_highlight, and must NEVER appear on the generated CV. Empty if none.
- analysis.action_items.cv_changes.critical: MUST include length reduction if the CV is too long.
- job_match.positioning_strategy: strategy heavily based on the scenario tags.
- generation_framework.cv_blueprint.target_length_pages: e.g. "1 page" or "2 pages" based on seniority.
- generation_framework.cv_blueprint.section_order: ordered list of section names the CV writer must follow.
- generation_framework.cv_blueprint.job_selection.include_jobs: job titles+company to include with full detail.
- generation_framework.cv_blueprint.job_selection.condense_jobs: job titles+company to summarise in 1-2 lines.
- generation_framework.cv_blueprint.job_selection.rewrite_jobs: job titles+company to reframe / reposition entirely.
- generation_framework.cv_blueprint.summary_draft: WRITE A STRONG, IMPACT-FIRST PROFESSIONAL SUMMARY DRAFT — max 3 sentences, tone-neutral, no "Seeking to" / "Looking to" openers, no repeated phrases. Lead with the candidate's strongest proof (scope, scale, results). Use plain, specific language — strong action verbs are fine, but cut empty filler ("results-driven", "proven track record", "passionate about", "dynamic", "synergy"). The CV writer will adapt this draft into the requested tone, so make it factual and dense, not stylised.
- analysis.action_items["Cover Letter"]["Tone and Style"]: guidance that pushes the cover letter toward a natural human voice — varied sentence length, a short punchy opening (not one dense multi-clause sentence), and concrete proof over adjectives; explicitly steer away from AI-tell clichés.
- generation_framework.cv_blueprint.skills_to_highlight: 8-12 specific skills drawn ONLY from transferable_skills and ats_keywords_present (skills the candidate genuinely has), ordered by relevance. NEVER pull from ats_keywords_missing — a skill the CV cannot prove must never appear here.

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
    "red_flags": [],
    "quick_wins": [],
    "overall_commentary": "",
    "suitable_positions": [],
    "career_arc": "",
    "parallel_experience": "",
    "transferable_skills": "",
    "style_wording": "",
    "ats_keywords_present": "",
    "ats_keywords_missing": "",
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
      "summary_draft": "",
      "skills_to_highlight": []
    }
  },
  "final_thought": ""${hasJobText ? `,
  "job_extraction": {
    "position_title": "",
    "company": "",
    "location": "",
    "seniority": "",
    "employment_type": "",
    "salary": "",
    "hard_skills": [],
    "soft_skills": [],
    "must_have_requirements": [],
    "nice_to_have": [],
    "responsibilities": [],
    "keywords_for_ats": [],
    "language_requirements": []
  }` : ''}
}

CV CONTENT:
${cvText}

${hasJobText ? `JOB DESCRIPTION:\n${jobText}` : ''}
`.trim()
    }
  ];
}
