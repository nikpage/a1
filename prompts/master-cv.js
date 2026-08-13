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

import { currentDateBlock, currentDateReminder } from './current-date.js';

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
  "education": [ { "institution": "", "qualification": "", "dates": "", "notes": "" } ],   // ONLY qualifications AWARDED TO this person — degrees, diplomas, certifications earned. An appointment to teach, lecture, guest-lecture or examine AT an institution is employment: it goes in experience[], never here, however academic the institution's name looks.
  "certifications": [ { "name": "", "issuer": "", "date": "" } ],
  "parallel_experience": [],            // side projects, teaching, speaking, volunteering — each a short factual line, from the input only
  "transferable_notes": [               // the hidden-value layer: real strengths from one domain that travel to others
    { "observation": "", "evidence": "", "useful_for": [] }   // e.g. observation: "calm decision-making under pressure", evidence: "volunteer firefighter, 6 years", useful_for: ["leadership roles","crisis/ops roles"]
  ],
  "voice_samples": [],                  // 3-6 of the user's OWN sentences, copied VERBATIM from the input. These preserve their real writing voice for cover letters. Do NOT paraphrase, polish, or invent — exact quotes only. [] if the input has no usable prose.
  "gaps": [],                           // ARRAY OF PLAIN STRINGS — never objects. Each string names ONE field that is GENUINELY missing or unclear, and says where: "experience[4].dates — no dates given for AVG", "identity.contact.location". Verified against the entries you wrote (see SELF-CONSISTENCY); never list a field you populated.
  "conflicts": []                       // contradictions AND structural open questions to surface, not silently resolve. BUILD: internal disagreements in the input + any overlapping roles as a "role_overlap" item (see SELF-CONSISTENCY — never decide whether overlapping roles are one consultancy yourself). MERGE: see MERGE rules. Each { "field": "", "old_value": "", "new_value": "", "where": "" }. [] if none.
}`;

// AUGMENT — the user types loose text about work that never made it onto their
// CV ("also did 6 months contracting at Acme in 2023, cut checkout drop-off 20%")
// and it is folded into the existing master. Unlike 'merge' (a second CV) the
// input here is the CANDIDATE SPEAKING: trusted for what it says, still bound by
// NEVER-FABRICATE for everything it doesn't. Untouched content is copied through
// byte-identical — this is an addition, never a re-derivation, so the record
// never churns under the user. Questions are the exception, not the flow: asked
// ONLY when the fact cannot be placed without the answer.
export function buildMasterAugmentPrompt({ master, text, answers = [], now = new Date() } = {}) {
  const system = `${currentDateBlock(now)}

You are a meticulous career archivist maintaining ONE person's durable master career record. The person is telling you, in their own loose words, about work that is not on their CV. Your job is to fold what they say into the existing record — accurately, additively, and without disturbing anything else.

${NEVER_FABRICATE}

${SELF_CONSISTENCY}`;

  const answersBlock = answers.length
    ? `\n\nTHE USER HAS ALREADY ANSWERED THESE (authoritative — use them, and do NOT ask them again):\n${answers
        .map((a) => `- Q: ${a.question}\n  A: ${a.answer}`)
        .join('\n')}`
    : '';

  const task = `TASK — ADD the user's new information below INTO the existing master record. This is an ADDITION, not a rebuild.

PLACEMENT — decide where each fact belongs:
- An existing role it elaborates → add achievements / skills_utilized / a metric to THAT entry.
- A role the record does not have → a new experience entry, in date order.
- Study, a qualification, a certification the person EARNED → education / certifications. An appointment to teach, lecture, guest-lecture or examine AT an institution is employment, not a qualification — never education.
- A side project, volunteering, one-off speaking → parallel_experience. A named teaching appointment with an employer and dates is a role → experience (nested under its umbrella entry if it was delivered through one).
- A genuine strength the text evidences → transferable_notes (with its real evidence).
- A language, a link, a contact detail → identity.

PRESERVE EVERYTHING ELSE — absolute:
- Copy every existing field the new text does not speak to through UNCHANGED, character for character: existing roles, dates, locations, achievements, metrics, education, candidate_core, transferable_notes, voice_samples, voice_guide. Do not re-word, re-order, re-derive, "improve", summarise or tidy anything.
- Only ADD. Never delete or overwrite an existing fact. If the new text CONTRADICTS a stored fact (different dates for the same role, a different title), do NOT overwrite it — record it in "conflicts" as { "field", "old_value", "new_value", "where" } and leave the stored value in place.
- candidate_core changes ONLY if the new information genuinely changes the durable through-line; otherwise copy it verbatim.
- voice_samples: you may ADD a sentence from the new text if it is the user's own prose, copied EXACTLY as they wrote it. Never paraphrase, never drop an existing sample.
- gaps: drop any gap the new text just filled; never add a gap about the new text (ask a question instead, if and only if the bar below is met).
- NO STRUCTURAL INFERENCE (see SELF-CONSISTENCY): if a new role's dates overlap an existing one, keep both separate and record a "role_overlap" conflict. Never decide they are one engagement or consultancy.

QUESTIONS — ask ONLY when you cannot place the fact without the answer:
- Legitimate: no employer/organisation named and it can't be matched to an existing entry; no usable time period at all, so the role cannot be placed in the timeline; genuinely ambiguous which existing role it belongs to.
- NOT legitimate: anything you would merely LIKE to know. A missing metric, a missing tool, a vague responsibility, a missing location — record what the text actually says and move on. Never ask for detail to enrich; only to place.
- Maximum 2 questions, one short plain-English line each, no jargon.
- If you ask anything, still return your best "master" — the caller will not save it until the questions are answered.
- If nothing needs asking (the normal case), return "questions": [].

CHANGES — list what you added, one short plain-English line each, addressed to the user (e.g. "Added Acme — Contractor, 2023" / "Added a metric to your Beta Ltd role"). One line per real change; [] if nothing changed.

EXISTING MASTER RECORD:
${currentDateReminder(now)}
${master ? JSON.stringify(master) : '{}'}${answersBlock}`;

  const user = `${task}

${SCHEMA}

OUTPUT ENVELOPE — emit EXACTLY this JSON (valid JSON only, no markdown, no comments):
{
  "master": { ...the full master record in the schema above, with your additions applied... },
  "questions": [],   // 0-2 strings; ONLY blocking placement questions (see above)
  "changes": []      // plain-English lines describing what you added
}

THE USER'S NEW INFORMATION:
${text}`.trim();

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

// Targeted verify pass — runs after every build/merge as a safety net for the
// classes of error a cheap model slips on: a wrong most-recent-role country,
// gaps that contradict the extracted entries, and skills/metrics not supported
// by the source. It does NOT re-derive or rewrite anything (no churn on the
// valuable narrative fields); it only returns a small list of corrections that
// the caller applies deterministically. Verbatim voice is checked in code, not
// here. `trustedMaster` (merge only) carries already-verified prior facts so
// legacy content isn't flagged as unsupported just because it isn't in the new
// source text.
export function buildMasterVerifyPrompt({ master, sourceText, trustedMaster = null, now = new Date() }) {
  const system = `${currentDateBlock(now)}

You are a strict, literal fact-checker for a career master record. You are given the SOURCE text a record was built from and the MASTER JSON derived from it. Your ONLY job is to catch a few specific defects and report corrections — never rewrite, re-derive, rephrase, reorder or "improve" anything. Be conservative: when in doubt, do NOT flag.

Find only these:
1. COUNTRY: the country of the candidate's MOST-RECENT role (from that role's location). If master.identity.country disagrees with it, report the correct value.
2. BAD GAPS: any entry in master.gaps that contradicts the data — i.e. it claims a field is missing when that field is actually populated in the master. Report the exact gap string to remove.
3. UNSUPPORTED SKILLS: any string in a skills_utilized array that the SOURCE does not support at all — a tool, technology, domain or claim never evidenced. Do NOT flag reasonable relabels of work that is described; only clear inventions.
4. UNSUPPORTED METRICS: any non-empty "metric" value that states a number/quantity the SOURCE does not contain.
5. UNSUPPORTED ACHIEVEMENTS: any achievement whose "text" asserts a responsibility, project, deliverable, result or claim the SOURCE never evidences. A relabel/reframe of work the source DOES describe is fine — flag only achievements that are wholly invented (the underlying work is nowhere in the source). Report the exact "text" string to delete.
6. UNSUPPORTED ROLES: any entry in master.experience whose employer AND role together appear nowhere in the SOURCE — a wholly invented job. Do NOT flag a real role just because some of its detail is thin. Report it as { "company": "", "role": "" } copied verbatim from the master entry.
7. UNSUPPORTED NOTES: any transferable_notes entry whose "observation" or "evidence" rests on experience the SOURCE never describes — an invented strength or invented evidence. Do NOT flag a fair inference from real evidence; only ones with no basis in the source. Report the exact "observation" string to delete.
8. INVENTED LOCATION: a REAL role (kept in master.experience) whose "location" names a place the SOURCE nowhere attaches to that role — typically the source gave NO location for it and one was filled in. The role stays; only its invented location is wrong. Report the entry as { "company": "", "role": "" } so its location is blanked. Do NOT flag a location the source states for that role, nor a trivial reformat of one it states.
9. MISSING TITLE: a REAL role in master.experience whose "role" is empty ("") while the SOURCE does name a job title for that employer and period — the extraction dropped it. Report { "company": "", "dates": "", "role": "" } with the title copied VERBATIM from the source. If the source names no title for that employer, do NOT invent one — leave it out of this list.
10. INVENTED DATES: a REAL role whose "dates" state a period the SOURCE nowhere attaches to that role — usually the source gave no dates and a period was invented. The role stays; only its invented dates are wrong. Report { "company": "", "role": "" } so its dates are blanked. Do NOT flag a reformat of dates the source does state (e.g. "Jan 2020" vs "2020").
11. MISSING DATES: a REAL role in master.experience whose "dates" are empty ("") while the SOURCE does state a period for that employer — the extraction dropped them, typically from a compact "earlier career" line that packed several roles onto one line with their years in brackets. Report { "company": "", "role": "", "dates": "" } with the period copied VERBATIM from the source. If the source states no period for that role, do NOT invent one — leave it out of this list.${trustedMaster ? `\n\nNOTE: this is a MERGE. Treat facts present in the TRUSTED PRIOR RECORD as already verified — do NOT flag them as unsupported even if the new SOURCE text doesn't mention them.` : ''}

Return VALID JSON only, exactly this shape — empty arrays / empty string where there is nothing to correct:
{
  "country": "",                 // corrected most-recent-role country, or "" to leave as-is
  "remove_gaps": [],             // exact gap strings to delete from master.gaps
  "unsupported_skills": [],      // exact skill strings to delete from any skills_utilized
  "unsupported_metrics": [],     // exact metric strings to clear
  "unsupported_achievements": [],// exact achievement "text" strings to delete from any role
  "unsupported_roles": [],       // [{ "company": "", "role": "" }] experience entries to delete
  "unsupported_notes": [],       // exact transferable_notes "observation" strings to delete
  "invented_locations": [],      // [{ "company": "", "role": "" }] real roles whose location is invented → blanked
  "invented_dates": [],          // [{ "company": "", "role": "" }] real roles whose dates are invented → blanked
  "missing_titles": [],          // [{ "company": "", "dates": "", "role": "" }] real roles whose title the source states but the record left empty → filled in verbatim
  "missing_dates": []            // [{ "company": "", "role": "", "dates": "" }] real roles whose period the source states but the record left empty → filled in verbatim
}`;

  const user = `MASTER:
${currentDateReminder(now)}
${JSON.stringify(master)}
${trustedMaster ? `\nTRUSTED PRIOR RECORD (already verified — do not flag its facts):\n${JSON.stringify(trustedMaster)}\n` : ''}
SOURCE:
${currentDateReminder(now)}
${sourceText}`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

export function buildMasterCvPrompt({ mode = 'build', rawInput = '', existingMaster = null, overrides = [], now = new Date() } = {}) {
  const isMerge = mode === 'merge';

  const system = `${currentDateBlock(now)}

You are a meticulous career archivist. You read whatever a person gives you about their working life — a polished CV, a messy LinkedIn paste, half a Word doc, unstructured notes — and distil it into ONE structured, durable master record of their real career.

You read for MEANING, not layout: inconsistent headings, missing headings, bullet soup and pasted profile text are all normal input and you handle them without complaint. You are not writing a CV here and you are not tailoring to any job — you are building the true, reusable source-of-truth that future tailored CVs and cover letters will be generated from. Its only job is to be COMPLETE and TRUE.

${NEVER_FABRICATE}

${SELF_CONSISTENCY}`;

  const buildTask = `TASK — BUILD the master record from the input below.
- Extract every role as its own entry, with dates exactly as written; most-recent first. EVERY entry needs its "role" — the job title as the source writes it. A title is often NOT on the same line as the employer: it can sit on the line above or below it, in a header, inside a sub-heading, or be stated only in the first achievement ("As Head of Delivery, I..."). Look for it in all of those before leaving "role" empty. If the source genuinely never names a title for that employer, leave "role": "" AND record it in gaps as a missing job title for that employer — never guess one, and never leave it silently blank. Do NOT infer structure: never fold overlapping roles into a single consultancy/engagement or decide they are one contract — if two roles' dates overlap, keep them separate verbatim and record the overlap as a "role_overlap" open question in conflicts for the user to resolve (see SELF-CONSISTENCY).
- **Compact "earlier career" blocks are still roles, read them field by field.** Old roles are often packed several to a LINE, separated by mid-line punctuation, with the dates in brackets and no location at all — "Manager QA Labs, AVG (2010) · Manager QA & UX, ZOOM International (2008-2009)" is TWO roles, each WITH dates. Split on the separator, then read each fragment for title, employer and dates SEPARATELY. The bracketed years belong to the fragment they sit in: never let a date fall off simply because the line held more than one role, and never carry one fragment's dates onto its neighbour. A role you extract with an empty "dates" from a line that plainly showed years is an extraction failure, not a gap.
- **NEVER infer a location.** "location" is filled ONLY from a place the input actually states for that role. You may know where a well-known employer is headquartered — that knowledge is not evidence about this candidate, and writing it in is fabrication under the never-fabricate rule. If the input names no place for a role, leave "location": "" and record it in gaps.
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
- "voice_guide", if the existing master has one, is the user's OWN written style guide: copy it through character for character. Never re-word, summarise, extend or derive it.

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
${currentDateReminder(now)}
${rawInput}`.trim();

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
