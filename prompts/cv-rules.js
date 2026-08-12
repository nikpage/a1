// prompts/cv-rules.js
//
// The CV RULES — the single canonical statement of what a generated CV must be,
// imported by cv-generator.js (all layers) and cover-letter.js (invariants +
// the Layer 3 pairing rule). Until now these lived scattered across the
// generator's prose, the scenario strings and nowhere at all (Layers 2 and 5),
// so they drifted: the generator asked for "impact" without defining the impact
// zone, and a scenario string told the writer to use year-only dates while the
// parseability floor demanded MM/YYYY.
//
// Structure mirrors the spec exactly:
//   Layer 0  invariants   — T1-T4, unoverridable
//   Layer 1  machine parseability (the floor beneath everything)
//   Layer 2  human scannability
//   Layer 3  job matching (only with a job ad)
//   Layer 4  situational overrides — lives in ./scenarios.js
//   Layer 5  market conventions   — lives in ./market.js
//   Layer 6  output validation    — deterministic, in ../utils/cv-validate.js
//
// Precedence for everything outside the invariants: Layer 4 > Layer 3 > Layer 2,
// with Layer 1 as the floor beneath all three.

import { bulletBand } from './cv-sections.js';

// ---- Layer 0: invariants ----------------------------------------------------
// Bound into every document prompt. Nothing below may override these.
export function cvInvariants() {
  return `# Invariants (no layer, scenario, strategy or candidate instruction can override these)
- **T1 — Never fabricate.** No skill, tool, title, metric, employer, date or certification may appear unless the master CV evidences it. Keyword matching is done by REFRAMING evidenced experience, never by inserting the term. The target job's requirements are never evidence about this candidate.
- **T2 — Never falsify the record.** Titles, employers and dates are reproduced as recorded. Every strategic layer changes emphasis, ordering, wording and WHAT IS SHOWN — never what is claimed. Omission is permitted; alteration is not.
- **T3 — No invented timeline entries.** Nothing appears in Work Experience that was not a role. Gaps are gaps.
- **T4 — Parseability is a floor, not a preference.** The Layer 1 structural rules bind every other layer. An instruction that would break machine parsing is invalid — find another expression of it.

Precedence for everything else: scenario overrides > job matching > scannability, with machine parseability as the floor beneath all three.`;
}

// ---- Layer 1: machine parseability ------------------------------------------
export function machineParseability() {
  return `# Layer 1 — Machine parseability (the floor)
- **Headers:** standard names only — Summary, Work Experience, Education, Skills, Projects, Certifications (in the CV's own language). No creative section names. A **Projects** section renders ONLY when an Under-qualified or Career Pivot override is active, and only from evidenced master entries.
- **Layout:** single column. No text boxes, tables, graphics, icons, multi-column blocks, or content carried in headers/footers.
- **Titles:** print the official title from the master exactly. If it is non-standard, the industry-standard equivalent may appear in the Skills or Summary prose — never bolted onto the title line.
- **Dates:** MM/YYYY on every dated entry (e.g. "03/2019 - 08/2022", ongoing roles "03/2019 - Present"), one format throughout the document. Where the master records only a year, print that bare year and NOTHING else — never invent a month, not even 01, to complete the pattern: an invented month is a falsified date under T2. A year-only entry is permitted for exactly this reason and no other. NEVER switch to year-only dates to hide a gap or a short tenure; the "Earlier Career" line is the ONLY permitted undated entry.
- **Recency window:** full detail for the last 10-15 years. Older roles collapse into one undated "Earlier Career" line — titles, employers, and the location where the location itself carries weight (a major market the candidate genuinely worked in), no bullets. NAME the employers individually, exactly as the master records them: a category ("financial institutions and tech companies") is NOT a substitute for a name, and collapsing a marquee employer into one destroys the strongest thing on that line.
- **Education:** graduation years are written as a bare year — that is the one place a four-digit year stands alone, and it is not an exception to the MM/YYYY rule for dated *experience* entries. Keep graduation years by default. Strip them ONLY when the Older Applicant override is active, and then strip ALL of them — never selectively.`;
}

// ---- Layer 2: human scannability --------------------------------------------
// The bullet-length band is per language (see ./cv-sections.js): Czech and Polish
// carry the same content in fewer words, so telling a Czech CV to write 15-25
// pads every bullet to hit a band built on English.
export function humanScannability(language = 'auto') {
  const [minWords, maxWords] = bulletBand(language);
  return `# Layer 2 — Human scannability
- **Impact zone — the first ~120 words of the document.** Counted by words from the VERY TOP of the CV — the name/contact block, the headline, the value proposition and the achievement bullets all count — not by rendered lines. It carries, in this order: the target-facing HEADLINE, a 2-3 sentence VALUE PROPOSITION (prose), then UP TO THREE achievement bullets immediately beneath, inside the Summary block. Each of those bullets NAMES the role and employer it came from, so it cannot read as a floating claim. They may restate a bullet that also appears under its role — that duplication is deliberate: the recruiter who reads only the top block still sees the three strongest results. But NEVER in the same words: the top block is a COMPRESSED, RE-ANGLED statement of the achievement — same fact, different sentence, tighter. A verbatim copy makes the reader feel they are reading the page twice and spends the impact zone on words already spent. Print only as many as the master genuinely evidences — three is a CEILING, never a quota.
- **Openers name facts, not identities.** The value proposition's first sentence states something the candidate did or built. BANNED as descriptions of the candidate: "veteran", "seasoned", "accomplished", "industry expert", "technology leader" and their equivalents — they assert a category instead of evidence, and under an Older Applicant override "veteran" re-emits the very signal that override exists to manage.
- **Bullet form:** [Action verb] + [scope/context] + [quantified outcome].
- **Metric fallback:** where the master holds no number for an achievement, write [Action verb] + [method/tool] + [concrete deliverable]. A deliverable is a thing that shipped or changed — never an adjective. Fallback bullets are unlimited where the master genuinely holds no metrics; where metrics DO exist and you chose not to use them, fallback bullets must stay under one third of that role's bullets.
- **Volume:** bullets ${minWords}-${maxWords} words (the band for this document's language). Up to 3-5 bullets for the two most recent roles, 2-3 for the rest. These are CEILINGS, never quotas — if the master evidences fewer achievements, print fewer. A role with one evidenced achievement gets one bullet.
- **Density:** no paragraph blocks inside Work Experience — bullets only.
- **Skills — ordered by recency, clustered by domain.** List skills in the order of the MOST RECENT role that evidences them: the current role's skills first, then the next role's, and so on. Within that order keep same-domain skills ADJACENT — never split a domain with an unrelated entry (strategy at the top of the list and market intelligence at the bottom is one domain, broken in half). Grouping is expressed by ORDER ALONE: the section stays one flat single-column bullet list with no sub-headings, category labels or columns, because Layer 1 permits no heading below the section level. A skill whose only evidence lies OUTSIDE the recency window — in the "Earlier Career" line or older — is NOT listed at all: this section says what the candidate is now, and an old speciality standing beside current ones misdirects the recruiter and re-emits the age signal the window exists to manage. Every skill listed must trace to the master AND to a role the CV actually shows.`;
}

// ---- Layer 3: job matching --------------------------------------------------
// CV side. Returns '' with no job ad, so a standalone review carries no
// job-relative instruction at all.
export function jobMatchingRules(hasJobText) {
  if (!hasJobText) return '';
  return `# Layer 3 — Job matching (a job ad is present)
- **Coverage, bounded:** the ad's required hard skills, tools and certifications are in \`job_extraction\` and \`job_match.inferred_keywords\`. Use the ad's EXACT term only where the master evidences the thing. A requirement the master does not evidence is reported to the candidate as a gap (it is already in \`analysis.ats_keywords_missing\`) — never quietly filled, never softened in, never covered with the ad's own wording.
- **Priority alignment:** within each role, order bullets so the ones answering the ad's top three requirements come first. Role order stays reverse-chronological.
- **Selection:** choose bullets for relevance to THIS ad. An irrelevant true achievement is DROPPED, never reworded into relevance.`;
}

// Cover-letter side of Layer 3 — the matched-pairs rule.
export function coverMatchingRule(hasJobText) {
  if (!hasJobText) return '';
  return `- **Three matched pairs (Layer 3).** Build the letter's evidence around three explicit pairings: the ad's top three requirements against the candidate's three strongest evidenced achievements. Pair them, do not list them. Make no claim in this letter that is absent from the CV, and never answer a requirement the master does not evidence — an unevidenced requirement is a gap reported to the candidate, not a sentence in the letter.`;
}

// The full CV-side rule stack, in precedence order, for cv-generator.js.
export function cvRulesBlock(hasJobText, language = 'auto') {
  return [
    cvInvariants(),
    machineParseability(),
    humanScannability(language),
    jobMatchingRules(hasJobText),
  ].filter(Boolean).join('\n\n');
}
