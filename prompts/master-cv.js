// prompts/master-cv.js
//
// Builds the per-user MASTER CV — a persisted, reusable source-of-truth that
// every later job match reads instead of re-sending the raw CV and re-deriving
// the candidate from scratch.
//
// The prompt is Nik's, verbatim. It was run against a long, messy LinkedIn
// profile PDF and produced a clean record with titles, dates, locations and
// nested fractional engagements — everything the previous 250-line rule stack
// failed to produce (it emitted ten roles with every title and every date
// null). Do not add rules to it without a run showing the output is better.
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
- Umbrella & Fractional Roles ("fractional_engagements"): If a primary consulting entity, agency, or self-employed practice exists, nest concurrent advisory, fractional, or client-based projects directly inside a \`"fractional_engagements"\` array within that primary company object.
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
- "work_experience": Main employment history, including nested \`"fractional_engagements"\` where applicable.
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

NESTING — apply this test to EVERY role before you emit the array, it is not optional:
1. Find the UMBRELLA: a role at the person's own consultancy, agency, studio or self-employed practice — the entry whose employer is their own entity (often their own name, often "Present" as its end date) and whose span is long and ongoing.
2. For every OTHER role, ask one question: do its dates fall INSIDE the umbrella's span? If yes, it is a client engagement delivered under that practice — put it in the umbrella's "fractional_engagements" and NOWHERE else. It does not also appear at the top level.
3. Roles that started and ended BEFORE the umbrella began are ordinary employment and stay at the top level.
NEVER nest for any other reason. Two roles at the SAME employer, one after the other, are a promotion or a title change — they are two separate top-level entries, never one nested inside the other. Nesting means "delivered under a practice", nothing else.
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
