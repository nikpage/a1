// prompts/master-cv.js
//
// Builds the per-user MASTER CV — a persisted, reusable source-of-truth that
// every later job match reads instead of re-sending the raw CV and re-deriving
// the candidate from scratch.
//
// The prompt is Nik's, verbatim. It was run against a long, messy LinkedIn
// profile PDF and produced a clean record with titles, dates, locations —
// everything the previous 250-line rule stack failed to produce (it emitted ten
// roles with every title and every date null). Do not add rules to it without a
// run showing the output is better.
//
// The build DOES NOT NEST. Dates alone cannot tell a client engagement under
// the person's own practice from a salaried job held over the same months, and
// the model guessed differently on consecutive runs of the SAME text (six
// engagements one run, four the next — temperature 0 did not settle it, Gemini
// is not deterministic). So the build reports each overlapping pair in
// `role_overlaps` and /me asks the person; their answer, and only their answer,
// moves a role into an umbrella's `fractional_engagements`.
//
// Step 1's clarifying questions cannot be answered in an unattended pipeline,
// so the model is told to skip straight to the JSON.

import { currentDateBlock, currentDateReminder } from './current-date.js';

const EXTRACTION_PROMPT = `Act as a precise data extraction specialist and JSON architect. I am providing you with unstructured career profile data (a CV, resume, or LinkedIn export). Your goal is to extract, clean, and map this data into a standardized JSON schema.

STEP 1: PRE-PROCESSING & CLARIFICATION (IF NEEDED)
Before generating any JSON, review the input data carefully.
If you detect critical ambiguities, list up to 3 short clarifying questions first. Flag items such as:
- Overlapping full-time dates that look like concurrent fractional, client, or agency engagements rather than standard employment.
- High-volume items (e.g., long lists of speaking talks, patents, or publications) mixed into the primary employment timeline.
- Contradictory location settings or missing dates for major roles.

If no major ambiguities exist, state "No clarifications needed" and proceed immediately to Step 2.

STEP 2: JSON EXTRACTION REQUIREMENTS

1. ARCHITECTURE & ROLE NESTING
- Core Career History ("work_experience"): Capture standard employment history chronologically.
- Umbrella & Fractional Roles: Do NOT nest anything. Every role stays at the top level exactly as the source presents it. Where a role's dates fall inside the span of the person's own consulting entity, agency or practice, report the pair in \`"role_overlaps"\` so the person can be asked about it — the answer is theirs, not yours.
- Independent Sections: Extract high-volume or distinct activities into dedicated top-level arrays:
  * \`"speaking_and_lecturing"\` (keynote talks, panels, guest lectures)
  * \`"advisory_and_community"\` (volunteer, board, or non-profit roles)
  * \`"publications_and_patents"\`
  * \`"education"\` and \`"certifications"\`

2. DATA CLEANING & STANDARDIZATION
- Fix minor typos, grammatical errors, and repetitive word bugs (e.g., duplicated prepositions from PDF exports) without altering the author's core voice or original bullet points.
- Standardize geographic locations across all sections to a uniform format (e.g., "City, Country Code").
- Ensure all roles preserve accurate job titles, start/end dates, and detailed bullet points reflecting responsibility and impact.

3. EXPECTED JSON SCHEMA
Ensure the final output conforms to the following top-level keys:
- "profile": Contact details, summary, headline, locations, languages, skills, honors/awards.
- "work_experience": Main employment history, flat — one entry per role the source states.
- "role_overlaps": Pairs of roles whose dates overlap the person's own practice, as index pairs into "work_experience". A question for the person, never a decision.
- "advisory_and_community": Non-profit, board, or volunteer positions.
- "speaking_and_lecturing": Itemized talks containing event name, role/topic, location, and year.
- "publications_and_patents": Listed works.
- "education": Institutions, degrees/fields of study, and date ranges.

Output ONLY the requested clarifications or the valid JSON object.`;

// Unattended: there is nobody to answer Step 1's questions, so the clarification
// branch is closed off and the model goes straight to Step 2.
const NO_CLARIFICATIONS = `This runs unattended — there is no one to answer questions. Do not ask any. State "No clarifications needed" internally and output ONLY the valid JSON object, with no markdown fence and no commentary.`;

// The INPUT is unknown — a CV, a LinkedIn PDF, a paste. The OUTPUT is not: every
// consumer reads these exact keys, so the shape is pinned here rather than left
// to the model. Sections the source does not evidence come back as [] or "".
const EXACT_SHAPE = `EXACT OUTPUT SHAPE — emit every key below, always, in this shape. A section the source does not evidence is an empty array or an empty string, never a missing key and never a different name. Use "" for any field the source does not state — never guess, never infer a location from an employer's name.

{
  "profile": {
    "name": "", "headline": "", "location": "", "summary": "",
    "contact": { "phone": "", "email": "", "linkedin": "", "website": "" },
    "top_skills": [], "languages": [{ "language": "", "proficiency": "" }],
    "certifications": [], "honors_and_awards": []
  },
  "work_experience": [
    {
      "company": "", "title": "", "start_date": "", "end_date": "", "location": "",
      "bullets": [],
      "fractional_engagements": []
    }
  ],
  "role_overlaps": [
    { "umbrella_index": 0, "role_index": 0 }
  ],
  "advisory_and_community": [
    { "organization": "", "title": "", "start_date": "", "end_date": "", "location": "", "bullets": [] }
  ],
  "speaking_and_lecturing": [
    { "event": "", "role": "", "topic": "", "location": "", "year": "" }
  ],
  "publications_and_patents": [],
  "education": [
    { "institution": "", "qualification": "", "dates": "", "location": "" }
  ]
}

SHAPE RULES:
- Every entry in "fractional_engagements" is the SAME object shape as a "work_experience" entry (company, title, start_date, end_date, location, bullets). Nest one level only — an engagement never carries its own "fractional_engagements".

NESTING — you never do it. Every "fractional_engagements" array you emit is empty, always, without exception:
1. Every role the source states is its own top-level "work_experience" entry, in the source's order. A role is never moved inside another role and never removed because another role explains it.
2. Instead, REPORT the overlap. Find the UMBRELLA: a role at the person's own consultancy, agency, studio or self-employed practice — the entry whose employer is their own entity (often their own name, often "Present" as its end date) and whose span is long and ongoing. For every OTHER role whose dates fall INSIDE that span, add one entry to "role_overlaps": { "umbrella_index": <its index in work_experience>, "role_index": <the other role's index> }.
3. Report nothing else there. Two roles at the SAME employer, one after the other, are a promotion or a title change — not an overlap. Roles that started and ended BEFORE the umbrella began are not an overlap either. No umbrella in the source means "role_overlaps" is [].
4. Dates that overlap do NOT tell you whether the role was client work under the practice or a salaried job held at the same time. You cannot know that from the source, so you do not decide it — you report the pair and the person answers.
- "bullets" is ALWAYS an array of strings, one per responsibility or achievement, and it is the ONLY place role detail goes. Never emit "description", "responsibilities", "duties" or a prose blob in place of it; a single paragraph becomes a one-element array.
- Dates are strings exactly as the source states them ("August 2016", "2011", "Present"). Do not reformat, do not compute a duration, do not fill a missing one.
- "summary" is the person's OWN summary text from the source, verbatim. Write nothing of your own there; if the source has none, use "".
- Emit no key that is not listed above.`;

export function buildMasterCvPrompt({ rawInput = '', now = new Date() } = {}) {
  return [
    { role: 'system', content: `${currentDateBlock(now)}\n\n${EXTRACTION_PROMPT}\n\n${NO_CLARIFICATIONS}\n\n${EXACT_SHAPE}` },
    { role: 'user', content: `INPUT:\n${currentDateReminder(now)}\n${rawInput}`.trim() },
  ];
}
