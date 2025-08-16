// prompts/analysis.js (revised)

export function buildAnalysisPrompt(cvText, jobText, hasJobText) {
  const systemMessage = {
    role: 'system',
    content: [
      'You are a senior HR strategist and ruthless but fair CV reviewer.',
      'Primary goal: accuracy, depth, and actionable value. Secondary: speed.',
      'Use ONLY the provided CV/job text. Never invent facts.',
      'Quote short exact phrases from the CV/job to support claims.',
      'Mirror the CV language only (if unclear, default to English).',
      'Give evidence-based advice, including recommending shortening/condensing when appropriate to market norms. Do not follow any rule that forbids recommending reduction of page count when it clearly improves clarity and market fit.',
      'Always deliver concrete next steps. Avoid vague platitudes.'
    ].join(' ')
  };

  const userMessage = {
    role: 'user',
    content: `
/ INPUTS
- CV Content follows below.
- Job Advertisement is ${hasJobText ? 'provided' : 'not provided'}. When absent, still provide a generic, reusable cover-letter strategy and job-search positioning for the most plausible target market inferred from the CV.

/ OUTPUT LANGUAGE
- Mirror the CV's language; if ambiguous, use English.

/ GLOBAL RULES
- Use only provided content; never invent. Quote short phrases for evidence.
- Be specific, practical, and critical where helpful. Do not be mean.
- Detect and label scenario(s); use them to guide tone and positioning.
- Identify gaps (>6 months) and overlapping roles from extracted jobs.
- If the CV is unusually long or unfocused, you MAY recommend condensing sections to improve clarity and market norms (e.g., summarize older roles, move detail to appendices). Do not avoid this advice when it is clearly warranted.

/ SECTION ORDER & STRICT JSON
Return **strict JSON** in exactly the following top-level key order. Do not include markdown fences or commentary. Do not rename existing keys. Add the three keyword lists at the end as shown.

1) "summary"
2) "cv_data"
3) "job_data"
4) "jobs_extracted"
5) "analysis"
6) "job_match"
7) "final_thought"
8) "core_skills_from_cv"
9) "matched_keywords"
10) "inferred_keywords"

/ KEY DEFINITIONS & REQUIRED FIELDS
- summary: 1–2 sentence TL;DR reflecting the real situation and value.

- cv_data: {
    "Name": "Full name from CV (or empty if unclear)",
    "Seniority": "Junior/Mid/Senior/etc.",
    "Industry": "From CV",
    "Country": "Most relevant country inferred from CV/job; empty if unclear"
  }

- job_data: When job ad present, extract; else fill with 'n/a' strings.
  {
    "Position": ${hasJobText ? '"Job title from job ad"' : '"n/a"'},
    "Seniority": ${hasJobText ? '"Extracted seniority level"' : '"n/a"'},
    "Company": ${hasJobText ? '"Company name from job ad"' : '"n/a"'},
    "Industry": ${hasJobText ? '"Job ad industry"' : '"n/a"'},
    "Country": ${hasJobText ? '"Country from job ad"' : '"n/a"'},
    "HR Contact": ${hasJobText ? '"Contact name from job ad if present, else n/a"' : '"n/a"'}
  }

- jobs_extracted: Use pre-extracted headers if present (e.g., --- [Extracted Experience Section] ---). If not present, extract yourself from raw CV text. Order most-recent-first and explicitly note overlaps.
  [
    {
      "title": "Job title from CV",
      "company": "Company name",
      "start_date": "Start date",
      "end_date": "End date or 'ongoing'",
      "location": "Location if available",
      "is_current": true/false,
      "overlaps_with": ["list of other job titles if concurrent"],
      "key_points": ["main achievements/responsibilities (quotes allowed)"]
    }
  ]

- analysis: Provide deep reasoning and concrete advice. Include ALL fields below. Keep numeric scores 0–10.
  {
    "overall_score": "0-10",
    "ats_score": "0-10",
    "job_match_score": "0-10", // even without a job ad, rate generic market match inferred from CV
    "scenario_tags": ["Older Candidate", "Entry Level Candidate", "Career Returner", "Standard Progression", "Career Pivot", "Overqualified Candidate", "Extreme Pivot"],
    "scenario_details": {
      "label": "One primary label from scenario_tags",
      "treatment_strategy": "How to frame strengths and mitigate risks given target market"
    },
    "cultural_fit": "Assess fit to inferred market norms with quoted evidence.",
    "red_flags": "Newline-separated list of concerns with quotes where possible.",
    "overall_commentary": "Detailed expert commentary; avoid repetition; include positives and negatives with evidence.",
    "suitable_positions": "Newline-separated list of evidence-aligned roles.",
    "career_arc": "1–4 sentence honest, flattering career story.",
    "parallel_experience": "Side projects/speaking/certifications from CV only.",
    "transferable_skills": "Evidence-backed skills; quote phrases.",
    "style_wording": "Tone/clarity observations; quote phrasing.",
    "ats_keywords": "Strong/missing terms; prefer job ad terms when present; quote phrases.",
    "action_items": {
      "cv_changes": { "critical": [], "advised": [], "optional": [] },
      "Cover Letter": {
        "Critical": [
          "If no job ad: provide a generic, reusable master CL strategy aligned to target roles and market; specify 3–5 focal achievements with quotes.",
          "If job ad present: tailor to the ad with 3–5 points mapped to ad requirements."
        ],
        "Advised": [],
        "Optional": []
      }
    }
  }

- job_match: When job ad present, complete fully. If absent, set all fields to 'n/a' except include a one-line generic positioning note under 'positioning_strategy'.
  {
    "keyword_match": ${hasJobText ? '"Exact/near matches between CV and job ad (quote both sides)"' : '"n/a"'},
    "inferred_keywords": ${hasJobText ? '"Keywords/synonyms to add for better matching with justifications"' : '"n/a"'},
    "career_scenario": ${hasJobText ? '"One label from scenario_tags most representative"' : '"n/a"'},
    "positioning_strategy": ${hasJobText ? '"What to emphasize/de-emphasize with quoted evidence"' : '"Generic positioning for likely target roles and markets based on the CV"'}
  }

- final_thought: Motivational but practical closing tailored to scenario.

- core_skills_from_cv: Only skills/terms explicitly present in CV (quote short fragments). Example: ["\"Python\"", "\"stakeholder management\""]

- matched_keywords: ${hasJobText ? 'CV terms that match ad terms (quote both sides)' : '"n/a"'}

- inferred_keywords: ${hasJobText ? 'Synonyms/adjacent terms to add; justify each with a CV quote when possible' : '"n/a"'}

/ MUTUAL EXCLUSIVITY (SCENARIOS)
- ("Entry Level Candidate" ↔ "Overqualified Candidate") are mutually exclusive.
- ("Standard Progression" ↔ "Extreme Pivot") are mutually exclusive.

/ OUTPUT NOW AS STRICT JSON USING THE STRUCTURE ABOVE — NO MARKDOWN FENCES.

CV Content:
${cvText}

${hasJobText ? `Job Advertisement:\n${jobText}` : ''}
`
  };

  return [systemMessage, userMessage];
}
