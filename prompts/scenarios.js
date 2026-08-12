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
//   - cover:      the same override expressed for the COVER LETTER, which has no
//                 sections to reorder, no dates to format and no bullets to cap —
//                 a CV mitigation transplanted into a letter is noise, so the
//                 letter gets its own rule (what it leads on, what it may address
//                 in the candidate's own recorded words, what it must not claim)
//
// analysis.js imports the list + handling; cv-generator.js imports the per-tag
// generation rules; cover-letter.js imports the per-tag cover rules. Nothing here fabricates — every rule is REFRAME/REORDER/
// RELABEL/CUT of real content, never INSERT (see the REFRAME vs ADD rule).

// Scenarios that apply with or without a job ad.
const BASE_SCENARIOS = {
  'Recent Grad': {
    detect: 'Little or no full-time experience; education is the strongest asset; recent graduation date.',
    handling: 'Lead with education, internships, projects and demonstrable skills rather than a thin work history. Do not pad or invent experience to fill space.',
    cover: 'Lead on capability and evidence from education, projects and internships, and on motivation for THIS role — never on length of experience. Do not apologise for a thin history or promise to \'learn fast\' in place of evidence.',
    generation: 'Put Education and projects/internships above Professional Experience. Frame coursework and projects as concrete deliverables. Keep to one page.',
  },
  'Employment Gap': {
    detect: 'One or more breaks between roles in an otherwise continuous history, where the candidate is not currently returning after a long absence (that is Job Returner).',
    handling: 'The gap is a visible fact, not a problem to be hidden. Dates stay exact and the break simply shows. A break under 6 months needs no treatment at all. For a longer one, contextualise it ONLY from what the record actually says — never speculate about the reason, and never apologise on the CV.',
    cover: 'Address the break only if it is genuinely relevant and the master records what happened: ONE brief, factual clause in the candidate\'s own recorded words, never an apology and never a paragraph. If the master records no reason, do not mention the gap at all — never speculate, never invent a bridging activity.',
    generation: 'Keep MM/YYYY dates throughout so the gap is simply visible — never switch to year-only dates, never stretch a role to cover it. Under 6 months: do nothing at all. Over 6 months: create NO timeline entry for the gap and write NO apology or explanation in the summary; ONE neutral line is permitted only where the master records what happened (study, caregiving, illness, relocation) and only in the candidate\'s own recorded words. If the master records nothing, stay silent.',
  },
  'Job Returner': {
    detect: 'A clear multi-month/year gap after a real work history, then a return (or attempt to return).',
    handling: 'Frame the continuous, real history as the asset and treat the gap as a fact to be contextualised, not hidden by deception. Lead on what the candidate can do NOW rather than on chronology. Foreground recent currency (any courses, freelance, volunteering that actually happened).',
    cover: 'Open on current capability and what the candidate can do now, not on chronology. The break may be defused in ONE confident clause, only from what the master records. Foreground real bridging activity (courses, freelance, volunteering) where it exists; invent none.',
    generation: 'Everything in the Employment Gap rule applies unchanged — dates stay MM/YYYY, the gap is simply visible, no timeline entry, no apology, and a neutral line only where the master records the reason in the candidate\'s own words. NEVER use year-only dates to soften the break. In addition: open the summary with current capability rather than history, and lead with the strongest relevant experience rather than strict reverse-chronology that spotlights the gap. Never invent activity to fill the gap; surface real bridging activity if it exists.',
  },
  'Older Applicant': {
    detect: 'The earliest evidenced role began more than 15 years before the most recent role\'s end date — a long visible career, or early dates (1990s/early-2000s), that broadcast age and can trigger bias in the quick human sort.',
    handling: 'Manage the age signal: the goal is to be judged on the last ~10-15 years of relevant work, not on total elapsed time. Recommend capping the visible timeline, collapsing early roles and dropping graduation years — this is selection of what to show, never falsification. The master CV keeps every role and date intact.',
    cover: 'State NO cumulative career total — no \'25+ years\', \'over two decades\', \'a decade of\'. Duration scoped to one role or engagement is fine. Draw evidence from the recent, relevant work the CV shows; do not narrate the early career the CV collapsed into the Earlier Career line.',
    generation: 'Apply the 10-15 year window strictly: full detail only for roles inside it. Collapse ALL older roles into one undated "Earlier Career" line — titles, employers, and the location where the location itself carries weight (a major market the candidate genuinely worked in), no bullets. NAME the employers individually as the master records them: a category ("financial institutions and tech companies") is NOT a substitute, and dissolving a marquee employer into one throws away the strongest thing on that line. The line carries no dates, so a real market costs no age signal. Format that line as its own experience block using the SAME markdown structure as every other role (#### **Earlier Career** heading, then a **[Company/roles summary]** subtitle line) so it renders with identical styling — never as a plain paragraph; it is the only undated entry permitted on the CV. Strip graduation years from EVERY Education entry — all of them or none, never selectively. Never state a CUMULATIVE career total anywhere — "25+ years\' experience", "over two decades in banking", "a decade of expertise": that is one number the screening sort can act on before it reads anything. Duration scoped to a SINGLE role, project or engagement stays — "five years running the Prague platform team", "twelve years at Deutsche Bank" — because depth lives in scope, marquee names and long tenures inside the visible window, and cutting those would strip out the very evidence this override protects. Keep every date that IS shown exactly as the master records it — compress by selection, never by altering a real date.',
  },
  'Senior Portfolio / Independent Consultant': {
    detect: 'A senior candidate whose recent record mixes a standing independent practice (consulting/advisory/freelance) with one or more shorter corporate roles. Decisive signal: the consultancy\'s date range SPANS or OVERLAPS those corporate roles (e.g. consultancy "2016-Present" while two corporate stints sit inside 2022-2023). The short stints are engagements within a continuous practice, not instability.',
    handling: 'This is the case a naive scan misreads as job-hopping. When the consultancy\'s dates span the corporate roles, the candidate was NEVER between jobs — the practice ran throughout, so there is no real gap and no string of "short jobs". CONSIDER recommending that the overlapping corporate roles be FOLDED INTO the continuous-consultancy window so the timeline reads as one unbroken senior practice with embedded engagements rather than separate sub-year employers — but this is a SUGGESTION to weigh, not always correct. Recommend the fold-in when the consultancy is a credible continuous practice and the short stints would otherwise read as instability. Do NOT recommend it when a corporate name is a stronger standalone asset than the consultancy, or (with a job ad) the target role rewards direct employment at that company — there, keep the corporate role prominent and use the consultancy only to show there was no gap. Either way it is honest ONLY because the date overlap is real: it reorganises true concurrent facts; it never relabels a corporate employer as a "client" of the consultancy or changes the nature of any role. State your recommendation (fold in, or keep distinct) and why in positioning_strategy / generation_framework so the generator follows it. Foreground the deep anchor roles (long tenures, marquee names) so the verdict rests on real depth.',
    cover: 'Present the standing practice as continuous work, so the short corporate stints read as engagements within it rather than instability — the letter says this once, plainly, and moves on. Never argue with an accusation the reader has not made. Keep every employer, title and relationship exactly as the master records it.',
    generation: 'Present the standing consultancy as the continuous spine, shown "[start] - Present", so the timeline shows no gap. Then follow the analysis\'s recommendation on the corporate roles: IF positioning_strategy / generation_framework calls for folding them in, nest the roles whose dates fall within the consultancy span beneath it as concurrent engagements — an unbroken practice with engagements inside it, never two isolated sub-year jobs then silence. IF the analysis instead keeps a corporate role distinct (e.g. a marquee employer worth its own line), leave it as its own entry and rely on the spanning consultancy dates to close the apparent gap. Folding is a suggestion the analysis decides, NOT a default — do not fold every portfolio CV. Whatever the choice, keep each corporate role\'s real employer, title and dates exactly as given; group by true date overlap only — never restyle an employer as a consultancy client or imply billing through the practice unless the source says so. Lead with the strongest anchor rather than strict reverse-chronology if that would open on a sub-year stint. Never invent scope or duration.',
  },
};

// Scenarios that only make sense when there is a target job to measure against.
const JOB_SCENARIOS = {
  'Overqualified': {
    detect: 'Candidate clearly exceeds the role\'s seniority/scope requirements.',
    handling: 'Address the "will they be bored / too expensive / a flight risk" doubt. Emphasise genuine fit and motivation for THIS level of work, drawn only from real evidence.',
    cover: 'Answer the unspoken doubt — boredom, cost, flight risk — with genuine motivation for THIS level of work, drawn only from real evidence. Talk about what the candidate builds and ships, not the scope they governed. Never disclaim seniority or offer to accept less.',
    generation: 'Reframe strategic phrasing toward hands-on delivery — the same real work, described by what was built and shipped rather than by the scope governed. Titles stay exactly as recorded. You MAY drop the most senior-signalling bullets from a role; you may NEVER drop the role itself, downgrade a real title, or fabricate.',
  },
  'Under-qualified': {
    detect: 'Candidate is below the role\'s stated requirements on one or more axes.',
    handling: 'Maximise genuine transferable evidence toward the target; be honest about what is not there. Gaps go to ats_keywords_missing as advice, never onto the CV.',
    cover: 'State NO years of experience anywhere. Lead with the closest real evidence, projects and certifications, and with the rate at which scope has grown. Never claim a skill, tool or domain the master does not evidence, and never promise to acquire one as if it were held.',
    generation: 'Weight projects, certifications and rate of progression ABOVE total years: order sections so evidenced Projects and Certifications sit high, and let the bullets show scope growing across roles. A **Projects** section is permitted here, built only from evidenced master entries. Do NOT state years of experience anywhere — not in the summary, not in the headline, not in a bullet. Foreground the closest real experience and transferable skills; never assert a skill, tool or domain the master does not evidence to close the gap.',
  },
  'Career Pivot': {
    detect: 'Candidate is moving to an adjacent domain/function; much experience is transferable.',
    handling: 'Win the pivot by reframing genuine transferable work toward the target, never by manufacturing target-domain experience. Name the real bridge skills.',
    cover: 'Name the real bridge explicitly: why this experience transfers, in the target\'s language, from facts the master evidences. Motivation for the move belongs here — it is the one place it can be argued — but it never substitutes for evidence, and never manufactures target-domain experience.',
    generation: 'Put the target-facing headline at the top, and a **Core Competencies** block directly under the Summary — populated ONLY with transferable skills the master evidences, as a single-column bullet list. A **Projects** section is permitted here, built only from evidenced master entries. Past titles stay exactly as recorded; reorder bullets within each role to lead with the transferable work. Reframe and relabel real achievements in the target\'s language where the underlying fact is the same. Domain experience the master lacks stays off the CV.',
  },
  'Major Pivot': {
    detect: 'A large jump in domain/function where little is directly transferable.',
    handling: 'Be realistic: foreground the few genuine bridges and treat the rest as cover-letter narrative/aspiration. Do not pretend the gap is small.',
    cover: 'This is where the pivot narrative lives, since the CV stays strictly factual. Be realistic: name the few genuine bridges, state the motivation plainly, and do not pretend the distance is small. Aspiration must read as aspiration — never as experience the candidate has.',
    generation: 'Lead with the strongest genuine bridge. Keep the CV factual; the forward-looking pivot narrative belongs in the cover letter, not as invented CV claims.',
  },
  'Standard Career Progression': {
    detect: 'A coherent, linear advance within one domain/function toward the target.',
    handling: 'Reinforce the clean trajectory and growing scope. The leverage is sharpening impact and matching the job\'s exact language, not repositioning.',
    cover: 'Reinforce the trajectory: show scope growing across roles toward this one, in the ad\'s own earned language. The leverage is sharper proof, not repositioning.',
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
  return renderScenarioRules(tags, 'generation', 'These take precedence over Layer 3 job matching and Layer 2 scannability, but never over the invariants or Layer 1 parseability. They reframe/reorder/relabel/cut REAL content only — none of them adds a fact.');
}

// The same overrides, expressed for the COVER LETTER. Same tags, same cap, same
// never-fabricate floor — a different document, so a different rule per tag.
// A fact an override bars from the CV (a cumulative career total, years of
// experience) is barred here too: the letter is not where the CV's restrictions
// are laundered.
export function scenarioCoverRules(tags) {
  return renderScenarioRules(tags, 'cover', 'These shape what the letter leads on and what it may address. They never outrank the invariants or the matched-pairs rule, and they add no fact the master does not evidence. Anything an override forbids on the CV is equally forbidden here.');
}

// Shared picker for both renderings: resolve the tags, honour the Layer 4 cap,
// emit the requested field. Unknown/empty tags → '' (the prompt falls back to
// its normal rules).
function renderScenarioRules(tags, field, preamble) {
  const list = Array.isArray(tags) ? tags : (tags ? [tags] : []);
  const rules = list
    .map((t) => (typeof t === 'string' ? t.trim() : ''))
    .filter((t) => ALL[t])
    // Layer 4 caps the overrides at two active at once. The analysis is asked
    // for 1-2, but the cap is enforced here so a third tag cannot leak through.
    .slice(0, 2)
    .map((t) => `- ${t}: ${ALL[t][field]}`);
  if (!rules.length) return '';
  return `# Layer 4 — Situational overrides (maximum two, active for this candidate)\n${preamble}\n${rules.join('\n')}\n`;
}

export const OLDER_APPLICANT = 'Older Applicant';

// Every year the master writes anywhere in a role's verbatim date string.
function yearsIn(dates) {
  if (typeof dates !== 'string') return [];
  return (dates.match(/\b(19|20)\d{2}\b/g) || []).map(Number);
}

// Is this candidate an Older Applicant? The trigger is pure arithmetic over the
// master's dates — the earliest evidenced role starting more than 15 years before
// the most recent role ends — so it is decided in CODE, not left to the model.
//
// It was left to the model, and the model lost it: the teaser picks 1-2 tags, so
// on a long senior portfolio career "Senior Portfolio / Independent Consultant"
// (equally true, and the more interesting read) crowded the age signal out and
// the generator never applied the age mitigations the analysis had just advised.
// The date test needs no judgement, so nothing is gained by asking for it.
export function detectOlderApplicant(master, now = new Date()) {
  const experience = Array.isArray(master?.experience) ? master.experience : [];
  if (!experience.length) return false;

  const currentYear = now.getFullYear();
  let earliestStart = null;
  let latestEnd = null;

  for (const role of experience) {
    const years = yearsIn(role?.dates);
    // An ongoing role ends now; "Present" carries no year of its own.
    const ongoing = typeof role?.dates === 'string' && /present|current|now|dosud|obecnie/i.test(role.dates);
    if (!years.length) {
      if (ongoing) latestEnd = Math.max(latestEnd ?? currentYear, currentYear);
      continue;
    }
    const start = Math.min(...years);
    const end = ongoing ? currentYear : Math.max(...years);
    earliestStart = earliestStart === null ? start : Math.min(earliestStart, start);
    latestEnd = latestEnd === null ? end : Math.max(latestEnd, end);
  }

  if (earliestStart === null || latestEnd === null) return false;
  return latestEnd - earliestStart > 15;
}

// Merge the code-decided Older Applicant tag into the tags the analysis chose.
// It goes in at position 1 rather than the end: Layer 4 caps the active overrides
// at two, so appending to a full pair would let the cap silently drop the very tag
// we just proved. The model's leading tag is kept; anything past two is dropped as
// before.
export function withOlderApplicant(tags, master, now = new Date()) {
  const list = (Array.isArray(tags) ? tags : (tags ? [tags] : []))
    .map((t) => (typeof t === 'string' ? t.trim() : ''))
    .filter(Boolean);
  if (!detectOlderApplicant(master, now)) return list;
  if (list.includes(OLDER_APPLICANT)) return list;
  return [list[0], OLDER_APPLICANT, ...list.slice(1)].filter(Boolean);
}

export const SCENARIOS = ALL;
