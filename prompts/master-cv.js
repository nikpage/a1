// prompts/master-cv.js
//
// Builds the per-user MASTER CV — a persisted, reusable source-of-truth that
// every later job match reads instead of re-sending the raw CV and re-deriving
// the candidate from scratch. Two modes share one builder:
//
//   mode 'build'  — first pass: read raw CV / LinkedIn paste / unstructured
//                   input and emit the full master JSON.
//   mode 'merge'  — fold a freshly extracted CV INTO an existing master:
//                   augment overlapping entries, add new ones, newest wins on
//                   direct fact conflicts, and surface conflicts for the user
//                   to confirm — never silently overwrite.
//
// Written for PROMPT STRENGTH: the rules carry the quality, not the model. The
// never-fabricate guardrail is identical to analysis.js's REFRAME-vs-ADD rule —
// the master records only what the input proves; gaps stay gaps.

const NEVER_FABRICATE = `NEVER-FABRICATE (absolute, governs every field): Record ONLY what the input actually evidences. Never invent or infer an employer, date, title, tool, skill, metric, location or achievement that is not in the input. Concrete facts — employer, location, dates, tools, numbers — are immutable and copied verbatim. If something is absent, ambiguous, or unreadable, mark it missing or flag it — NEVER fill the gap with a plausible guess. A relabel is allowed ONLY when the substitute denotes the SAME underlying fact ("coordinated releases" → "led release management" only if they genuinely led it); upgrading a term into a claim of MORE than was done is fabrication. The master must be 100% true so that everything generated from it is safe to put on a real CV.`;

const SCHEMA = `MASTER CV JSON SCHEMA (emit EXACTLY this shape — valid JSON only, no markdown, no comments, no trailing commas):
{
  "identity": {
    "name": "",
    "contact": { "email": "", "phone": "", "location": "", "links": [] },
    "country": "",                      // most-recent country of work/residence (a fact from the input)
    "languages": [ { "language": "", "level": "" } ]   // level only if stated; else ""
  },
  "candidate_core": "",                 // 2-3 sentences: the durable through-line of who this person is across ANY job — value/leadership/domain depth that travels with them. Identity-level, job-agnostic, true. Never aspirational.
  "experience": [
    {
      "company": "",
      "role": "",
      "dates": "",                      // verbatim as given (e.g. "2018-Present"); "" if absent
      "location": "",
      "concurrent": false,              // true if it overlaps another role
      "core_tags": [],                  // 2-5 short theme tags drawn from the work itself
      "achievements": [
        {
          "text": "",                   // the achievement in the user's own framing where possible
          "metric": "",                 // quantified result IF stated in the input; else ""
          "skills_utilized": []         // concrete skills this achievement actually demonstrates
        }
      ]
    }
  ],
  "education": [ { "institution": "", "qualification": "", "dates": "", "notes": "" } ],
  "certifications": [ { "name": "", "issuer": "", "date": "" } ],
  "parallel_experience": [],            // side projects, teaching, speaking, volunteering — each a short factual line, from the input only
  "transferable_notes": [               // the hidden-value layer: real strengths from one domain that travel to others
    { "observation": "", "evidence": "", "useful_for": [] }   // e.g. observation: "calm decision-making under pressure", evidence: "volunteer firefighter, 6 years", useful_for: ["leadership roles","crisis/ops roles"]
  ],
  "voice_samples": [],                  // 3-6 of the user's OWN sentences, copied VERBATIM from the input. These preserve their real writing voice for cover letters. Do NOT paraphrase, polish, or invent — exact quotes only. [] if the input has no usable prose.
  "gaps": [],                           // honest record of what's missing or unclear (e.g. "no dates on the TechCorp role", "education section absent")
  "conflicts": []                       // merge mode only: see MERGE rules. [] in build mode.
}`;

export function buildMasterCvPrompt({ mode = 'build', rawInput = '', existingMaster = null, overrides = [] } = {}) {
  const isMerge = mode === 'merge';

  const system = `You are a meticulous career archivist. You read whatever a person gives you about their working life — a polished CV, a messy LinkedIn paste, half a Word doc, unstructured notes — and distil it into ONE structured, durable master record of their real career.

You read for MEANING, not layout: inconsistent headings, missing headings, bullet soup and pasted profile text are all normal input and you handle them without complaint. You are not writing a CV here and you are not tailoring to any job — you are building the true, reusable source-of-truth that future tailored CVs and cover letters will be generated from. Its only job is to be COMPLETE and TRUE.

${NEVER_FABRICATE}`;

  const buildTask = `TASK — BUILD the master record from the input below.
- Extract every role, with dates and concurrency where shown; most-recent first.
- For each role, capture achievements with their metric (only if the input states one) and the concrete skills each one demonstrates.
- Write candidate_core: the honest durable through-line of who this person is — drawn only from real evidence.
- Fill transferable_notes: surface genuine strengths from one domain that carry into others (e.g. hospitality → reading people; firefighting → calm leadership under pressure). Each note needs real evidence from the input and is a strength the person ACTUALLY demonstrated — never an aspiration.
- Capture voice_samples: copy 3-6 of the person's OWN sentences verbatim so their writing voice is preserved. Exact quotes only.
- Record gaps honestly. Leave conflicts as [].`;

  const mergeTask = `TASK — MERGE the new input below INTO the existing master record (provided as JSON). The user has uploaded an additional CV; combine, do not replace.
- AUGMENT overlapping entries: when a role matches an existing one (same company + overlapping dates), MERGE the detail from both into one richer entry — keep every real achievement and skill from each version. Do not discard the old detail in favour of the new, or vice versa.
- ADD anything new the existing master lacks (a role, achievement, certification, language).
- CONFLICTS on a concrete fact (different dates, changed title, different location for the same role): the NEWEST input wins the stored value, BUT record the disagreement in "conflicts" as { "field": "", "old_value": "", "new_value": "", "where": "" } so the user can confirm. Never silently overwrite a fact without logging it.
- AMBIGUOUS identity: if you cannot tell whether a new entry is the same role as an existing one, do NOT force-merge and do NOT duplicate blindly — add it and note the uncertainty in "conflicts" for the user to resolve.
- Re-derive candidate_core, transferable_notes and voice_samples from the FULLER combined picture.
- Keep the same schema. Preserve existing voice_samples and add new verbatim ones from the new input.

EXISTING MASTER:
${existingMaster ? JSON.stringify(existingMaster) : '{}'}`;

  // When the user has reviewed conflicts and chosen to keep some OLD values, those
  // decisions are authoritative: place the chosen value and drop that conflict.
  const overridesBlock = (isMerge && overrides.length)
    ? `\n\nUSER CONFLICT RESOLUTIONS (authoritative — the user reviewed these and decided):\n${overrides
        .map((o) => `- For "${o.where}": use this value verbatim — "${o.value}". Do NOT list this as a conflict in the output; it is resolved.`)
        .join('\n')}`
    : '';

  const user = `${isMerge ? mergeTask + overridesBlock : buildTask}

${SCHEMA}

${isMerge ? 'NEW INPUT TO MERGE IN' : 'INPUT'}:
${rawInput}`.trim();

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
