// prompts/analysis.js

export function buildAnalysisPrompt(cvText, jobText, hasJobText) {
  const systemMessage = {
    role: 'system',
    content: `You are a senior HR strategist. Deliver an expert, evidence-based critique of a CV (and job ad if provided). Be specific, practical, and critical where needed. Use only provided content; never invent facts. Quote exact CV/job phrases when supporting claims.`
  };

  const userMessage = {
    role: 'user',
    content: `
    / STEP 1: PARSE PRE-EXTRACTED DATA OR EXTRACT AS A BACKUP
    // The CV content below may be pre-processed with headers like "--- [Extracted Experience Section] ---".
    // IF these headers exist, your primary task is to use the content within them directly. Do NOT re-parse the "[Remaining CV Text]".
    // IF these headers DO NOT exist, then as a backup, perform the extraction yourself from the raw text: Extract title, company, start date, end date or "ongoing", location, key points.
    // Finally, order the extracted jobs most-recent-first and explicitly note any overlaps.

// STEP 2: DETECT CAREER SCENARIO (LABELS ONLY)
Assign any that apply (capitalize in output):
Older Candidate, Entry Level Candidate, Career Returner, Standard Progression, Career Pivot, Overqualified Candidate, Extreme Pivot.
Constraints: mutually exclusive pairs include (Entry Level Candidate ↔ Overqualified Candidate), (Standard Progression ↔ Extreme Pivot). Use tags to guide priorities and tone.

// STEP 3: STRATEGIC ANALYSIS (DEEP REASONING)
Provide an expert critique with concrete, high-impact advice. Cover strengths, weaknesses, ATS risks, market fit, and positioning. Always provide actionable next steps, even for mismatches. Quote exact lines when relevant. Identify real gaps (>6 months) and overlapping roles using the extracted list.

// OUTPUT STRICT JSON (no markdown/code blocks). Mechanical formatting/renaming is handled externally.
{
  "summary": "1–2 sentence TL;DR reflecting the real situation and value.",
  "cv_data": {
    "Name": "Full name from CV",
    "Seniority": "Junior/Mid/Senior/etc.",
    "Industry": "Industry from CV",
    "Country": "Most relevant country inferred from CV/job; leave empty if unclear"
  },
  "job_data": {
    "Position": "${hasJobText ? 'Job title from job ad' : 'n/a'}",
    "Seniority": "${hasJobText ? 'Extracted seniority level' : 'n/a'}",
    "Company": "${hasJobText ? 'Company name from job ad' : 'n/a'}",
    "Industry": "${hasJobText ? 'Job ad industry' : 'n/a'}",
    "Country": "${hasJobText ? 'Country from job ad' : 'n/a'}",
    "HR Contact": "${hasJobText ? 'Contact name from job ad if present, else n/a' : 'n/a'}"
  },
  "jobs_extracted": [
    {
      "title": "Job title from CV",
      "company": "Company name",
      "start_date": "Start date",
      "end_date": "End date or 'ongoing'",
      "location": "Location if available",
      "is_current": true/false,
      "overlaps_with": ["list of other job titles if concurrent"],
      "key_points": ["main achievements/responsibilities"]
    }
  ],
  "analysis": {
    "overall_score": "0-10",
    "ats_score": "0-10",
    "scenario_tags": ["labels from STEP 2"],
    "cultural_fit": "Assess fit to inferred market norms with evidence.",
    "red_flags": "Newline-separated list of concerns...",
    "overall_commentary": "Detailed expert commentary with quoted evidence.",
    "suitable_positions": "Newline-separated list of evidence-aligned roles.",
    "career_arc": "1–4 sentence honest, flattering career story.",
    "parallel_experience": "Side projects/speaking/certifications from CV only.",
    "transferable_skills": "Evidence-backed skills; quote phrases.",
    "style_wording": "Tone/clarity observations; quote phrasing.",
    "ats_keywords": "Strong/missing terms; prefer job ad terms when present; quote phrases.",
    "action_items": {
      "cv_changes": { "critical": [], "advised": [], "optional": [] },
      "Cover Letter": { "Points to Address": [], "Narrative Flow": [], "Tone and Style": [] }
    }
  },
  "job_match": {
    "keyword_match": "${hasJobText ? 'Exact/near matches between CV and job ad' : 'n/a'}",
    "inferred_keywords": "${hasJobText ? 'Keywords/synonyms to add for better matching' : 'n/a'}",
    "career_scenario": "${hasJobText ? 'One label from STEP 2 most representative' : 'n/a'}",
    "positioning_strategy": "${hasJobText ? 'What to emphasize/de-emphasize with quoted evidence' : 'n/a'}"
  },
  "final_thought": "Motivational but practical closing."
}

CV Content:
${cvText}

${hasJobText ? `Job Advertisement:\n${jobText}` : ''}
`
  };

  return [systemMessage, userMessage];
}
