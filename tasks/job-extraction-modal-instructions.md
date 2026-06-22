# Build task: Editable job-extraction step before full analysis

## Goal
Split the current single analysis call into two phases:
1. **Extract** job info from the job ad (cheap, AI-judgment) → show user an **editable form modal**.
2. On confirm, run the **full CV↔job analysis** on the user-confirmed job data.

The modal is a hard stop: full analysis does NOT run until the user confirms. If they cancel, nothing is spent on phase 2.

## Hard rules
- Do NOT touch `prompts/analysis.js`, `prompts/cv-generator.js`, `prompts/cover-letter.js` (sacred).
- Do NOT break URL mode (`resolveJobText.js` / `/api/fetch-job-url`). It already works.
- Keep all three entry points on the single helper `utils/uploadAndAnalyze.js`.
- All state/PII routes wrapped in `requireAuth`; `user_id` from `req.user`, never the body.
- Reads via anon client, writes via service-role — all through `utils/database.js`.
- Follow the Testing law in CLAUDE.md (real behaviour, mock only external boundaries, every test can fail, negative auth tests).

## Phase A — extraction (cheap, synchronous)

### 1. `prompts/job-extraction.js` (new)
- Export `buildJobExtractionPrompt(jobText)`.
- AI-judgment extraction — job ads have no common structure, so instruct the model to use judgment, extract ONLY what's stated, quote phrasing, empty arrays where silent, never invent.
- Return VALID JSON only. Schema:
```
{
  "position_title": "",
  "company": "",
  "hr_contact": "",
  "location": "",
  "seniority": "",
  "employment_type": "",
  "salary": "",
  "required_skills": [],
  "desired_skills": [],
  "must_have_requirements": [],
  "nice_to_have": [],
  "responsibilities": [],
  "keywords_for_ats": [],
  "language_requirements": []
}
```

### 2. `utils/openai.js`
- Add `analyzeJobOnly(jobText)`: builds the prompt above, calls Gemini (reuse the existing `callGemini` + `geminiUsage` + `trackDailySpend` pattern from `analyzeCvJob`), strips ```` ```json ````, `JSON.parse`, returns `{ output, usage, gemini_usage }`. Short call → fine synchronously.

### 3. `pages/api/extract-job.js` (new, sync route)
- Wrap in `requireAuth`. Body: `{ jobText }`. `user_id` from `req.user`.
- Call `analyzeJobOnly(jobText)`, return `{ extraction, gemini_usage }`.
- Negative path: missing/empty jobText → 400.

### 4. `components/JobExtractionModal.js` (new)
- Reuse `BaseModal.js`.
- **Editable form, not a report.** Text inputs: position_title, company, hr_contact, location, seniority, employment_type, salary. Chip editors (add/remove) for: required_skills, desired_skills, must_have_requirements, nice_to_have, keywords_for_ats, responsibilities, language_requirements.
- Allow empty company/title (some ads omit them) but flag visually. Do not block confirm on empty.
- Buttons: **Confirm** (resolves with edited object), **Cancel** (rejects/aborts). No re-paste flow.

## Phase B — full analysis on confirmed data

### 5. `utils/uploadAndAnalyze.js`
- Add optional async callback `onJobExtracted`.
- New flow when `jobText` is present:
  1. upload CV (unchanged).
  2. `POST /api/extract-job` with `jobText` → get `extraction`.
  3. if `onJobExtracted` provided: `const confirmed = await onJobExtracted(extraction)`. If it throws/returns null (cancel), abort — do NOT kick analysis.
  4. kick `analyse-background` as today, but also send the `confirmed` job object so the analysis runs on corrected data.
- When `jobText` is absent: behave exactly as today (no extraction, no modal).

### 6. `netlify/functions/analyse-background.mjs`
- Accept the confirmed job object from the body.
- Feed the confirmed extraction into the analysis call as the job input (pass it through `analyzeCvJob`'s jobText param, serialized to a clean labelled text block from the confirmed fields — do NOT edit `prompts/analysis.js`).
- After the analysis returns, **override** the saved `job_extraction` / `job_data` with the user-confirmed values so edits survive into `gen_data` (and thus into generation). Keep the error-sentinel behaviour.

### 7. Wire the three callers
Each passes an `onJobExtracted` that opens `JobExtractionModal` and resolves with the edited object:
- `pages/index.js`
- `components/CVUploader.js`
- `components/StartFreshModal.js`

### 8. `components/AnalysisDisplay.js`
- The read-only `job_extraction` block (lines ~189–237) is now redundant; remove it (data is confirmed earlier). Leave the rest intact.

## Do NOT
- Persist/reuse job-ad data across analyses. Each new job = fresh extraction → analysis.
- Reuse anything from `next-translate`/i18n incorrectly — add new keys to the existing namespaces for any new UI strings.

## Tests (per Testing law)
- `extract-job`: real route. Forged/missing session → 401; empty jobText → 400; valid → parsed extraction shape (Gemini mocked at boundary only).
- `analyse-background`: confirmed job object overrides AI-emitted `job_extraction`/`job_data` in the saved doc — assert the saved content carries the user's edited values, not the model's. Must fail on current code.
- `uploadAndAnalyze`: cancel path (`onJobExtracted` rejects) → analysis is NOT kicked (assert fetch to background fn not called). No-jobText path → extraction skipped, behaves as today.

## Verify
`doppler run -- netlify dev` (background fns aren't served by `next dev`). State red-on-old / green-on-new for the override regression test.
