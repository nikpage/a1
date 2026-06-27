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

// Applies to EVERY profile, however messy. Cheap models tend to (a) write gaps
// that contradict the data they just extracted, and (b) silently pick one side of
// an internal disagreement. These rules force a self-check rather than relying on
// a stronger model. No profile-specific values — principles only.
const SELF_CONSISTENCY = `SELF-CONSISTENCY (re-check before you output — your gaps and conflicts MUST agree with the data you actually wrote):
- GAPS: before listing a field as missing, look at the entry you produced. NEVER report a field as absent if you populated it. Report each genuinely-missing field on its own — do not lump distinct fields together (a role missing only its country is NOT "missing dates or country"; if its dates are filled, only the country is missing).
- COUNTRY: identity.country is where the person MOST RECENTLY worked or resides — derive it from the most-recent role's location, NOT from the contact block. If the contact-block location or the phone-number country implies a different country than the recent roles, do NOT silently choose one — record it as a conflict.
- CONTRADICTIONS: whenever two parts of the input disagree on a concrete fact (contact location vs recent-role location, dates that cannot both be true, a title stated two ways), surface it in "conflicts" instead of quietly resolving it.
- NO STRUCTURAL INFERENCE: you transcribe, you do not interpret structure. Never decide that two roles are the same engagement, contract, or consultancy; never merge, relabel, or lay out overlapping roles as one continuous span; never infer that the person was "self-employed throughout" or "between jobs". Keep every role as its own verbatim entry. When two roles' dates OVERLAP, that is exactly the kind of structural call only the candidate can make — record it as an open question in "conflicts" (field: "role_overlap", old_value/new_value = the two overlapping roles, where = "experience"), never resolve it yourself.`;

const SCHEMA = `MASTER CV JSON SCHEMA (emit EXACTLY this shape — valid JSON only, no markdown, no comments, no trailing commas):
{
  "identity": {
    "name": "",
    "contact": { "email": "", "phone": "", "location": "", "links": [] },
    "country": "",                      // country of the MOST-RECENT role's location (where they currently work/reside) — derive from experience, NOT the contact block; mismatch → a conflict (see SELF-CONSISTENCY)
    "languages": [ { "language": "", "level": "" } ]   // level only if stated; else ""
  },
  "candidate_core": "",                 // 2-3 sentences: the durable through-line of who this person is across ANY job — value/leadership/domain depth that travels with them. Identity-level, job-agnostic, true. Never aspirational.
  "experience": [
    {
      "company": "",
      "role": "",
      "dates": "",                      // verbatim as given (e.g. "2018-Present"); "" if absent
      "location": "",
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
  "gaps": [],                           // fields GENUINELY missing/unclear, verified against the entries you wrote (see SELF-CONSISTENCY). One missing field per item; never list a field you populated.
  "conflicts": []                       // contradictions AND structural open questions to surface, not silently resolve. BUILD: internal disagreements in the input + any overlapping roles as a "role_overlap" item (see SELF-CONSISTENCY — never decide whether overlapping roles are one consultancy yourself). MERGE: see MERGE rules. Each { "field": "", "old_value": "", "new_value": "", "where": "" }. [] if none.
}`;

// Targeted verify pass — runs after every build/merge as a safety net for the
// classes of error a cheap model slips on: a wrong most-recent-role country,
// gaps that contradict the extracted entries, and skills/metrics not supported
// by the source. It does NOT re-derive or rewrite anything (no churn on the
// valuable narrative fields); it only returns a small list of corrections that
// the caller applies deterministically. Verbatim voice is checked in code, not
// here. `trustedMaster` (merge only) carries already-verified prior facts so
// legacy content isn't flagged as unsupported just because it isn't in the new
// source text.
export function buildMasterVerifyPrompt({ master, sourceText, trustedMaster = null }) {
  const system = `You are a strict, literal fact-checker for a career master record. You are given the SOURCE text a record was built from and the MASTER JSON derived from it. Your ONLY job is to catch a few specific defects and report corrections — never rewrite, re-derive, rephrase, reorder or "improve" anything. Be conservative: when in doubt, do NOT flag.

Find only these:
1. COUNTRY: the country of the candidate's MOST-RECENT role (from that role's location). If master.identity.country disagrees with it, report the correct value.
2. BAD GAPS: any entry in master.gaps that contradicts the data — i.e. it claims a field is missing when that field is actually populated in the master. Report the exact gap string to remove.
3. UNSUPPORTED SKILLS: any string in a skills_utilized array that the SOURCE does not support at all — a tool, technology, domain or claim never evidenced. Do NOT flag reasonable relabels of work that is described; only clear inventions.
4. UNSUPPORTED METRICS: any non-empty "metric" value that states a number/quantity the SOURCE does not contain.${trustedMaster ? `\n\nNOTE: this is a MERGE. Treat facts present in the TRUSTED PRIOR RECORD as already verified — do NOT flag them as unsupported even if the new SOURCE text doesn't mention them.` : ''}

Return VALID JSON only, exactly this shape — empty arrays / empty string where there is nothing to correct:
{
  "country": "",            // corrected most-recent-role country, or "" to leave as-is
  "remove_gaps": [],        // exact gap strings to delete from master.gaps
  "unsupported_skills": [], // exact skill strings to delete from any skills_utilized
  "unsupported_metrics": [] // exact metric strings to clear
}`;

  const user = `MASTER:
${JSON.stringify(master)}
${trustedMaster ? `\nTRUSTED PRIOR RECORD (already verified — do not flag its facts):\n${JSON.stringify(trustedMaster)}\n` : ''}
SOURCE:
${sourceText}`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

export function buildMasterCvPrompt({ mode = 'build', rawInput = '', existingMaster = null, overrides = [] } = {}) {
  const isMerge = mode === 'merge';

  const system = `You are a meticulous career archivist. You read whatever a person gives you about their working life — a polished CV, a messy LinkedIn paste, half a Word doc, unstructured notes — and distil it into ONE structured, durable master record of their real career.

You read for MEANING, not layout: inconsistent headings, missing headings, bullet soup and pasted profile text are all normal input and you handle them without complaint. You are not writing a CV here and you are not tailoring to any job — you are building the true, reusable source-of-truth that future tailored CVs and cover letters will be generated from. Its only job is to be COMPLETE and TRUE.

${NEVER_FABRICATE}

${SELF_CONSISTENCY}`;

  const buildTask = `TASK — BUILD the master record from the input below.
- Extract every role as its own entry, with dates exactly as written; most-recent first. Do NOT infer structure: never fold overlapping roles into a single consultancy/engagement or decide they are one contract — if two roles' dates overlap, keep them separate verbatim and record the overlap as a "role_overlap" open question in conflicts for the user to resolve (see SELF-CONSISTENCY).
- For each role, capture achievements with their metric (only if the input states one) and the concrete skills each one demonstrates.
- Write candidate_core: the honest durable through-line of who this person is — drawn only from real evidence.
- Fill transferable_notes: surface genuine strengths from one domain that carry into others (e.g. hospitality → reading people; firefighting → calm leadership under pressure). Each note needs real evidence from the input and is a strength the person ACTUALLY demonstrated — never an aspiration.
- Capture voice_samples: copy 3-6 of the person's OWN sentences verbatim so their writing voice is preserved. Exact quotes only.
- Record gaps honestly, verified against what you extracted (see SELF-CONSISTENCY). Record any internal contradictions in the input in conflicts; otherwise leave conflicts as [].`;

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
