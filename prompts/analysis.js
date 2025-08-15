Got it. Here’s the updated `prompts/analysis.js` reflecting your requirements (language mirroring CV, consolidated keywords, cultural-fit focus, unlimited specific action plan, stronger cover-letter guidance, no page-cutting, brutally-honest-but-positive tone, scenario-aware, extreme pivot note once).

```js
// prompts/analysis.js

export function buildAnalysisPrompt(cvText, jobText, hasJobText) {
  const systemMessage = {
    role: 'system',
    content: `You are a senior HR strategist. Deliver a professional, evidence-based critique of a CV (and job ad if provided). Use only provided content; never invent facts. Quote exact CV/job phrases when supporting claims. Write the entire response in the same language as the CV text (mirror CV language automatically). Be candid and precise while maintaining a constructive, positive tone. If the candidate is making an extreme pivot, you may note once if the pivot is likely too far; otherwise focus on maximizing their potential within the pivot. Do not recommend shortening page count.`
  };

  const userMessage = {
    role: 'user',
    content: `
/ STEP 1: PARSE PRE-EXTRACTED DATA OR EXTRACT AS A BACKUP
If headers like "--- [Extracted Experience Section] ---" exist, use their content directly. Do not re-parse the "[Remaining CV Text]". If such headers do not exist, extract title, company, start date, end date or "ongoing", location, key points from raw text. Order jobs most-recent-first and explicitly note overlaps and gaps (>6 months).

/ STEP 2: DETECT CAREER SCENARIO (LABELS ONLY)
Assign applicable labels (capitalize in output):
Older Candidate, Entry Level Candidate, Career Returner, Standard Progression, Career Pivot, Overqualified Candidate, Extreme Pivot.
Mutually exclusive pairs: (Entry Level Candidate ↔ Overqualified Candidate), (Standard Progression ↔ Extreme Pivot).
Use these tags to guide priorities and tone.

/ STEP 3: STRATEGIC ANALYSIS
Provide a professional, top-level analysis like a human CV analyst would write. Focus on CV quality, positioning, and market fit. Use country nuance: recognize candidate country and job country (if job ad present) and advise on country-specific expectations. Cultural Fit must comment on CV style relative to target country norms. Be detailed and brutally honest but constructive. Do not suggest shortening for page count. Build a specific, unbounded action plan with concrete edits (e.g., which roles to condense into one). Cover-letter guidance must integrate scenario, red flags, highlights to emphasize, and maximize fit for the included job if present.

/ OUTPUT STRICT JSON (no markdown)
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
    "cultural_fit": "Commentary on CV style vs target country norms with quoted evidence.",
    "country_nuances": "Specific do/don't advice for the candidate's country and the job's country (if provided).",
    "red_flags": "Newline-separated list of concerns (with quoted evidence).",
    "overall_commentary": "Detailed professional commentary with quoted evidence.",
    "suitable_positions": "Newline-separated list of roles aligned to evidence.",
    "career_arc": "1–4 sentence honest, flattering career story.",
    "parallel_experience": "Side projects/speaking/certifications from CV only.",
    "transferable_skills": "Evidence-backed skills; quote phrases.",
    "style_wording": "Tone/clarity observations; quote phrasing.",
    "keywords": {
      "matched": ${hasJobText ? '"Exact/near matches between CV and job ad keywords."' : '"n/a"'},
      "inferred": ${hasJobText ? '"Synonyms/related terms to add for better matching."' : '"n/a"'}
    },
    "action_plan": {
      "cv_changes": {
        "critical": [],
        "advised": [],
        "optional": []
      },
      "condense_roles": ["List specific older/less relevant roles to merge into one line or a compact cluster."],
      "cover_letter": {
        "points_to_address": [],
        "narrative_focus": [],
        "tone_and_style": []
      }
    }
  },
  "job_match": {
    "career_scenario": ${hasJobText ? '"One label from STEP 2 most representative for positioning."' : '"n/a"'},
    "positioning_strategy": ${hasJobText ? '"What to emphasize/de-emphasize with quoted evidence from CV and job ad."' : '"n/a"'}
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
```
