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

TONE LAW — write like a sharp, plain-spoken human who actually read THIS CV. The reader should feel precisely seen, not flattered. HARD BAN on praise adjectives and hype: never use rare, elite, exceptional, world-class, stellar, prestigious, impressive, sought-after, tier-one, pedigree, mastery, pioneer, or any synonym. Never use exclamation or salesman warmth. Every positive must be a CONCRETE FACT lifted from the CV (a named role, a thing built, a number) — if you cannot point to the fact, delete the sentence. State problems plainly as fixable. Specificity is the value; enthusiasm is not.

FIELDS (full quality — shown in full, must stand on their own as real value):
- cv_data: { Name, Seniority, Industry, Country } from the CV (Country = the most-recent role's country, not the contact block).
- analysis.overall_score / analysis.ats_score: each "0-10", honest.
- analysis.overall_commentary: 2-3 sentences. OPEN by naming a concrete thing this person actually did (a specific role, build, or outcome from the CV — a fact, no adjective), THEN name the ONE tension diluting it as a single fixable thing. No praise words.
- analysis.career_arc: 1-3 sentences telling the trajectory in plain, factual terms — what they did, in what order. No hype.
- analysis.parallel_experience: side facts from the CV only (speaking, teaching, certifications, advisory) — stated plainly, no editorializing about how impressive they are.
- analysis.sample_rewrite: { "before": "", "after": "" } — take ONE real, weak line VERBATIM from the CV (a flat title line or passive bullet) as "before", and rewrite it as "after" to show the quality of fix they'd get: sharper framing, real outcome/scale, no invented facts. This is the single most persuasive proof we read the CV and can fix it — make it concrete and impossible to paste onto another CV. The "before" must be a real substring of the CV.
- job_match.positioning_strategy: 2-3 sentences on how to position this candidate to win — by re-emphasising real experience, never claiming what the CV doesn't prove.
- analysis.red_flags: ARRAY of AT MOST the 2 most important concerns a recruiter would flag, short and concrete (e.g. "14-month gap 2021-2022"). Plain statement of fact, no reassurance padding. Do NOT dump every flaw; the full list unlocks on sign-up. Empty if genuinely none.
- analysis.nuance_clarifications: EXACTLY 2 short questions that surface a REAL ambiguity or tension you noticed in THIS CV that the candidate may not have weighed — proof you read closely. Each names the specific detail (a date overlap, a location mismatch, a title that undersells) and why it matters. NOT marketing, NOT generic — specific and observational.
- analysis.scope: ONE short sentence per key, each carrying ONE real specific crumb about THIS CV (never an empty label); the full content unlocks on sign-up.
- final_thought: 1-2 sentences — name the current score and the ONE specific change that would move it up most. Plain and concrete, no hype, no "world-class".

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
