# Implementation Instructions — Smart Job Input (for Sonnet)

You are implementing the feature specified in `tasks/smart-job-input-spec.md`.
Read that spec AND `CLAUDE.md` in full before touching code. This is a
**single-round** job: ship it complete, correct, tested, and localized. Do not
leave TODOs, stubs, or "future work". Do not break anything that currently works.

Before you start: read these files so you copy the existing conventions exactly —
`pages/api/get-analysis-status.js`, `lib/requireAuth.js`, `lib/auth.js`,
`utils/database.js`, `utils/uploadAndAnalyze.js`,
`netlify/functions/analyse-background.mjs`, `prompts/analysis.js`,
`components/AnalysisDisplay.js`, `components/JobAdInput.js`, `pages/index.js`,
`i18n.js`, `locales/en/analysisDisplay.json`, and an existing test in
`__tests__/` (e.g. `analyse-background.test.js`) for the Vitest + `vi.hoisted`
mocking style.

---

## Hard rules (non-negotiable — from CLAUDE.md)

- **Auth:** any route touching network/PII/state is wrapped in `requireAuth`
  (`lib/requireAuth.js`). `user_id` comes from `req.user.user_id` — NEVER the body.
- **DB:** all DB access goes through `utils/database.js`. No `createClient` in
  route files. Service-role client for writes, anon for reads.
- **Sacred files:** `prompts/analysis.js`, `prompts/cv-generator.js`,
  `prompts/cover-letter.js` — you MAY extend `prompts/analysis.js` (it is the
  file we are changing) but do it additively and carefully; never copy its
  content elsewhere.
- **One Redis client**, Supabase RPCs for token mutations — not relevant here but
  do not introduce new clients.
- **Testing law (Section in CLAUDE.md):** real behaviour, mock only the outside
  world, every test must be able to fail, security/network paths get negative
  tests. No hollow tests.
- **i18n:** every user-facing string goes through `react-i18next` `t()`, with
  keys added to ALL THREE locales: `en`, `cs`, `pl`. See "Localization" below.
- **Secrets:** none needed. Do not add `.env` files.

---

## Task 1 — Smart input box (`components/JobAdInput.js`)

The component currently takes `{ jobText, setJobText }`. Keep that contract
working so existing callers don't break, but make it smart.

1. Add a pure exported helper `detectJobInputMode(value)` returning `'url'` or
   `'text'`. Rule: trim the value; it's `'url'` only if it is a **single token**
   (no internal whitespace) matching `/^https?:\/\/\S+$/i`. Everything else is
   `'text'`. Export it as a named export so it is unit-testable.
2. Use `useTranslation('jobAdInput')` (new namespace — see Localization). Replace
   the hardcoded label/placeholder with `t()` keys.
3. When `detectJobInputMode` returns `'url'`, show a small inline hint
   (`t('linkDetected')`). No new buttons; detection is automatic on change.
4. Keep writing the raw value up via `setJobText`. The component does NOT fetch —
   fetching is decided in the submit flow (Task 3) so the existing
   `uploadAndAnalyze` path stays the single entry point.

Keep the component a default export. Do not change its prop names.

---

## Task 2 — URL fetch route (`pages/api/fetch-job-url.js`)

New file. Mirror the structure of `pages/api/get-analysis-status.js` exactly
(method guard, `requireAuth(handler)` default export, `logger` usage).

- POST only; 405 otherwise.
- Body: `{ url }`. `user_id` from `req.user` (do not trust body).
- **Validate + SSRF guard (mandatory, tested):**
  - Parse with `new URL(url)`; protocol must be `http:` or `https:` else 400.
  - Reject hostnames that are loopback / private / link-local: `localhost`,
    anything resolving to `127.*`, `10.*`, `172.16–31.*`, `192.168.*`,
    `169.254.*`, `0.*`, `::1`, `fc00::/7`, `fe80::/10`. Block by hostname pattern
    AND, where feasible, by resolved IP. Reject `file:`, `ftp:`, etc.
  - Return 400 with a clear `error` for any rejected URL.
- Fetch with an 8s timeout (`AbortController`) and a desktop `User-Agent`.
  Reject non-HTML `Content-Type`. Cap body at ~2 MB (stream/limit).
- Strip `<script>`, `<style>`, `<nav>`, `<header>`, `<footer>` and tags; collapse
  whitespace; return `{ text }` (clean visible text). If the page yields too
  little text (e.g. < 200 chars → likely a bot wall), return a 422 with an error
  telling the user to paste the text instead.
- On fetch failure/timeout: 502/504 with a clear `error`. Never throw uncaught.
- Use the project logger (`lib/logger.js`), not `console`.

**Dependency note:** use a minimal HTML-to-text approach. Prefer a tiny regex/
strip implementation in this route (no heavy new deps). If you judge a library is
necessary, you may add `cheerio` (already common), but only if it is not already
present — check `package.json` first and prefer zero new deps.

---

## Task 3 — Wire URL fetch into the submit flow

In `pages/index.js` `handleUploadAndAnalyze` (and any other caller that uses
`uploadAndAnalyze` with `jobText` — check `components/StartFresh*` and
`CVUploader.js`), before calling `uploadAndAnalyze`:

- If `detectJobInputMode(jobText) === 'url'`, first `POST /api/fetch-job-url`
  with `{ url: jobText }` (credentials: 'include'). On success, use the returned
  `text` as the `jobText` passed to `uploadAndAnalyze`. On failure, surface the
  route's `error` message via the existing error UI and STOP (do not silently
  analyze the URL string itself).
- Text mode: unchanged.

Keep `utils/uploadAndAnalyze.js` as the single analysis entry point. Do the URL
resolution just before it. Factor the "resolve jobText" step into a small shared
helper if more than one caller needs it, to avoid divergence.

---

## Task 4 — Extend the analysis prompt (`prompts/analysis.js`)

Additive only. Do not remove or rename existing fields (`job_data`, `job_match`,
`analysis.ats_keywords` all stay — downstream depends on them).

- Add a `job_extraction` object to the JSON OUTPUT SCHEMA exactly as defined in
  the spec (position_title, company, location, seniority, employment_type,
  salary, hard_skills[], soft_skills[], must_have_requirements[], nice_to_have[],
  responsibilities[], keywords_for_ats[], language_requirements[]).
- Add FIELD INSTRUCTIONS lines telling the model: populate `job_extraction` ONLY
  when job text is present (`hasJobText`); extract only what is literally in the
  ad; quote exact phrasing; empty array when the ad is silent; never invent.
- Gate the schema block / instructions on `hasJobText` the same way the existing
  scenario list is gated, so a CV-only analysis is unaffected.

---

## Task 5 — Show the extracted list

Render the extracted terms after analysis returns. Extend
`components/AnalysisDisplay.js` (don't fork the display path) with a new section,
shown ONLY when `data.job_extraction` exists and has content.

- Header `t('extractedFromJob')` ("Here's what we pulled from the job ad").
- Labelled lines for title/company/location/seniority/employment_type/salary.
- Hard skills, soft skills, must-haves, nice-to-haves, ATS keywords,
  responsibilities, language requirements each rendered as a tag/chip list
  (reuse existing Tailwind styling patterns in the file; simple `<ul>`/spans are
  fine — match the surrounding code).
- Read-only for v1. No editing. Skip cleanly when fields are absent.
- Every label via `t()` in the `analysisDisplay` namespace.

---

## Localization (all three locales: en, cs, pl)

react-i18next is wired manually in `i18n.js`. For each new string:

1. Add keys to `locales/en/analysisDisplay.json` (extraction section labels) and
   create a new namespace file trio `locales/{en,cs,pl}/jobAdInput.json` for the
   input box strings.
2. For the new `jobAdInput` namespace: add the import lines and register it in
   the `resources` map for en/cs/pl AND in the `ns: [...]` array in `i18n.js` —
   follow the existing pattern for every other namespace exactly.
3. Add the matching keys to `cs` and `pl` versions of `analysisDisplay.json`.
   Provide real Czech and Polish translations (the app already ships cs/pl). If
   you are not confident in a translation, still provide a correct, natural one —
   do not leave English placeholders. Keep key sets identical across the three
   locale files (no missing keys in any language).

Do not hardcode any user-facing English in components.

---

## Task 6 — Tests (Vitest; obey the Testing Law)

Use the existing `vi.hoisted` + `vi.mock` style from `__tests__/`. Mock ONLY
external boundaries (network/`fetch`, Supabase, the verifyToken auth boundary).
Never mock the unit under test.

Required test files and cases:

1. `__tests__/job-input-mode.test.js` — real `detectJobInputMode`:
   - `https://example.com/job/123` → `'url'`
   - `http://x.io` → `'url'`
   - plain pasted ad text → `'text'`
   - text that merely CONTAINS a url ("see https://x.io for more") → `'text'`
   - empty / whitespace → `'text'`

2. `__tests__/fetch-job-url.test.js` — real route handler via `requireAuth`,
   `global.fetch` mocked:
   - **Negative (auth):** missing/invalid token → 401, outbound fetch never
     called. (Mock `verifyToken` to return null.)
   - **Negative (SSRF):** `http://localhost/...`, `http://127.0.0.1/...`,
     `http://169.254.169.254/...`, `http://192.168.0.1/...`, `file:///etc/passwd`
     each → 400, fetch never called. (This is the security/attack test the law
     requires — assert fetch was NOT called.)
   - Non-POST → 405.
   - Happy path: valid public URL, mocked HTML response → 200 with stripped
     `text` that contains the visible body text and does NOT contain script/style
     contents or tags.
   - Bot-wall / tiny body → 422 with error.
   - Fetch timeout/throw → 5xx with error, no uncaught throw.

3. `__tests__/analysis-job-extraction.test.js` — prove the prompt change:
   - Call `buildAnalysisPrompt(cv, job, true)` and assert the returned prompt
     contains the `job_extraction` schema keys and the "only when job present /
     never invent" instruction.
   - Call with `hasJobText = false` and assert `job_extraction` instructions are
     gated out (regression guard that CV-only analysis is unchanged).

Each test must assert specific values and be capable of failing. No
`expect(true)`, no lone `toHaveBeenCalled()`.

---

## Definition of done (verify before declaring complete)

1. `npm test` (or `npx vitest run`) — ALL tests green, including the new ones.
2. `npm run build` — succeeds (Next build clean, no type/lint breakage).
3. New + existing flows manually traced: URL paste → fetch → analyze → extracted
   list shown; text paste → analyze → extracted list shown; CV-only (no job) →
   unchanged, no extraction section.
4. No hardcoded user-facing strings; en/cs/pl key sets identical.
5. No new secrets, no `createClient` in routes, auth from `req.user` only.
6. Run the security-review / code-review skill on the diff; fix what it finds.
7. Commit with a clear message and push to the working branch
   `claude/gallant-lamport-6x7lqc`. Do NOT open a PR unless asked.

State explicitly in your final message: tests run + result, build result, and
that each Definition-of-Done item passed. If anything could not be verified
(e.g. outbound network blocked by the environment policy for a live URL test),
say so plainly and explain how you verified it instead — do not paper over it.
