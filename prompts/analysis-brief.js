// prompts/analysis-brief.js
//
// The GENERATION BRIEF — the projection of the analysis that the CV and
// cover-letter writers are allowed to see.
//
// The deep pass is deliberately split in two (see prompts/analysis.js): the
// 'blueprint' half is the rewrite plan another model EXECUTES, the 'review'
// half is the read-out the CANDIDATE reads on screen. Both halves are merged
// into one stored analysis object, which is correct for storage — but handing
// that whole object to a generator undoes the split. The writer then receives
// scores, commentary, format/culture/style critique and the teaser's
// first-impression theatre alongside its actual instructions, and treats
// display copy as an instruction: the document starts answering the review
// instead of executing the plan.
//
// So the generators get an ALLOWLIST — only the fields their prompts actually
// name and act on. Everything user-facing is withheld.
//
// Deliberately excluded, and why (several are now MOTHBALLED outright — no
// longer generated or displayed at all; see the MOTHBALLED note in
// prompts/analysis.js. The allowlist below is unaffected either way):
//   overall_score / ats_score, overall_commentary, final_thought, summary
//     — a verdict on the OLD CV. The writer is producing a new one.
//   cv_format_analysis, style_wording, cultural_fit, suitable_positions
//     — advice to the candidate. Length is set by cv_blueprint
//       .target_length_pages, market rules by prompts/market.js, sections by
//       cv-sections.js. Restating them as prose only competes with those.
//   ats_verdict / ats_reason / ats_snags, scan_verdict / scan_reason /
//   scan_snags, hr_first_seconds, buried_credentials, nuance_clarifications
//     — the teaser's read of the ORIGINAL document's first impression. These
//       are findings about a page that is about to stop existing; the fixes
//       they imply belong in the blueprint, not as raw snags in the writer's
//       lap. (Converting them into blueprint instructions is separate work.)
//   job_extraction
//     — already rendered plainly by prompts/job-target.js, which puts the ad's
//       own requirements in front of the model. Shipping it twice is noise.
//   cv_data / job_data
//     — read directly off the full analysis object by prompts/market.js
//       (targetCountry), never from the prompt text.

// TWO BRIEFS, NOT ONE. The CV and the letter are different documents and they
// need different halves of the analysis. Handing both the same object is how the
// letter ended up dumping the whole record onto the page: it received the CV's
// keyword lists, the CV's quick wins, the CV's rewrite instructions and the
// career arc, and a model given eight lists of material uses all eight — which
// produces a letter that says everything and argues nothing.
//
// The CV keys the CV generator names and acts on.
const ANALYSIS_KEYS = [
  'scenario_tags',          // cv-generator: drives what to emphasise
  'career_arc',             // cv-generator: the summary reflects it
  'parallel_experience',    // cv-generator: summary, where relevant
  'transferable_skills',    // cv-generator: which strengths to spotlight
  'red_flags',              // cv-generator: neutralise; cover-letter: defuse
  'ats_keywords_present',   // cv-generator: safe to weave in
  'ats_keywords_missing',   // cv-generator: the never-use list (must be visible
                            //   to be honoured — it is a prohibition, not data)
  'quick_wins',             // cv-generator: emphasis/framing steers
  'action_items',           // cv-generator: cv_changes; cover-letter: its own
];

// Top-level keys, in the order a writer reads them.
const TOP_KEYS = [
  'candidate_core',         // who this person is, job-agnostic
  'jobs_extracted',         // the roles, most-recent first
  'job_match',              // positioning_strategy, career_scenario, keywords
  'generation_framework',   // cv_blueprint + target_cover_words
];

// Present means "has content" — an empty string/array/object is noise in a
// prompt, and an absent field is better than a field that looks answered.
function hasContent(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

// What the LETTER is allowed to see. Deliberately short.
//
// Excluded, and why:
//   ats_keywords_present / ats_keywords_missing, quick_wins, career_arc,
//   parallel_experience, transferable_skills, action_items.cv_changes
//     — every one of them is written FOR THE CV. A letter cannot act on a
//       keyword list or a "move the certification above the fold"; what it does
//       instead is mention them, one per sentence, which is the dump.
//   cv_blueprint
//     — section orders and bullet counts for a document the letter is not
//       writing (CV_RULES.md, Layer 3).
//   jobs_extracted
//     — the master CV is already in the prompt, in full. This is the same career
//       twice, and the second copy invites the letter to walk it.
const COVER_ANALYSIS_KEYS = [
  'scenario_tags',          // Layer 4 — how this candidate is framed
  'red_flags',              // context for what the letter must not walk into
  'action_items',           // its own "Cover Letter" slice, filtered below
];

export function coverBrief(analysis) {
  if (!analysis || typeof analysis !== 'object') return {};

  const brief = {};
  if (hasContent(analysis.candidate_core)) brief.candidate_core = analysis.candidate_core;

  // Positioning only — career_scenario and the keyword fields belong to the CV.
  const strategy = analysis.job_match?.positioning_strategy;
  if (hasContent(strategy)) brief.positioning_strategy = strategy;

  // The evidence gathered for this letter. cover-evidence.js renders it as a
  // block of its own; it rides here too so the writer sees it in context.
  const evidence = analysis.generation_framework?.cover_evidence;
  if (hasContent(evidence)) brief.cover_evidence = evidence;

  const src = analysis.analysis;
  if (src && typeof src === 'object') {
    const kept = {};
    for (const key of COVER_ANALYSIS_KEYS) {
      if (!hasContent(src[key])) continue;
      if (key === 'action_items') {
        // ONLY the letter's own items. cv_changes is a rewrite plan for the CV.
        const items = src.action_items?.['Cover Letter'];
        if (hasContent(items)) kept.cover_action_items = items;
        continue;
      }
      kept[key] = src[key];
    }
    if (Object.keys(kept).length) brief.analysis = kept;
  }

  return brief;
}

// The analysis as the CV generator is allowed to see it. Returns a plain object
// so callers stringify it themselves.
export function generationBrief(analysis) {
  if (!analysis || typeof analysis !== 'object') return {};

  const brief = {};
  for (const key of TOP_KEYS) {
    if (hasContent(analysis[key])) brief[key] = analysis[key];
  }

  const src = analysis.analysis;
  if (src && typeof src === 'object') {
    const kept = {};
    for (const key of ANALYSIS_KEYS) {
      if (hasContent(src[key])) kept[key] = src[key];
    }
    if (Object.keys(kept).length) brief.analysis = kept;
  }

  return brief;
}
