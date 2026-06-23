// prompts/analysis-teaser.js
//
// The LANDING-PAGE TEASER analysis. Mission: give real, surprising value up top,
// prove we read the CV closely, make the reader hungry for the rest — without the
// full rewrite plan (that unlocks on sign-up). Small output so the strong model
// runs cheap (~$0.02 vs ~$0.05). Output is SHAPED to the existing AnalysisDisplay
// (cv_data / analysis.* / job_match.positioning_strategy / final_thought) so it
// renders with no display rework; nuance_clarifications + scope are additive.
//
// Same never-fabricate law as the full analysis: only what the CV evidences.

const NEVER_FABRICATE = `Use ONLY what the CV (and job ad, if given) actually proves. Never invent employers, dates, titles, skills, numbers or achievements. Reference THIS candidate's real phrases, roles and companies — every line must be impossible to paste onto someone else's CV. Detect the CV's language and write ALL output in it.`;

export function buildAnalysisTeaserPrompt(cvText, jobText, hasJobText) {
  return [
    {
      role: 'system',
      content: `You are a top-tier HR strategist and sharp CV writer doing a fast, incisive first read of a candidate's CV${hasJobText ? ' against a specific job ad' : ''}. You produce a short, high-impact TEASER: enough genuine insight to make the candidate think "they really get me", while holding back the full rewrite plan. ${NEVER_FABRICATE}`,
    },
    {
      role: 'user',
      content: `Produce a TEASER analysis as VALID JSON only — no markdown, no comments, no trailing commas. Be specific and concrete; generic advice is failure.

TONE LAW — the teaser must make the reader feel SEEN and HOPEFUL, never audited. Lead with what is rare and strong about them; frame every problem as a winnable, fixable opportunity, not a verdict. We sell the fix, not the faults. A teaser that mostly lists flaws fails even if every flaw is true.

FIELDS (full quality — shown in full, must stand on their own as real value):
- cv_data: { Name, Seniority, Industry, Country } from the CV (Country = the most-recent role's country, not the contact block).
- analysis.overall_score / analysis.ats_score: each "0-10", honest.
- analysis.overall_commentary: 2-3 sentences. OPEN with the genuinely rare/strong thing about this candidate (specific, from the CV), THEN name the ONE tension diluting it — as one fixable thing, not a list. Respect first, problem second.
- analysis.career_arc: 1-3 sentences telling the honest, compelling story of their trajectory.
- analysis.parallel_experience: side strengths (speaking, teaching, certifications, advisory) that genuinely elevate them, from the CV only.
- analysis.sample_rewrite: { "before": "", "after": "" } — take ONE real, weak line VERBATIM from the CV (a flat title line or passive bullet) as "before", and rewrite it as "after" to show the quality of fix they'd get: sharper framing, real outcome/scale, no invented facts. This is the single most persuasive proof we read the CV and can fix it — make it concrete and impossible to paste onto another CV. The "before" must be a real substring of the CV.
- job_match.positioning_strategy: 2-3 sentences on how to position this candidate to win — by re-emphasising real experience, never claiming what the CV doesn't prove.
- analysis.red_flags: ARRAY of AT MOST the 2 most important concerns a recruiter would flag, each phrased as a fixable opportunity (short, concrete, e.g. "14-month gap 2021-2022 — easily addressed with framing"), strongest first. Do NOT dump every flaw; the full list unlocks on sign-up. Empty if genuinely none.
- analysis.nuance_clarifications: EXACTLY 2 short questions that surface a REAL ambiguity or tension you noticed in THIS CV that the candidate may not have weighed — proof you read closely. Each names the specific detail (a date overlap, a location mismatch, a title that undersells) and why it matters. NOT marketing, NOT generic — specific and observational.
- analysis.scope: ONE short sentence per key, each carrying ONE real specific crumb about THIS CV (never an empty label); the full content unlocks on sign-up.
- final_thought: 1-2 sentences — frame the score as a LEVER: name the current score and the ONE change that would move it up most. Hopeful, specific, forward-looking.

OUTPUT EXACTLY THIS SHAPE:
{
  "cv_data": { "Name": "", "Seniority": "", "Industry": "", "Country": "" },
  "analysis": {
    "overall_score": "0-10",
    "ats_score": "0-10",
    "overall_commentary": "",
    "career_arc": "",
    "parallel_experience": "",
    "sample_rewrite": { "before": "", "after": "" },
    "red_flags": [],
    "nuance_clarifications": [],
    "scope": {
      "quick_wins": "",
      "cv_action_plan": "",
      "ats_keywords": "",
      "cultural_fit": "",
      "writing_style": "",
      "cover_letter": ""
    }
  },
  "job_match": { "positioning_strategy": "" },
  "final_thought": ""
}

CV CONTENT:
${cvText}

${hasJobText ? `JOB DESCRIPTION:\n${jobText}` : 'No job ad provided — assess the CV on its own merits against the norms of its own country; do NOT invent a target role or market.'}
`.trim(),
    },
  ];
}
