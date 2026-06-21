# Smart Job Input — Specification

## Goal

Replace the plain "paste job description" textarea with one smart box. The user
either pastes a **URL** or pastes **text**. The app figures out which, gets the
job ad content, pulls out the important details, and shows the user a clean list
of the extracted terms before the CV↔job analysis continues.

## 1. The input box (frontend — `components/JobAdInput.js`)

- One textarea. Same look as today, new placeholder: "Paste the job ad — text or
  a link".
- On blur / on submit, decide the mode:
  - **URL mode** if the trimmed value is a single token that matches a URL
    pattern (`^https?://\S+$`, no internal whitespace).
  - **Text mode** for everything else.
- The component reports both the raw value and the detected mode upward, so the
  existing `jobText` flow keeps working.
- No new buttons. Detection is automatic. Show a tiny inline hint once a URL is
  recognised ("Link detected — we'll fetch the job ad").

## 2. Getting the job ad content

### Text mode
Use the pasted text as-is. No fetch.

### URL mode — new route `POST /api/fetch-job-url`
- Wrapped in `requireAuth` (it makes an outbound network call). `user_id` from
  `req.user`, never the body.
- Body: `{ url }`. Validate: must be `http`/`https`, reject anything else.
- **SSRF guard (mandatory):** reject private/loopback/link-local hosts
  (`localhost`, `127.*`, `10.*`, `192.168.*`, `169.254.*`, `::1`, etc.) and
  reject non-HTML responses. Cap response size (e.g. 2 MB) and timeout (~8 s).
- Fetch the page, strip nav/scripts/styling, return clean visible text.
- On failure (blocked host, timeout, empty page, bot wall) return a clear error
  so the UI can tell the user to paste the text instead.
- **Network note:** outbound fetch depends on the environment's network policy.
  If the deployed policy blocks arbitrary outbound hosts, URL mode will fail and
  the user must paste text. This needs confirming before build.

The fetched text becomes `jobText` and flows into the existing
`uploadAndAnalyze` → `analyse-background` path unchanged.

## 3. Extracting the important details

This already partly exists. The analysis prompt (`prompts/analysis.js`) returns
`job_data` (Position, Seniority, Company, Industry, Country, HR Contact) plus
`job_match` keywords and `analysis.ats_keywords`. We extend it so the extracted
terms are explicit and complete.

Add a dedicated `job_extraction` block to the JSON schema in
`prompts/analysis.js` (only populated when job text is present):

```
"job_extraction": {
  "position_title": "",
  "company": "",
  "location": "",
  "seniority": "",
  "employment_type": "",        // full-time / contract / etc.
  "salary": "",                 // if stated, else "n/a"
  "hard_skills": [],            // tools, tech, certs named in the ad
  "soft_skills": [],
  "must_have_requirements": [],
  "nice_to_have": [],
  "responsibilities": [],
  "keywords_for_ats": [],       // exact terms recruiters/ATS will scan for
  "language_requirements": []
}
```

Rules in the prompt: extract **only** what is actually in the ad, quote exact
phrasing, never invent. Empty array where the ad is silent. This is additive —
the existing `job_data` / `job_match` fields stay so nothing downstream breaks.

## 4. Showing the user the extracted list

New panel rendered after analysis returns (extend `AnalysisDisplay.js` or a small
new `JobExtractionDisplay.js`), shown only when `job_extraction` is present:

- Header: "Here's what we pulled from the job ad".
- Title / company / location / seniority / salary as labelled lines.
- Hard skills, soft skills, must-haves, nice-to-haves, ATS keywords each as a
  chip/tag list.
- This is read-only for v1 (display + confirm). Editable chips are a later
  enhancement, not in scope here.

The user sees this list, then proceeds to the CV+job analysis as today — the
same `job_extraction` data is already part of the saved analysis, so the
generators can use it.

## 5. Testing (per the repo's testing law)

- `fetch-job-url`: real route. Negative tests — missing/forged session rejected;
  private-IP / `file://` / non-HTTP URL rejected (SSRF); oversized + timeout
  handled. Mock only the outbound HTTP boundary.
- URL-vs-text detection: unit test the real classifier on URLs, text, and edge
  cases (text containing a URL → text mode).
- Extraction: feed a known job-ad string through the real prompt-built call
  (Gemini mocked at the boundary) and assert the parsed `job_extraction` shape.

## Open questions (confirm before building)

1. Does the production network policy allow outbound fetch to arbitrary job-board
   hosts? If not, URL mode is dead on arrival.
2. Should the extracted list be editable before analysis, or display-only for v1?
