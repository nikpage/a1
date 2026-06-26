// prompts/analysis.js

// The full, deep analysis. When a `teaser` object is passed (the landing-page
// teaser already produced by prompts/analysis-teaser.js), this prompt does NOT
// recompute or re-emit the fields the teaser already nailed — it is GIVEN them
// as established facts and asked only for the DELTA: the heavier fields the
// teaser holds back (candidate_core, generation_framework, action_items, the
// full red-flag list, ATS keyword breakdown, job extraction, …). The caller
// (utils/openai.js analyzeCvJob) merges teaser + delta into one object, so the
// full call only spends output tokens on what's new. With no teaser the prompt
// keeps its original behaviour and emits the complete schema.

import { scenarioList, scenarioHandling } from './scenarios.js';

// Fields carried verbatim from the teaser — the delta call must NOT re-emit them.
const CARRIED_FROM_TEASER = [
  'cv_data',
  'analysis.overall_score',
  'analysis.ats_score',
  'analysis.overall_commentary',
  'analysis.scenario_tags',
  'analysis.career_arc',
  'analysis.parallel_experience',
  'analysis.hr_first_seconds',
  'analysis.sample_rewrite',
  'analysis.ats_verdict / ats_reason / ats_snags',
  'analysis.scan_verdict / scan_reason / scan_snags',
  'analysis.buried_credentials',
  'analysis.cv_state',
  'analysis.nuance_clarifications',
  'analysis.scope',
  'job_match.positioning_strategy',
  'final_thought',
];

export function buildAnalysisPrompt(cvText, jobText, hasJobText, teaser = null) {
  const hasTeaser = teaser && typeof teaser === 'object';

  const systemContent = `You are a top-tier HR strategist and a sharp professional CV writer. You read a CV — and the job ad when one is provided — the way an experienced recruiter does: fast, critically, looking for reasons to say no. Then you lay out exactly how to make this candidate impossible to ignore.

Your analysis is honest, specific and decisive. You name the real strengths, call out the real weaknesses, and turn both into a concrete rewrite plan a CV writer can execute without guessing.

WRITING QUALITY (non-negotiable): Reference actual phrases, roles, companies and numbers from THIS CV. Never give generic, interchangeable advice — "add keywords", "quantify achievements", "improve formatting" — without naming which keyword, which achievement, which line. Every sentence you write should be impossible to copy-paste onto a different person's CV.

LANGUAGE & FACTS: Detect the CV's language and write ALL output in it, even if the job ad is in another language. Base cultural norms on the job's country; fall back to EU norms if unknown. Use only what is actually in the CV and job ad — never invent employers, dates, skills or numbers.

REFRAME vs ADD (hard rule — governs every instruction you give the CV writer): RE-EMPHASISE, REORDER, RELABEL and UPGRADE THE WORDING of experience the CV already proves; never INSERT experience it does not. Changing which real work leads, reframing a role around a different facet of what was genuinely done, cutting weak material, and replacing weak or under-labelled phrasing with a stronger, higher-impact or more ATS-standard EQUIVALENT for the same thing are all legitimate and encouraged — they operate on content that exists. A word swap is allowed ONLY when the substitute denotes the SAME underlying fact: same scope, seniority, domain and meaning ("coordinated releases" → "led release management" only if they genuinely led it). Concrete facts — employer, location, dates, tools, numbers — are immutable: never replace a real one with a different one because it reads better (a candidate based in Berlin is in Berlin, not London; a city is a fact, not a keyword). Introducing a skill, tool, technology, domain, metric or achievement the CV does not evidence — or upgrading a term into something that claims MORE than was actually done — is fabrication, however well it matches the job ad. A career pivot is won by reframing genuine transferable work, never by manufacturing experience in the target domain. Any capability the candidate lacks belongs ONLY in ats_keywords_missing (advice to the user) or as forward-looking cover-letter aspiration — it must NEVER become a CV instruction, a positioning claim, or a skill to highlight.${hasTeaser ? `\n\nYou have ALREADY produced a fast first-pass teaser read of this CV (supplied below). This step is the DEEP pass: you build the full rewrite plan ON TOP of that first read. Treat the teaser's findings as established and consistent — do not contradict its scores, verdicts or facts — and spend your effort only on the deeper fields it held back.` : ''}`;

  // ---- delta (teaser already done) -------------------------------------------
  if (hasTeaser) {
    const userContent = `
You already produced this first-pass TEASER read of the candidate (VALID JSON). It is ESTABLISHED — treat its scores, verdicts, facts and language as fixed truth:

${JSON.stringify(teaser, null, 2)}

DO NOT RECOMPUTE OR RE-EMIT these — they are carried forward verbatim from the teaser:
${CARRIED_FROM_TEASER.map((f) => `- ${f}`).join('\n')}

Your job now is ONLY the DEEP fields below — the rewrite blueprint the teaser deliberately held back. Stay consistent with the teaser (same language, same facts, same scores); expand, never contradict.

ANALYSIS FRAMEWORK (for the delta only):
1. Write all output in the SAME language the teaser used.
2. Extract every job with: title, company, dates, location, key achievements. List most-recent first. Include overlapping roles and mark concurrency.
3. The teaser ALREADY chose the career scenario — it is carried in analysis.scenario_tags above. Do NOT re-choose or re-emit it; treat it as established and apply its handling (below) throughout.
4. Produce a 'generation_framework' — a concrete rewrite blueprint the CV writer will execute directly. Be specific and decisive: name exact jobs to include / condense / rewrite, draft the actual summary text, list the exact skills to highlight.
5. Return VALID JSON only — no comments, no trailing commas, no markdown.

SCENARIO HANDLING — the carried analysis.scenario_tags determine which rule(s) apply. Your positioning_strategy, action_items and generation_framework MUST follow the matching handling rule(s) below. These govern how the candidate is framed; they reframe/reorder/cut REAL content only and never license inventing experience:
${scenarioHandling(hasJobText)}

${!hasJobText ? `NO JOB AD PROVIDED — STANDALONE CV REVIEW:
No job description was given, so there is NO target role, company, location, industry or market to measure against. Do NOT invent one. (Locations, industries or tools that appear in the CV itself are real facts and may be used; only an invented target is forbidden.) Assess against the norms of the CV's OWN country (cv_data.Country from the teaser). Every job-relative field stays neutral: job_data, job_match.* and job_extraction stay "n/a"; analysis.ats_keywords_missing MUST be an empty array.

` : ''}FIELD INSTRUCTIONS (delta fields only):
${hasJobText ? `- job_extraction: Extract ONLY what is literally stated in the ad — quote exact phrasing where possible. Use empty arrays where the ad is silent. NEVER invent, infer, or embellish.
` : ''}- candidate_core: 2-3 sentences capturing WHO THIS CANDIDATE IS across any job — the durable through-line of what they bring (the kind of value, leadership, or domain depth that travels with them), drawn ONLY from real evidence in the CV. Job-agnostic: do not mention the target job. This becomes the candidate's editable profile and a steering principle for future documents — identity-level and true, never aspirational or invented.
- summary: 1-2 sentence attention-grabbing TL;DR of the candidate's real situation that makes the reader want to keep reading.
- jobs_extracted: ARRAY of every role { title, company, dates, location, achievements }, most-recent first, concurrency marked.
- analysis.cv_format_analysis: MUST review length (with page count), structure and design.
- analysis.cultural_fit: ${hasJobText ? `review the CV against the customs of the JOB's country.` : `review the CV against the customs of its OWN country (cv_data.Country). Do NOT invent a target country, city or market.`}
- analysis.red_flags: the FULL list of specific concerns a recruiter would flag (e.g. "14-month gap 2021-2022", "4 jobs in 3 years"), each short and concrete — this expands beyond the top concerns shown in the teaser. Empty array if genuinely none.
- analysis.quick_wins: ARRAY of high-impact, low-effort fixes, each naming the exact change (e.g. "Move the AWS certification above the fold"). Every win must operate on content the CV ALREADY contains (move, reorder, relabel, cut, reframe). NEVER an instruction to add, mention, introduce or highlight a skill, tool, technology or achievement the CV does not prove — see the REFRAME vs ADD rule.
- analysis.suitable_positions: ARRAY of concrete role titles this candidate is well-positioned to win.
- analysis.transferable_skills: skills from past roles that support the target direction; quote the exact CV phrases that prove them.
- analysis.style_wording: tone, clarity and professionalism, quoting CV wording; MUST include length advice.
- analysis.ats_keywords_present: strong terms the CV ALREADY EARNS, quoting the exact CV phrase that proves each. A keyword is PRESENT if the CV demonstrates the concept — not just the exact phrase ("managed a team of 8" satisfies "people management"; "reduced churn by 30%" satisfies "retention"). Be generous and thorough: surface every term the candidate has genuinely earned but under-labelled. These are safe to put on the CV.
- analysis.ats_keywords_missing: ${hasJobText ? `important job-ad terms for which the CV shows NO evidence at all (a named tool/language/certification the candidate never demonstrates). ADVICE TO THE CANDIDATE ONLY — they must NEVER be treated as facts, NEVER feed skills_to_highlight, and NEVER appear on the generated CV. Empty if none.` : `MUST be an empty array. With no job ad there is no target to be "missing" keywords against.`}
- analysis.action_items.cv_changes (critical / advised / optional): every item must reframe, reorder, relabel, condense or cut content the CV ALREADY contains. NEVER instruct the writer to ADD, MENTION, INTRODUCE or HIGHLIGHT a skill, tool, technology, domain or achievement the CV does not evidence — that is fabrication. The critical list MUST include length reduction if the CV is too long.
- analysis.action_items["Cover Letter"]["Tone and Style"]: guidance that pushes the cover letter toward a natural human voice — varied sentence length, a short punchy opening (not one dense multi-clause sentence), and concrete proof over adjectives; explicitly steer away from AI-tell clichés.
- job_match.career_scenario: the chosen scenario(s), or "n/a" with no job ad.
- generation_framework.cv_blueprint.target_length_pages: e.g. "1 page" or "2 pages" based on seniority.
- generation_framework.cv_blueprint.section_order: ordered list of section names the CV writer must follow.
- generation_framework.cv_blueprint.job_selection.include_jobs: job titles+company to include with full detail.
- generation_framework.cv_blueprint.job_selection.condense_jobs: job titles+company to summarise in 1-2 lines.
- generation_framework.cv_blueprint.job_selection.rewrite_jobs: job titles+company to reframe / reposition entirely.
- generation_framework.cv_blueprint.summary_draft: WRITE A STRONG, IMPACT-FIRST PROFESSIONAL SUMMARY DRAFT — max 3 sentences, tone-neutral, no "Seeking to" / "Looking to" openers, no repeated phrases. Lead with the candidate's strongest proof (scope, scale, results). Plain, specific language — strong action verbs are fine, but cut empty filler ("results-driven", "proven track record", "passionate about", "dynamic", "synergy"). The CV writer adapts this into the requested tone, so make it factual and dense, not stylised.
- generation_framework.cv_blueprint.skills_to_highlight: 8-12 specific skills drawn ONLY from transferable_skills and ats_keywords_present (skills the candidate genuinely has), ordered by relevance. NEVER pull from ats_keywords_missing — a skill the CV cannot prove must never appear here.

OUTPUT EXACTLY THIS SHAPE — the DELTA ONLY (do NOT include any carried field above):
{
  "candidate_core": "",
  "summary": "",
  "job_data": { "Position": "${hasJobText ? '' : 'n/a'}", "Seniority": "${hasJobText ? '' : 'n/a'}", "Company": "${hasJobText ? '' : 'n/a'}", "Industry": "${hasJobText ? '' : 'n/a'}", "Country": "${hasJobText ? '' : 'n/a'}", "HR Contact": "" },
  "jobs_extracted": [],
  "analysis": {
    "cv_format_analysis": "",
    "cultural_fit": "",
    "red_flags": [],
    "quick_wins": [],
    "suitable_positions": [],
    "transferable_skills": "",
    "style_wording": "",
    "ats_keywords_present": "",
    "ats_keywords_missing": "",
    "action_items": {
      "cv_changes": { "critical": [], "advised": [], "optional": [] },
      "Cover Letter": { "Points to Address": [], "Narrative Flow": [], "Tone and Style": [] }
    }
  },
  "job_match": {
    "keyword_match": "n/a",
    "inferred_keywords": "n/a",
    "career_scenario": "n/a"
  },
  "generation_framework": {
    "cv_blueprint": {
      "target_length_pages": "",
      "section_order": [],
      "job_selection": { "include_jobs": [], "condense_jobs": [], "rewrite_jobs": [] },
      "summary_draft": "",
      "skills_to_highlight": []
    }
  }${hasJobText ? `,
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
`.trim();

    return [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent },
    ];
  }

  // ---- full standalone (no teaser) -------------------------------------------
  return [
    {
      role: 'system',
      content: systemContent,
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
${scenarioList(hasJobText)}

SCENARIO HANDLING — once you choose the scenario(s), your positioning_strategy, action_items and generation_framework MUST follow the matching handling rule(s) below. These govern how the candidate is framed; they reframe/reorder/cut REAL content only and never license inventing experience:
${scenarioHandling(hasJobText)}

${!hasJobText ? `NO JOB AD PROVIDED — STANDALONE CV REVIEW:
No job description was given, so there is NO target role, company, location, industry or market to measure against. Do NOT invent one — no hypothetical target market, no assumed seniority jump, no keywords for a role the candidate never named. (Locations, industries or tools that appear in the CV itself are real facts and may be used; only an invented target is forbidden.) Assess the CV on its own merits and against the norms of its OWN country (cv_data.Country). Every job-relative field stays neutral: job_data, job_match.* and job_extraction stay "n/a"; analysis.ats_keywords_missing MUST be an empty array (you cannot be "missing" keywords with no job to compare against); positioning_strategy describes how to strengthen the CV for the kind of roles already in suitable_positions, asserting no unproven skill or target.

` : ''}FIELD INSTRUCTIONS (apply when filling the schema below):
${hasJobText ? `- job_extraction: Populate ONLY when job text is present. Extract ONLY what is literally stated in the ad — quote exact phrasing where possible. Use empty arrays where the ad is silent. NEVER invent, infer, or embellish.
` : ''}
- candidate_core: 2-3 sentences capturing WHO THIS CANDIDATE IS across any job — the durable through-line of what they bring (e.g. the kind of value, leadership, or domain depth that travels with them), drawn ONLY from real evidence in the CV. Job-agnostic: do not mention the target job. This becomes the candidate's editable profile and a steering principle for future documents — so make it identity-level and true, never aspirational or invented.
- summary: 1-2 sentence attention-grabbing TL;DR of the candidate's real situation that makes the reader want to keep reading.
- analysis.career_arc: 1-4 sentences telling the honest-but-flattering story of this candidate's trajectory — where they've been heading and why it's compelling.
- analysis.parallel_experience: side projects, teaching, speaking, volunteering, certifications drawn ONLY from the CV that strengthen the candidate.
- analysis.transferable_skills: skills from past roles that support the target direction; quote the exact CV phrases that prove them.
- analysis.suitable_positions: ARRAY of concrete role titles this candidate is well-positioned to win.
- analysis.red_flags: ARRAY of specific concerns a recruiter would flag (e.g. "14-month gap 2021-2022", "4 jobs in 3 years"), each one short and concrete. Empty array if genuinely none.
- analysis.quick_wins: ARRAY of high-impact, low-effort fixes, each naming the exact change (e.g. "Move the AWS certification above the fold"). Every win must operate on content the CV ALREADY contains (move, reorder, relabel, cut, reframe). NEVER an instruction to add, mention, introduce or highlight a skill, tool, technology or achievement the CV does not prove — see the REFRAME vs ADD rule.
- analysis.cv_format_analysis: MUST review length (with page count), structure and design.
- analysis.cultural_fit: ${hasJobText ? `review the CV against the customs of the JOB's country.` : `review the CV against the customs of its OWN country (cv_data.Country). Do NOT invent a target country, city or market.`}
- analysis.style_wording: tone, clarity and professionalism, quoting CV wording; MUST include length advice.
- analysis.ats_keywords_present: strong terms the CV ALREADY EARNS, quoting the exact CV phrase that proves each. A keyword is PRESENT if the CV demonstrates the concept — not just the exact phrase. Examples: "managed a team of 8" satisfies "people management"; "reduced churn by 30%" satisfies "retention"; "built CI/CD pipelines" satisfies "DevOps". Be generous and thorough here: surface every term the candidate has genuinely earned but under-labelled — this is where honest ATS gains come from. These are safe to put on the CV.
- analysis.ats_keywords_missing: ${hasJobText ? `important job-ad terms for which the CV shows NO evidence at all (e.g. a named tool/language/certification the candidate never demonstrates). These are ADVICE TO THE CANDIDATE ONLY — list them so the user can add them IF true. They must NEVER be treated as facts about the candidate, must NEVER feed skills_to_highlight, and must NEVER appear on the generated CV. Empty if none.` : `MUST be an empty array. With no job ad there is no target to be "missing" keywords against — do NOT invent generic industry keywords for a role the candidate never named.`}
- analysis.action_items.cv_changes (critical / advised / optional): every item must reframe, reorder, relabel, condense or cut content the CV ALREADY contains. NEVER instruct the writer to ADD, MENTION, INTRODUCE or HIGHLIGHT a skill, tool, technology, domain or achievement the CV does not evidence — that is fabrication under the REFRAME vs ADD rule. Skills the candidate is missing for the target job go in ats_keywords_missing only. The critical list MUST include length reduction if the CV is too long.
- job_match.positioning_strategy: strategy heavily based on the scenario tags. Reposition the candidate ONLY by re-emphasising experience the CV already proves — shift which real work is foregrounded and how it is framed. You may NOT claim or imply skills, tools, domains or seniority the CV does not evidence (see REFRAME vs ADD). Phrase it as what to foreground from the real history, not as new capabilities to assert.
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
  "candidate_core": "",
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
