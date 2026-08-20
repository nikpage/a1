// prompts/career-profile.js
//
// THE JOB-AGNOSTIC HALF OF THE ANALYSIS, built ONCE per master record.
//
// Everything here is a fact about the CANDIDATE, not about any job: their arc,
// their side evidence, their transferable skills, the scenario their working
// life has, the standing risks a recruiter reads before they read an ad, and
// the keyword inventory the record proves. None of it changes when the job
// changes, yet it was being re-derived on every single application — the whole
// long record, re-read, to reach the same conclusions and print the same red
// flags. That is what this pass exists to stop.
//
// It is keyed by recordFingerprint(master): rebuilt when the record changes,
// otherwise read from cv_data.career_profile.
//
// It decides NOTHING about a job. No target role, no ad keywords, no
// positioning — that is the per-job pass's work, done with the ad in hand.

import { scenarioList, scenarioHandling } from './scenarios.js';
import { currentDateBlock, currentDateReminder } from './current-date.js';
import { timelineBlock } from '../utils/master-timeline.js';

// `master` is the structured record; when it is present the timeline is COUNTED
// IN CODE and handed over as authoritative (utils/master-timeline.js). The
// prose rule below was not enough on its own — the model read it and still
// reported the nested engagements as job-hopping, because it could see them and
// nothing stopped it counting. Now the count is not its to make.
export function buildCareerProfilePrompt(cvText, master = null, now = new Date()) {
  const timeline = master ? timelineBlock(master, now) : '';
  const system = `${currentDateBlock(now)}

You are a top-tier HR strategist reading one person's COMPLETE career record. There is NO job ad. Your job is to state what is true about this candidate in a form that every later application can reuse — the shape of their working life, what they can prove, and what a recruiter will react to.

Do NOT invent a target role, an industry to aim at, a seniority jump or keywords for a job nobody named. Locations, industries and tools that appear in the record are facts and may be used; an invented target is forbidden.

NEVER FABRICATE: state only what the record evidences. Gaps stay gaps.

NESTED ENGAGEMENTS (hard rule): work_experience[].fractional_engagements[] are real engagements delivered UNDER that parent entry, not separate jobs — the timeline is the parent's. Never count the nested children as job-hopping, short tenures, instability or a portfolio of separate jobs.

WRITING QUALITY: name real roles, employers, dates and numbers from THIS record. Every sentence must be impossible to paste onto another person.

LANGUAGE: detect the record's language and write all output in it.`;

  const user = `
FRAMEWORK:
1. Detect the record's language and use it throughout.
2. Identify the most recent country for "country".
3. Classify the BASE career scenario (1-2 max) from the list below. Only the base scenarios apply — there is no job ad, so no job-relative scenario can be judged.
4. State the standing risks and what the record itself answers them with.
5. Inventory the proven keywords.
6. Return VALID JSON only — no comments, no trailing commas, no markdown.

STRICT SCENARIO LIST (choose 1-2):
${scenarioList(false)}

SCENARIO HANDLING — the handling for the scenario(s) you choose governs how this candidate is framed in every later application. Read it, follow it, and NEVER quote its vocabulary back as if it were an observation about the person ("portfolio-heavy", "job-hopping") — describe what the record actually shows, in your own words:
${scenarioHandling(false)}

FIELD INSTRUCTIONS:
- career_arc: 1-3 sentences, the trajectory in plain factual terms — what they did, in what order. No hype.
- parallel_experience: side facts from the record only (speaking, teaching, certifications, advisory), stated plainly.
- transferable_skills: skills from past roles that travel, each with the exact phrase from the record that proves it.
- base_scenario_tags: the chosen scenario name(s), verbatim from the list.
- standing_risks: ARRAY of { "risk": what a recruiter would react to, stated concretely with the dates or employers that cause it. ${timeline ? 'Every tenure, gap, count and stability claim must come from the computed TIMELINE block above, which is authoritative — you do not count the record yourself.' : ''}, "framing": how the documents should handle it using REAL content — selection, ordering, or one plain line. Never an apology, never an invented fact }. This is decided ONCE. A later application picks from this list; it does not re-derive it. Empty array if genuinely none.
- proven_keywords: ARRAY of { "term": the skill or capability, "proof": the exact phrase from the record that proves it, copied VERBATIM }. Be generous and thorough: every capability the record genuinely earns, including ones it under-labels. The proof is checked against the record afterwards and a term whose proof is not there is dropped.
- country: the candidate's most recent country, from the record.

JSON OUTPUT SCHEMA:
{
  "country": "",
  "career_arc": "",
  "parallel_experience": "",
  "transferable_skills": "",
  "base_scenario_tags": [],
  "standing_risks": [{ "risk": "", "framing": "" }],
  "proven_keywords": [{ "term": "", "proof": "" }]
}

${timeline ? `${timeline}\n\n` : ''}THE CANDIDATE'S RECORD:
${currentDateReminder(now)}
${cvText}
`.trim();

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
