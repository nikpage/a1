// prompts/analysis.js
//
// THE ANALYSIS. One pass, one job: decide what to PULL from this candidate's
// record for THIS job, and how to FRAME it.
//
// It used to be three calls in a trench coat — a landing-page teaser that read a
// stranger's uploaded PDF for first impressions, then a 'blueprint' pass and a
// 'review' pass built on top of it. That shape belonged to a product where a
// visitor dropped a CV on the landing page and was sold a critique of it.
//
// That is not how this is used. There is a persisted MASTER RECORD — a long,
// flat list of facts, thirty years of them — and the CV is REGENERATED for every
// job from that record. So a read-out saying "page 1 is dominated by your
// speaking list" or "move the certification above the fold" is advice about a
// document the app is about to replace, and nobody will ever act on it. Removed
// on 2026-08-16: the teaser's first-impression read, quick_wins, action_items,
// and jobs_extracted (the master already carries the career; a second copy of it
// only invites the documents to walk it).
//
// What is left is what the generators and the candidate actually use: the
// SCENARIO (how a recruiter will read this life), the SELECTION (which roles,
// achievements and skills to pull for this ad) and the FRAMING (positioning,
// headline, summary, section order, length). Scores and the keyword breakdown
// stay because the candidate reads them on screen.
//
// Consumed downstream — do not drop a field without checking these:
//   prompts/analysis-brief.js  the generator's projection of this object
//   prompts/cv-generator.js    cv_blueprint, scenario_tags, red_flags, keywords
//   utils/cv-validate.js       cv_blueprint.section_order, analysis.scenario_tags
//   prompts/market.js          job_data / cv_data Country
//   prompts/job-target.js      job_extraction, and job_text for the letter

import { scenarioList, scenarioHandling } from './scenarios.js';
import { currentDateBlock, currentDateReminder } from './current-date.js';

// NOTE: the onboarding "open questions" the user settles on the master are no
// longer produced here. A model reading the master reconciles its gaps/overlaps
// away and reports "clean", so those questions are computed deterministically
// from the master's verbatim dates in utils/master-issues.js — NOT by this pass.

// MOTHBALLED (not deleted — may be revived): the read-out is trimmed to what the
// user can ACT on, so these prose fields are no longer requested and no longer
// rendered. To revive one, put its instruction line and its schema slot back
// here and re-add its <Field> in components/AnalysisDisplay.js.
//   summary (fit_summary), overall_commentary, cv_format_analysis, cultural_fit,
//   style_wording, suitable_positions, final_thought
// Also mothballed, and for a stronger reason — they critiqued a document that no
// longer exists as a source: quick_wins, action_items, and the teaser's
// first-impression block (ats_verdict/scan_verdict/snags, hr_first_seconds,
// buried_credentials, nuance_clarifications).
// Still GENERATED but not displayed, because the CV generator consumes them via
// prompts/analysis-brief.js: career_arc, parallel_experience,
// transferable_skills. Do not drop them.

// `careerProfile` is the job-agnostic half, already decided once from this
// record (prompts/career-profile.js). When it is present this pass DOES NOT
// re-derive the person: the arc, the parallel evidence, the transferable
// skills, the base scenario and the standing risks are given to it as settled,
// and it spends its reading on the ONE thing that changed — the ad.
const arr = (v) => (Array.isArray(v) ? v : []);

export function buildAnalysisPrompt(cvText, jobText, hasJobText, _legacyTeaser = null, _legacyMode = 'blueprint', now = new Date(), careerProfile = null) {
  // With a career profile in hand this pass is DELIBERATELY SHORTER: the fields
  // that describe the person rather than the match — arc, parallel experience,
  // transferable skills, the base scenario, the proven-keyword inventory with
  // its verbatim proof quotes — are dropped from the instructions AND from the
  // schema, and copied onto the result in code (analyzeCvJob). They were being
  // re-derived, re-reasoned and re-typed on every single application to come
  // back the same. Output tokens are the expensive half; this is where the
  // saving is.
  const hasProfile = Boolean(careerProfile);
  const systemContent = `${currentDateBlock(now)}

You are a top-tier HR strategist and a sharp professional CV writer. You are given a candidate's COMPLETE career record — every role they have ever held, in full, including work that is decades old and work that has nothing to do with the job in question — and, when one is provided, the job ad they are applying for.

Your job is SELECTION and FRAMING, not review. Decide what to pull out of that record for THIS job and how to present it. You are not critiquing a document: the CV is written fresh from the record every time, so "this CV is too long" or "move this above the fold" is meaningless here. The record is raw material. You choose from it.

Three things drive every choice: what the AD asks for, the REGISTER the ad is written in (a warm, informal ad about children reading is not a terse corporate spec, and the framing follows it), and the candidate's own SCENARIO — the shape their working life actually has, which is what a recruiter reads before they read anything else.

WRITING QUALITY (non-negotiable): Reference actual phrases, roles, companies and numbers from THIS record. Never give generic, interchangeable advice — "add keywords", "quantify achievements" — without naming which keyword, which achievement, which line. Every sentence you write should be impossible to copy-paste onto a different person.

LANGUAGE & FACTS: Detect the record's language and write ALL output in it, even if the job ad is in another language. Base cultural norms on the job's country; fall back to EU norms if unknown. Use only what is actually in the record and the job ad — never invent employers, dates, skills or numbers.

REFRAME vs ADD (hard rule — governs every instruction you give the CV writer): RE-EMPHASISE, REORDER, RELABEL and UPGRADE THE WORDING of experience the record already proves; never INSERT experience it does not. Changing which real work leads, reframing a role around a different facet of what was genuinely done, cutting weak material, and replacing weak or under-labelled phrasing with a stronger, higher-impact or more ATS-standard EQUIVALENT for the same thing are all legitimate and encouraged — they operate on content that exists. A word swap is allowed ONLY when the substitute denotes the SAME underlying fact: same scope, seniority, domain and meaning ("coordinated releases" → "led release management" only if they genuinely led it). Concrete facts — employer, location, dates, tools, numbers — are immutable: never replace a real one with a different one because it reads better (a candidate based in Berlin is in Berlin, not London; a city is a fact, not a keyword). Introducing a skill, tool, technology, domain, metric or achievement the record does not evidence — or upgrading a term into something that claims MORE than was actually done — is fabrication, however well it matches the job ad. A career pivot is won by reframing genuine transferable work, never by manufacturing experience in the target domain. Any capability the candidate lacks belongs ONLY in ats_keywords_missing (advice to the user) — it must NEVER become a CV instruction, a positioning claim, or a skill to highlight.

NESTED ENGAGEMENTS (hard rule, wherever the master CV is your source): work_experience[].fractional_engagements[] are real engagements delivered UNDER that parent entry, not separate jobs — the timeline is the parent's; never count the nested children as job-hopping or short tenures, and never describe them as short stints, instability or a portfolio of separate jobs. The never-fabricate rule still binds absolutely here: a nested engagement is a fact that already exists, never a licence to invent one.`;

  const noJobBlock = !hasJobText ? `NO JOB AD PROVIDED — STANDALONE PASS:
No job description was given, so there is NO target role, company, location, industry or market to select against. Do NOT invent one — no hypothetical target market, no assumed seniority jump, no keywords for a role the candidate never named. (Locations, industries or tools that appear in the record itself are real facts and may be used; only an invented target is forbidden.) Select and frame for the kind of roles the record ITSELF evidences, and judge conventions by the candidate's own country (cv_data.Country). Every job-relative field stays neutral: job_data, job_match.* and job_extraction stay "n/a"; analysis.ats_keywords_missing MUST be an empty array (you cannot be "missing" keywords with no job to compare against).

` : '';

  // The settled half, rendered as the few things this pass actually needs. Not
  // JSON.stringify(profile): the proof quotes were already checked against the
  // record when the profile was built, so sending them again buys nothing and
  // costs the longest strings in the object.
  const profileBlock = hasProfile ? `SETTLED FACTS ABOUT THIS CANDIDATE — decided ONCE from this same record. They are true, they are final, and they are NOT yours to re-derive, contradict, restate or return to me.
- Country: ${careerProfile.country || ''}
- Career arc: ${careerProfile.career_arc || ''}
- Parallel experience: ${careerProfile.parallel_experience || ''}
- Transferable skills: ${careerProfile.transferable_skills || ''}
- Base career scenario (already chosen, keep it): ${arr(careerProfile.base_scenario_tags).join(', ') || 'none'}
- Standing risks, with the framing already written for each:
${arr(careerProfile.standing_risks).map((r) => `  - ${r?.risk} -> ${r?.framing}`).join('\n') || '  - none'}
- Capabilities already PROVEN against the record (every one is safe to use; the proof was checked in code): ${arr(careerProfile.proven_keywords).map((k) => (typeof k === 'string' ? k : k?.term)).filter(Boolean).join('; ') || 'none'}
${careerProfile.timeline ? `\n${careerProfile.timeline}\n` : ''}
Your ONLY job now is the AD. Do not re-read this life to reach these conclusions again — they are above. Spend everything you have on which of this evidence THIS job wants, and how to frame it for THIS ad's register.

` : '';

  return [
    { role: 'system', content: systemContent },
    {
      role: 'user',
      content: `
FRAMEWORK:
1. Detect the record's language and use it consistently for all output.
2. Identify the most recent country from the record for 'cv_data.Country'.
3. ${hasProfile ? 'The BASE scenario is already settled below. Add a job-relative scenario from the list below ONLY if this ad makes one genuinely apply; otherwise return an empty array and the settled one stands.' : "Classify the candidate's career scenario (choose 1-2 MAX from the strict list below). This is the FIRST decision and it governs the rest: it is how a recruiter will read this life before they read a single achievement."}
4. SELECT. Decide which roles carry this application, which are condensed to a line, and which fall away entirely. The record holds work the ad has no use for; leaving it out is the job, not a failure. Relevance beats recency — a nine-year-old role that answers the ad directly outranks last year's that does not.
5. FRAME. Say how the selected work is positioned for this ad, in the ad's own register, following the scenario handling.
6. Return VALID JSON only — no comments, no trailing commas, no markdown.

STRICT SCENARIO LIST (${hasProfile ? 'job-relative only — the base is settled; choose 0-1' : 'Choose 1-2'}):
${scenarioList(hasJobText, hasProfile)}

SCENARIO HANDLING — once you choose the scenario(s), your positioning_strategy and generation_framework MUST follow the matching handling rule(s) below. These govern how the candidate is framed; they reframe/reorder/cut REAL content only and never license inventing experience:
${scenarioHandling(hasJobText, hasProfile)}

${noJobBlock}${profileBlock}FIELD INSTRUCTIONS (apply when filling the schema below):
${hasJobText ? `- job_extraction: Extract ONLY what is literally stated in the ad — quote exact phrasing where possible. Use empty arrays where the ad is silent. NEVER invent, infer, or embellish.
- job_extraction.must_have_requirements / nice_to_have / responsibilities: take these from the ad's LABELLED sections ("What You'll Do", "About You", "Requirements", "Nice to have", however this ad titles them). Requirements are what the ad asks the person to be or do.
- job_extraction.stance: 3-6 sentences quoted VERBATIM from the ad's PROSE — not from its bullet lists — in which the company says what it is, what it believes, what it is reaching for, or what it wants from this hire. They are usually built on "we're building", "we believe", "our goal is", "we're looking for", "we work", or a first-person description of the team. Include a sentence carrying a word the ad repeats or bolds; that repetition is the company telling you what it cares about. This is NOT a requirements list and never duplicates one: requirements say what the person must do, stance says how this company thinks. Copy each sentence exactly, no paraphrase, no commentary. Empty array if the ad is pure bullet points with no such prose.
` : ''}- analysis.overall_score / analysis.ats_score: each "0-10", honest. overall_score is how well this CANDIDATE fits this job; ats_score is how well the record's evidence covers the ad's stated requirements. Neither judges any existing document.
${hasProfile ? '' : `- analysis.career_arc: 1-3 sentences telling the trajectory in plain factual terms — what they did, in what order. No hype.
- analysis.parallel_experience: side facts from the record only (speaking, teaching, certifications, advisory), stated plainly.
- analysis.transferable_skills: skills from past roles that support the target direction; quote the exact phrases from the record that prove them.
`}- analysis.red_flags: ARRAY of specific concerns a recruiter would raise about this candidate for THIS job (e.g. "14-month gap 2021-2022", "four jobs in three years", "overqualified for a mid-level role"), each short and concrete. ${hasProfile ? 'Any flag about tenure, gaps, hopping or the number of employers must come from the computed TIMELINE above — you do not count the record yourself, and an engagement delivered under a position is never a job. ' : ''}These exist so the documents can HANDLE them — the CV neutralises by framing and selection, the letter may answer at most one. Empty array if genuinely none.
${hasProfile ? `- analysis.keywords_for_this_job: ARRAY of TERMS ONLY, copied verbatim from the settled PROVEN list above — the ones THIS ad actually wants, most relevant first. No proof quotes: they were already checked in code. Never add a term that is not on that list; if the ad wants something the list does not carry, it belongs in ats_keywords_missing.
` : `- analysis.ats_keywords_present: ARRAY of { "term": the keyword, "proof": the exact phrase from the record that proves it }. A keyword is PRESENT if the record demonstrates the concept — not just the exact phrase ("managed a team of 8" satisfies "people management"; "reduced churn by 30%" satisfies "retention"). Be generous and thorough: surface every term the candidate has genuinely earned but under-labelled. The PROOF is not optional and is not your own wording: copy it VERBATIM from the record, word for word. It is checked against the record afterwards, and a term whose proof is not there is dropped and reported to the candidate as a gap instead. These are safe to put on the CV.
`}- analysis.ats_keywords_missing: ${hasJobText ? `important job-ad terms for which the record shows NO evidence at all (a named tool/language/certification the candidate never demonstrates). ADVICE TO THE CANDIDATE ONLY, shown on screen — they are NEVER facts about the candidate, NEVER feed skills_to_highlight, and NEVER reach the generated documents. Empty if none.` : `MUST be an empty array. With no job ad there is no target to be "missing" keywords against.`}
- job_match.career_scenario: the chosen scenario(s), or "n/a" with no job ad.
- job_match.positioning_strategy: 2-3 sentences on how to position this candidate to win — which real experience is foregrounded and how it is framed for this ad and its register. Never claim what the record does not prove; phrase it as what to bring forward from the real history, not as new capabilities to assert.
- generation_framework.cv_blueprint.target_length_pages: e.g. "1 page" or "2 pages" based on seniority.
- generation_framework.cv_blueprint.section_order: ordered list of section names the CV writer must follow. Use ONLY these standard, ATS-parseable names — Summary, Core Competencies, Skills, Work Experience, Projects, Education, Certifications — and no others; a creative section name breaks parsing. Include "Core Competencies" only for a Career Pivot, and "Projects" only for a Career Pivot or an Under-qualified candidate with evidenced projects.
- generation_framework.cv_blueprint.top_three_achievements: ARRAY of exactly the THREE strongest achievements this candidate has FOR THIS JOB, drawn verbatim in substance from the master's experience[].achievements[] and each naming the role and employer it came from. These go in the CV's impact zone (the first ~120 words), so pick for force of evidence against this ad — a real number or a concrete shipped deliverable beats a duty. Never write one the record does not prove.
- generation_framework.cv_blueprint.job_selection.include_jobs: job titles+company to include with full detail. For EACH, add a one-line note naming which real achievement to lead that role with. **A full entry is EARNED by answering something this ad asks, not by being recent.** Falling inside the recency window qualifies a role to be considered, never to be included: a two- or three-month role from a decade ago that the ad has no use for goes to condense_jobs or drop_jobs, and the room it frees goes to work that answers the ad — including work that is older. A CV that spends full entries on brief, ancient, irrelevant roles while relevant work is missing has selected by the calendar instead of by the job.
- generation_framework.cv_blueprint.job_selection.condense_jobs: job titles+company to summarise in 1-2 lines.
- generation_framework.cv_blueprint.job_selection.rewrite_jobs: job titles+company to reframe / reposition entirely. For EACH, name the facet of the real work to reframe it around and the phrasing to move away from.
- generation_framework.cv_blueprint.job_selection.drop_jobs: job titles+company that do NOT go on this CV at all — work the ad has no use for, and roles far outside the recency window whose only value is the employer's name. Dropping real work is selection, not falsification: the record keeps everything.
- generation_framework.cv_blueprint.required_evidence: ARRAY, ordered most important first, of the evidence THIS JOB makes essential — the work whose absence would make the CV fail to answer this ad. Each item is { "evidence": the employer or engagement name exactly as the record spells it, "requirement": the ad requirement or theme it answers }. **A nested client engagement (work_experience[].fractional_engagements[]) is named here in its own right** — it is real work, it is invisible to a reader unless the document surfaces it, and a selection that only ever names top-level employers silently deletes it. **Choose by RELEVANCE TO THIS AD, never by recency.** Older work that answers what this employer is actually about outranks recent work that does not: for an ad about a regulated crypto product, two-year-old advisory work for crypto companies is essential evidence and a recent unrelated engagement is not. 3-6 items; fewer where the record genuinely holds less. Every item must be real work in the record — this list selects, it never invents.
- generation_framework.cv_blueprint.headline_draft: the target-role HEADLINE that sits under the candidate's name — max ~8 words, tone-neutral, no full sentence, no punctuation at the end. It names WHAT THIS PERSON IS (role/discipline, optionally one domain or specialism the record proves), e.g. "Senior Backend Engineer | Payments Platforms".${hasJobText ? ' Make it job-aware: point it at the advertised role, but ONLY using a label the record genuinely earns — never borrow the ad\'s title if the record does not support it.' : ' With no job ad, name the role the record itself proves.'} HARD RULES: never a duration ("12+ years", "a decade of"), never a title, seniority, domain or specialism the record does not evidence, never a slogan or adjective soup ("results-driven professional"). If the record does not support a distinct headline, use the candidate's own most-recent real job title.${hasJobText ? ' **The specialism it names is the one THIS ad is about**, wherever the record proves it. A headline naming the candidate\'s general discipline when the ad is about a specific domain they genuinely have experience in wastes the most-read line on the CV: applying to a crypto company with proven crypto work, the headline says so.' : ''}
- generation_framework.cv_blueprint.summary_draft: WRITE A STRONG, IMPACT-FIRST PROFESSIONAL SUMMARY DRAFT — max 3 sentences, tone-neutral, no "Seeking to" / "Looking to" openers, no repeated phrases. Lead with the candidate's strongest proof for this job (scope, scale, results). Plain, specific language — strong action verbs are fine, but cut empty filler ("results-driven", "proven track record", "passionate about", "dynamic", "synergy"). The CV writer adapts this into the requested tone, so make it factual and dense, not stylised.${hasJobText ? ' **It answers what THIS ad asks for, in the order the ad cares about it.** Work the top requirements and the employer\'s own priorities into it using proof the record holds — the same evidence named in required_evidence, not a generic profile that would suit any employer in the sector. A summary whose first sentence would fit fifty other job applications has not been written for this one.' : ''}
- generation_framework.cv_blueprint.skills_to_highlight: 8-12 specific skills drawn ONLY from transferable_skills and ats_keywords_present (skills the candidate genuinely has), ordered by relevance to this ad. NEVER pull from ats_keywords_missing — a skill the record cannot prove must never appear here.
- generation_framework.target_cover_words: target word COUNT (a number) for the cover letter body, tuned to scenario/seniority AND to the target market's convention (Layer 5): for a CZECH or POLISH target the letter is a short covering note — 200-300, default 250; for every other market 250-350, default 275. Pick the market from the job ad's country when there is one, otherwise the candidate's own.

JSON OUTPUT SCHEMA:
{
  "cv_data": { "Name": "", "Seniority": "", "Industry": "", "Country": "" },
  "job_data": { "Position": "n/a", "Seniority": "n/a", "Company": "n/a", "Industry": "n/a", "Country": "n/a", "HR Contact": "" },
  "analysis": {
    "overall_score": "0-10",
    "ats_score": "0-10",
    "scenario_tags": [],
    "red_flags": [],
${hasProfile ? '    "keywords_for_this_job": [],' : `    "career_arc": "",
    "parallel_experience": "",
    "transferable_skills": "",
    "ats_keywords_present": [{ "term": "", "proof": "" }],`}
    "ats_keywords_missing": ""
  },
  "job_match": {
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
        "rewrite_jobs": [],
        "drop_jobs": []
      },
      "required_evidence": [],
      "headline_draft": "",
      "summary_draft": "",
      "top_three_achievements": [],
      "skills_to_highlight": []
    },
    "target_cover_words": ""
  }${hasJobText ? `,
  "job_extraction": {
    "position_title": "",
    "company": "",
    "location": "",
    "seniority": "",
    "must_have_requirements": [],
    "nice_to_have": [],
    "responsibilities": [],
    "language_requirements": [],
    "stance": []
  }` : ''}
}

THE CANDIDATE'S RECORD:
${currentDateReminder(now)}
${cvText}

${hasJobText ? `JOB DESCRIPTION:\n${jobText}` : ''}
`.trim()
    }
  ];
}
