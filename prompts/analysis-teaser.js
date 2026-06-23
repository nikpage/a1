// prompts/analysis-teaser.js
//
// The LANDING-PAGE TEASER analysis. Its mission is conversion: give real,
// surprising value up top, prove we read the CV closely, and make the reader
// hungry for the rest — without handing over the full action plan (that unlocks
// on account creation). Deliberately small output so it runs cheap on the strong
// model: the "hero" fields are full quality; the "scope" one-liners just show the
// breadth of what we analyse.
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

HERO FIELDS (full quality — these are shown in full and must stand on their own as real value):
- cv_data: { Name, Seniority, Industry, Country } drawn from the CV (Country = the most-recent role's country, not the contact block).
- scores: { overall, ats } each "0-10" — honest.
- commentary: 2-3 sentences. The insightful read of who this candidate is and the ONE thing diluting their story. Has depth — name the real strength and the real tension.
- career_arc: 1-3 sentences telling the honest, compelling story of their trajectory.
- parallel_experience: the side strengths (speaking, teaching, certifications, advisory) that genuinely elevate them, drawn only from the CV.
- positioning_strategy: 2-3 sentences on how to position this candidate to win — by re-emphasising real experience, never by claiming what the CV doesn't prove.
- red_flags: ARRAY of every specific concern a recruiter would flag (short, concrete, e.g. "14-month gap 2021-2022"). The UI shows the first one and a "+N more" count, so order them strongest-first. Empty array only if genuinely none.
- nuance_clarifications: EXACTLY 2 short questions that surface a REAL ambiguity or tension you noticed in THIS CV that the candidate may not have weighed — proof you read closely. Each names the specific detail (a date overlap, a location mismatch, a title that undersells, a role whose framing is unclear) and why resolving it matters. NOT marketing ("ready to upgrade?"), NOT generic ("what are your goals?") — specific, observational, genuinely useful.
- final_thought: 1-2 sentences — the honest bottom line and what would elevate this CV most.

SCOPE (the "see how much more we cover" row — ONE short sentence each, each carrying ONE real specific crumb about THIS CV, never an empty label; the full content is unlocked on sign-up):
- quick_wins: e.g. "3 high-impact fixes you can make in minutes — starting with [one real example]."
- cv_action_plan: tease the rewrite plan with one concrete move.
- ats_keywords: one real, specific keyword observation (earned-but-underlabelled, or missing vs the job).
- cultural_fit: one specific norm point for the candidate's market.
- writing_style: one specific style fix, quoting or naming a real CV phrase.
- cover_letter: one specific angle the cover letter should take for this candidate.

JSON SHAPE:
{
  "cv_data": { "Name": "", "Seniority": "", "Industry": "", "Country": "" },
  "scores": { "overall": "0-10", "ats": "0-10" },
  "commentary": "",
  "career_arc": "",
  "parallel_experience": "",
  "positioning_strategy": "",
  "red_flags": [],
  "nuance_clarifications": [],
  "final_thought": "",
  "scope": {
    "quick_wins": "",
    "cv_action_plan": "",
    "ats_keywords": "",
    "cultural_fit": "",
    "writing_style": "",
    "cover_letter": ""
  }
}

CV CONTENT:
${cvText}

${hasJobText ? `JOB DESCRIPTION:\n${jobText}` : 'No job ad provided — assess the CV on its own merits against the norms of its own country; do NOT invent a target role or market.'}
`.trim(),
    },
  ];
}
