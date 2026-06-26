// prompts/scenarios.js
//
// The CAREER-SCENARIO layer. Until now "scenario" was only a bare tag the model
// picked (Recent Grad / Job Returner / Older Applicant + the job-relative ones)
// with no rules for what each one MEANS or how to handle it — so the analysis
// could trash a senior portfolio career as "instability" and the generator would
// faithfully transcribe an age signal the analysis had just warned about.
//
// This module is the single source of truth for scenarios. Each scenario carries:
//   - detect:     how to recognise it (helps the analysis classify correctly)
//   - handling:   what the ANALYSIS should do about it (feeds positioning +
//                 generation_framework)
//   - generation: the concrete CV mitigations the GENERATOR must apply
//
// analysis.js imports the list + handling; cv-generator.js imports the per-tag
// generation rules. Nothing here fabricates — every rule is REFRAME/REORDER/
// RELABEL/CUT of real content, never INSERT (see the REFRAME vs ADD rule).

// Scenarios that apply with or without a job ad.
const BASE_SCENARIOS = {
  'Recent Grad': {
    detect: 'Little or no full-time experience; education is the strongest asset; recent graduation date.',
    handling: 'Lead with education, internships, projects and demonstrable skills rather than a thin work history. Do not pad or invent experience to fill space.',
    generation: 'Put Education and projects/internships above Professional Experience. Frame coursework and projects as concrete deliverables. Keep to one page.',
  },
  'Job Returner': {
    detect: 'A clear multi-month/year gap after a real work history, then a return (or attempt to return).',
    handling: 'Frame the continuous, real history as the asset and treat the gap as a fact to be contextualised, not hidden by deception. Foreground recent currency (any courses, freelance, volunteering that actually happened).',
    generation: 'Lead with the strongest relevant experience, not strict reverse-chronology that spotlights the gap. Use year-only dates to reduce the gap\'s visual prominence. Never invent activity to fill the gap; surface real bridging activity if it exists.',
  },
  'Older Applicant': {
    detect: 'A long career (roughly 20+ years visible) or early dates (1990s/early-2000s) that broadcast age and can trigger bias in the quick human sort.',
    handling: 'Manage the age signal: the goal is to be judged on the last ~10-15 years of relevant work, not on total elapsed time. Recommend capping the visible timeline and compressing or de-dating early roles — this is selection/reframing of real content, never falsification of dates that remain shown.',
    generation: 'Cap detailed roles to roughly the last 10-15 years. Collapse older roles into a brief "Earlier Career" line WITHOUT years, or omit pre-cutoff roles entirely. Do NOT state "X+ years of experience" or show dates older than the cutoff in the summary. Keep every date that IS shown truthful — compress by selection, never by altering a real date.',
  },
  'Senior Portfolio / Independent Consultant': {
    detect: 'A senior candidate whose recent record mixes a standing independent practice (consulting/advisory/freelance) with one or more shorter corporate roles. Decisive signal: the consultancy\'s date range SPANS or OVERLAPS those corporate roles (e.g. consultancy "2016-Present" while two corporate stints sit inside 2022-2023). The short stints are engagements within a continuous practice, not instability.',
    handling: 'This is the case a naive scan misreads as job-hopping. When the consultancy\'s dates span the corporate roles, the candidate was NEVER between jobs — the practice ran throughout, so there is no real gap and no string of "short jobs". The key recommendation: FOLD the overlapping corporate roles INTO the continuous-consultancy window so the timeline reads as one unbroken senior practice with embedded engagements, not as separate sub-year employers. This is honest only because the overlap is real per the candidate\'s own dates — it reorganises true concurrent facts; it does NOT relabel a corporate employer as a "client" of the consultancy or change the nature of any role. Foreground the deep anchor roles (long tenures, marquee names) so the verdict rests on real depth.',
    generation: 'Structure the Experience section around the standing consultancy as the continuous spine, shown "[start] - Present". FOLD the corporate roles whose dates fall within that span into it as concurrent engagements nested under (or grouped beneath) the consultancy period — so a reader sees an unbroken practice with engagements inside it, never two isolated sub-year jobs followed by apparent silence. Keep each corporate role\'s real employer, title and dates exactly as given; group by the true date overlap only — do NOT restyle an employer as a consultancy client or imply they were billed through the practice unless the source says so. Lead with the strongest anchor (longest tenure or biggest name) rather than strict reverse-chronology if that would open on a sub-year stint. Never invent scope or duration.',
  },
};

// Scenarios that only make sense when there is a target job to measure against.
const JOB_SCENARIOS = {
  'Overqualified': {
    detect: 'Candidate clearly exceeds the role\'s seniority/scope requirements.',
    handling: 'Address the "will they be bored / too expensive / a flight risk" doubt. Emphasise genuine fit and motivation for THIS level of work, drawn only from real evidence.',
    generation: 'Tune the summary and lead bullets to the target role\'s level — foreground the directly relevant work, de-emphasise (do not delete) scope that screams "too senior". Never downgrade a real title or fabricate.',
  },
  'Under-qualified': {
    detect: 'Candidate is below the role\'s stated requirements on one or more axes.',
    handling: 'Maximise genuine transferable evidence toward the target; be honest about what is not there. Gaps go to ats_keywords_missing as advice, never onto the CV.',
    generation: 'Foreground the closest real experience and transferable skills. Never assert a skill/tool/domain the CV does not evidence to close the gap.',
  },
  'Career Pivot': {
    detect: 'Candidate is moving to an adjacent domain/function; much experience is transferable.',
    handling: 'Win the pivot by reframing genuine transferable work toward the target, never by manufacturing target-domain experience. Name the real bridge skills.',
    generation: 'Reframe and relabel real achievements in the target\'s language where the underlying fact is the same. Lead with transferable wins. Domain experience the CV lacks stays off the CV.',
  },
  'Major Pivot': {
    detect: 'A large jump in domain/function where little is directly transferable.',
    handling: 'Be realistic: foreground the few genuine bridges and treat the rest as cover-letter narrative/aspiration. Do not pretend the gap is small.',
    generation: 'Lead with the strongest genuine bridge. Keep the CV factual; the forward-looking pivot narrative belongs in the cover letter, not as invented CV claims.',
  },
  'Standard Career Progression': {
    detect: 'A coherent, linear advance within one domain/function toward the target.',
    handling: 'Reinforce the clean trajectory and growing scope. The leverage is sharpening impact and matching the job\'s exact language, not repositioning.',
    generation: 'Keep reverse-chronological order; escalate scope visibly across roles; weave in the job\'s real, earned keywords.',
  },
};

const ALL = { ...BASE_SCENARIOS, ...JOB_SCENARIOS };

// The bullet list of selectable scenarios, gated by whether a job ad exists.
// Mirrors the old inline "STRICT SCENARIO LIST" but sourced from one place and
// extended with the two missing senior cases.
export function scenarioList(hasJobText) {
  const names = hasJobText ? Object.keys(ALL) : Object.keys(BASE_SCENARIOS);
  return names.map((n) => `- ${n}`).join('\n');
}

// Handling guidance for ALL selectable scenarios — given to the ANALYSIS so the
// scenario it picks actually shapes positioning_strategy and generation_framework
// (not just a tag). Gated the same way as the list.
export function scenarioHandling(hasJobText) {
  const set = hasJobText ? ALL : BASE_SCENARIOS;
  return Object.entries(set)
    .map(([name, s]) => `- ${name}: ${s.handling}`)
    .join('\n');
}

// Per-tag CONCRETE CV mitigations for the GENERATOR. Given the scenario_tags the
// analysis chose, returns only the relevant generation rules. Deterministic and
// unit-tested. Unknown/empty tags → '' (generator falls back to its normal rules).
export function scenarioGenerationRules(tags) {
  const list = Array.isArray(tags) ? tags : (tags ? [tags] : []);
  const rules = list
    .map((t) => (typeof t === 'string' ? t.trim() : ''))
    .filter((t) => ALL[t])
    .map((t) => `- ${t}: ${ALL[t].generation}`);
  if (!rules.length) return '';
  return `# Scenario-specific handling (apply these — they reframe/reorder/cut REAL content only, never add facts)\n${rules.join('\n')}\n`;
}

export const SCENARIOS = ALL;
