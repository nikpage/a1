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

import { scenarioList } from './scenarios.js';

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

SCENARIO (decide this FIRST — it steers every judgement below, but is NEVER printed as a label to the user):
Classify this candidate's career scenario — choose 1-2 MAX from the list. This is the single most important step for getting the verdict right: a senior portfolio/consultant whose standing practice spans shorter corporate stints is NOT a job-hopper, and an older candidate's long history is a signal to manage, not a fault to punish. Let the chosen scenario shape scan_verdict, hr_first_seconds, red_flags and positioning_strategy. Do NOT name the scenario in any visible field — prove you understood it through the specificity of the read, not the jargon.
SCENARIO LIST (choose 1-2):
${scenarioList(hasJobText)}

FIELDS (full quality — shown in full, must stand on their own as real value):
- cv_data: { Name, Seniority, Industry, Country } from the CV (Country = the most-recent role's country, not the contact block).
- analysis.scenario_tags: ARRAY of the 1-2 chosen scenario tags (internal steering + carried forward to the deep analysis; never rendered to the user).
- analysis.overall_score / analysis.ats_score: each "0-10", honest.

THE GAUNTLET — a real CV runs two binary gates before a human ever reads it properly, and your scan reports both as a clean PASS or FAIL. Gate 1 is the machine (ATS); Gate 2 is the ~7-second human skim. A CV that fails Gate 1 is never seen; a CV that passes Gate 1 but fails Gate 2 is binned in seconds. Do NOT hedge the verdict — it is "pass" or "fail", nothing else. Then state the single decisive reason in plain language.
- analysis.ats_verdict: EXACTLY "pass" or "fail" — would this CV survive automated parsing/keyword screening as written? Fail it for real, concrete parser problems (e.g. a two-column layout that scrambles, a scanned/image CV, missing the role's core terms entirely, dates a parser can't read), not for taste.
- analysis.ats_reason: 1-2 sentences naming the ONE decisive thing — if fail, the specific reason it gets dropped (quote the offending detail); if pass, the concrete reason it parses cleanly. No generic "optimise keywords". On a PASS this is the one brief sentence shown on the card; on a FAIL it is the blunt bottom-line reason it is dropped.
- analysis.ats_snags: ARRAY of UP TO 3 ordered { "point": "", "detail": "" } shown ONLY when ats_verdict is "fail" — each names ONE real, concrete parsing problem in THIS CV. "point" = the exact offending element, quoted from the CV (a real two-column block, a graphic/photo, an unusual section heading, an unreadable date format, a core role term that is simply absent); "detail" = the one-line consequence for the parser. NEVER invent a problem to reach three — return only as many as the CV genuinely has, down to one. [] whenever ats_verdict is "pass".
- analysis.scan_verdict: EXACTLY "pass" or "fail" — in the ~7-second skim of the TOP of this CV, does a recruiter keep reading or bin it? Pass means a clear, legible, relevant top-line; fail means the eye hits a reason to stop (illegible title, stale most-recent date, no obvious fit, wall of text).
- analysis.scan_reason: 1-2 sentences — if fail, the single top reason they stop (the specific thing their eye snags on); if pass, the specific thing that earns the next two minutes. Reference THIS CV's real top-line facts.
- analysis.scan_snags: ARRAY of UP TO 3 ordered { "point": "", "detail": "" } shown ONLY when scan_verdict is "fail" — they walk through what the recruiter's eye actually hits at the TOP of THIS CV. "point" = the raw fact quoted VERBATIM from the CV with NO framing words — write the real title / date-range / tenure itself (e.g. "Salsita Software | Nov 2022 – Oct 2023"), never "Eye lands on…"; "detail" = ONE short, plain statement of the observed fact only — what the recruiter literally sees on the page (e.g. "An 11-month tenure that ended over a year ago." / "A 10-month tenure directly preceding the Salsita stint."). Do NOT elaborate, interpret, or append a consequence/implication clause — BANNED: "leaving your focus ambiguous", "indicating consecutive short-term commitments", "which clouds…", and any "raising/suggesting…" tail. State the fact and STOP. Do NOT phrase any "detail" as a question — the open question belongs ONLY in hr_first_seconds. NEVER invent a snag to reach three; return only as many as the top-line genuinely warrants, down to one. [] whenever scan_verdict is "pass".
- analysis.buried_credentials: ARRAY of AT MOST 2-3 { "tag": "", "name": "" } — the candidate's most recognisable names (employer, client, or brand from the CV) that sit too LOW on the page to survive a 7-second scan. "tag" is a 3-6 char label for the relationship (e.g. "BANK", "CLIENT", "BRAND"); "name" is the real name (e.g. "eBay"). Only names that genuinely carry weight and are genuinely buried. [] if none qualify.
- analysis.cv_state: EXACTLY "solid" or "needs_work". "solid" ONLY when BOTH gates pass and there is no critical problem — the CV is already strong enough to compete, and the remaining leverage is tuning it to each specific job. "needs_work" whenever a gate fails or a critical issue remains — the CV needs fixing first. This single field decides the closing message, so be honest, not generous.
- analysis.hr_first_seconds: the recruiter's RAW inner flash in the first ~7 seconds skimming the TOP of this CV — a fast gut reaction, NOT a considered assessment. RULES: write in FIRST PERSON as the recruiter ("Okay, senior product... wait, why did the last two jobs only last a year each?"), speak ABOUT the candidate as "they/this person", keep it SHORT and clipped (max ~40 words, 1-2 punchy sentences, fragments allowed) — a real skim has no time for full composed prose. Base it ONLY on what the eye hits first: current/most-recent title, the latest dates (recency/gap), apparent seniority. Land on ONE snap verdict or doubt. BAN clinical phrasing ("the candidate presents as", "this makes the focus feel ambiguous") — that is analysis, not a reflex. REALISTIC: not flattering, not cruel, includes the unfair-but-real instinct. Use THIS CV's real top-line facts. Shows the candidate the impression they cannot see. Do NOT wrap it in quotation marks — it is rendered inside quote marks already.
- analysis.overall_commentary: 2-3 sentences. OPEN by naming a concrete thing this person actually did (a specific role, build, or outcome from the CV — a fact, no adjective), THEN name the ONE tension diluting it as a single fixable thing. No praise words.
- analysis.career_arc: 1-3 sentences telling the trajectory in plain, factual terms — what they did, in what order. No hype.
- analysis.parallel_experience: side facts from the CV only (speaking, teaching, certifications, advisory) — stated plainly, no editorializing about how impressive they are.
- analysis.sample_rewrite: { "before": "", "after": "" } — take ONE real, weak line VERBATIM from the CV (a flat title line or passive bullet) as "before", and rewrite it as "after" to show the quality of fix they'd get: sharper framing, real outcome/scale, no invented facts. This is the single most persuasive proof we read the CV and can fix it — make it concrete and impossible to paste onto another CV. The "before" must be a real substring of the CV.
- job_match.positioning_strategy: 2-3 sentences on how to position this candidate to win — by re-emphasising real experience, never claiming what the CV doesn't prove.
- analysis.red_flags: ARRAY of AT MOST the 2 most important concerns a recruiter would flag, short and concrete (e.g. "14-month gap 2021-2022"). Plain statement of fact, no reassurance padding. Do NOT dump every flaw; the full list unlocks on sign-up. Empty if genuinely none.
- analysis.nuance_clarifications: 1 to 4 short questions (as many as the CV genuinely warrants — do NOT pad to hit a number) that surface a REAL ambiguity or tension you noticed in THIS CV that the candidate may not have weighed — proof you read closely. Each names the specific detail (a date overlap, a location mismatch, a title that undersells) and why it matters. NOT marketing, NOT generic — specific and observational. Omit any you cannot make specific to this CV.
- analysis.scope: 2 to 4 values MAX — the CURIOSITY GAP that makes them want the full service. It must SELL, not promise. HARD BAN on "We will / We'll / We're going to" and any future-tense promise. Each value states a SPECIFIC finding you ALREADY made in THIS CV, then withholds the fix. Name the concrete thing (quote/count a real phrase, role, date, or section), say plainly why it costs them, and stop. Quantify where you can. Pattern: "<specific finding in their CV> — <the fix is inside>." e.g. "Three Salsita bullets describe duties, not results — reworded into outcomes inside." Leave a scope value as "" rather than stretch for filler. Each must be impossible to paste onto another CV. No generic labels, no hype.

NO REPETITION (hard rule — the teaser reads as ONE page, and a reader who sees the same point three times feels handled, not understood): red_flags, nuance_clarifications and scope must each cover DIFFERENT ground. A specific issue (a date overlap, a short tenure, duties-not-outcomes, an age signal) belongs in exactly ONE of them — the place it lands hardest — and must NOT be restated, reworded, or alluded to in the others. overall_commentary may name at most ONE tension; do not let it repeat a red_flag verbatim. sample_rewrite must target a line NOT already called out elsewhere. Before you finish, scan your own output and delete any second mention of the same underlying fact.
- final_thought: 1-2 sentences — name the current score and the ONE specific change that would move it up most. Plain and concrete, no hype, no "world-class". Do NOT reuse the exact issue you put in overall_commentary as the lever here if it was already the headline there — pick the single highest-impact move.

OUTPUT EXACTLY THIS SHAPE:
{
  "cv_data": { "Name": "", "Seniority": "", "Industry": "", "Country": "" },
  "analysis": {
    "scenario_tags": [],
    "overall_score": "0-10",
    "ats_score": "0-10",
    "ats_verdict": "",
    "ats_reason": "",
    "ats_snags": [],
    "scan_verdict": "",
    "scan_reason": "",
    "scan_snags": [],
    "buried_credentials": [],
    "cv_state": "",
    "hr_first_seconds": "",
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
