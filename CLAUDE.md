# CLAUDE.md — a1 / mysuper.cv

## Interaction rule (binding — never violate)

NEVER use the `AskUserQuestion` tool / multiple-choice question box. Not once, ever.
If you need to ask the user something, ask it in plain text in the chat and let
them answer in plain text. The question-box artifact is forbidden in this repo.

## What this is

CV and cover-letter generator with token-based billing. Deployed at **mysuper.cv**.

- User uploads CV (PDF/DOCX) → optionally pastes job description → app analyses CV ↔ job → user picks tone → generates tailored CV, cover letter, or both.
- Each generation costs 1 token. Tokens bought via Stripe (€6/€8/€23/€42 for 1/2/10/30).

Read `DB.md` for the full Supabase schema — tables, columns, RPCs, and the SQL to wipe a test user.

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 Pages Router (JS, no App Router migration) |
| Database | Supabase (service-role key only; anon key never used for writes) |
| Sessions / rate-limit | Upstash Redis (`@upstash/redis` + `@upstash/ratelimit`) |
| Payments | Stripe |
| Email | Resend (configured) — **but the magic-link route actually sends via nodemailer/Gmail SMTP**, see Security rules |
| AI | **Gemini** (model constants in `utils/openai.js`, one per task — see AI layer) |
| Styling | Tailwind CSS |
| i18n | react-i18next, namespace JSON in `locales/{en,cs,pl}/` registered in `i18n.js` |
| Deployment | **Netlify** (`@netlify/plugin-nextjs`) |
| Monitoring | **Sentry** (`@sentry/nextjs` for routes/edge, `@sentry/node` in the background fn) |
| Logging | Leveled logger in `lib/logger.js` (info/debug silenced in production) |
| Secrets | **Doppler** (injects env vars at build/runtime; do not commit secrets) |

## AI layer

- `utils/openai.js` (misleading name — calls **Gemini**, not OpenAI) via the Gemini OpenAI-compatible endpoint. Model is chosen per task by the constants at the top of the file, allocated by task nature: **lite** for extract/classify/check-against-a-schema-or-source (verifiable; lite ≈ flagship at a fraction of the cost) — `GEMINI_EXTRACTION_MODEL` (job-ad parsing), `GEMINI_MASTER_MODEL` (master build/merge, once per user, backstopped by verify), `GEMINI_VERIFY_MODEL` (the master verify checker); **flash** for strategy + prose that can't be fully verified — `GEMINI_ANALYSIS_MODEL` (the strategic brain) and `GEMINI_GENERATION_MODEL` (CV/cover prose). Putting the per-use heavy calls on flash also keeps them off the overloaded flash-lite pool. Raise a lite constant for more quality; never hardcode a model string elsewhere (`GEMINI_GENERATION_MODEL` is EXPORTED so tests can count writing calls without a second copy of the string). **Model choices are made by RUNNING them, not by reasoning about them** — `scripts/test-generate.mjs` against a real record and a real ad, at least two samples per model, and the result recorded in `COVER_LETTER_LOG.md`. Measured 2026-08-15: writing on `gemini-3.6-flash` beats `3.5-flash` at a THIRD of the cost ($0.021 vs $0.063 a write); the checkers on `gemini-3.5-flash-lite` beat `2.5-flash-lite` decisively (7 specific corrections on a CV where 2.5 returned 18 blanket "invented claim" verdicts that duplicated bullets and stripped their markers). `gemini-3.5-pro` and `gemini-3.6-pro` do not exist on the API. Key rotation via `utils/key-manager.js` over `GEMINI_API_KEYS`.
- The OpenAI-compatible endpoint cannot set `safetySettings`. Mild profanity (e.g. the "cocky" tone's "shit-hot") comes through fine; if Gemini ever sanitizes output, the only lever is switching that call to the native `generateContent` endpoint with `BLOCK_NONE`.
- Pricing is in `PRICING` in `utils/openai.js` — the single source of truth. Verify rates at ai.google.dev/gemini-api/docs/pricing. Per-call cost is logged to the browser console as `[Gemini] …` and written to the `transactions` table via `logAiTransaction()` in `utils/database.js`.
- **Every** AI call — not just the successful ones — is metered inside `callGemini` by `utils/ai-meter.js`, which writes its `transactions` row. There is NO spend cap — see "AI cost tracking".
- The prompt builders in `prompts/` are provider-agnostic; tone definitions live in `prompts/tone.js` (shared by cv-generator and cover-letter).
- **Only `Formal` is offered.** `OFFERED_TONES` in `prompts/tone.js` is the single source of truth for the tone selector (`pages/me.js`, `components/ToneDocModal.js` both import it). Friendly, Enthusiastic and Cocky are HIDDEN, not deleted: the candidate's voice profile now owns the writing prompt, so a tone that only changes mood no longer changes the output. Their definitions stay so an older document still regenerates in the tone it was written in. Re-offer one only after it demonstrably differs on a real run, and log that run.

## Master CV (per-user source-of-truth)

Each user has one persisted **master CV** — a structured career record (facts + verbatim `voice_samples` + transferable-value notes) in `cv_data.master_cv` (JSONB). It is the durable thing analysis reasons from, built once and reused across every later job match. See `prompts/master-cv.js` (build + merge modes) and `buildOrMergeMaster()` in `utils/openai.js`; read/write via `getMasterCv()` / `saveMasterCv()` in `utils/database.js`.

- **Build = PURE EXTRACTION (no analysis):** the worker builds the master from the raw CV text the first time it's absent, persists it, cost-logs it. The build is transcription only — every role kept separate with verbatim dates, gaps intact; it NEVER merges two roles into one consultancy or makes any interpretive/structural call. **It never nests.** Where a role's dates fall inside the person's own practice's span it reports the pair in `role_overlaps` (`{ umbrella_index, role_index, answer }`) and `/me` asks them (`components/RoleOverlapQuestions.js`); their answer runs through `applyOverlapAnswer()` in `utils/master-schema.js` — the ONLY thing that moves a role into `fractional_engagements` — and saves through `/api/update-master`. Dates cannot tell client work from a salaried job held at the same time, and the model guessed differently on consecutive runs of the same text (temperature 0 did not settle it; Gemini is not deterministic). Do not restore automatic nesting. Tests: `__tests__/role-overlaps.test.js`. Because it's pure extraction (verifiable, backstopped by the verify pass), it runs on the cheap `GEMINI_MASTER_MODEL` (flash-lite) — a weak model is safe here precisely because the build interprets nothing. Falls back to raw text only if the build fails.
- **Source split (TEASER reads the RAW CV; DEEP pass reads the MASTER):** first impressions live in physical ORDER and SALIENCE — a recruiter (and a dumb ATS field-dump) hits whatever sits highest first, so two short most-recent stints landing above the spanning consultancy that explains them IS the signal. The master is an intelligent, reordered, reconciled record: it does that reasoning for the recruiter (consultancy explains the stints, overlap logged as a resolved `role_overlap` conflict) and dissolves the very first-impression signal the **teaser** (`analyzeTeaser`) exists to surface. So the teaser reads the **raw `cv_data` text**, where order/salience/messiness survive. The **deep pass** (`analyzeCvJob`) reads the **master** (`JSON.stringify(master)`): it emits the rewrite blueprint AND `master_flags`, whose `target.index`/`child_indexes` point into the master's `experience[]`, so it must see that exact array — and it is handed the teaser, whose raw-based verdicts carry forward verbatim (`CARRIED_FROM_TEASER`), so the warning the raw read caught survives instead of being recomputed away. The **layout signal** carries only the GRAPHICS the text can't show — column scramble, scanned/image — and drives ONLY the ATS gate (teaser). **It is never stored:** computed at upload (`extractCvWithLayout`, geometry only the file shows), returned by `/api/upload-cv`, ridden in on the `analyse-background` request body, read once, discarded. A re-analysis with no fresh upload has no layout → the ATS gate judges on the text alone (fine).
- **One CV, one profile:** every upload mints/refreshes the identity and rebuilds the master from that single CV (`uploadAndAnalyze` → `/api/upload-cv`). There is no multi-CV add-to-profile or merge flow. `prompts/master-cv.js` carries a `merge` mode, but no live path calls it. Identity always from `req.user`.
- **Verify pass (runs after every build/merge, i.e. each time the CV is updated):** `buildOrMergeMaster` automatically follows the build/merge with `verifyMaster()`. It is a safety net for cheap-model slips: (1) a **deterministic code check** drops any `voice_sample` that isn't a real substring of the source (catches paraphrased "verbatim" quotes, no AI); (2) **one targeted AI call** (`buildMasterVerifyPrompt`) flags only a wrong most-recent-role country, gaps that contradict the extracted data, and skills/metrics unsupported by the source — corrections are applied deterministically, so it cannot rewrite `candidate_core` / `transferable_notes` / achievement text (no churn). On merge it gets the existing master as "trusted prior facts" so legacy content isn't flagged. `buildOrMergeMaster` returns `usages: [build/merge, verify]`; **log every entry** (the cost-logging rule covers the verify call too).
- **`voice_guide` (user-authored, never AI-written):** an optional prose field on the master — the candidate's own statement of how they write. No prompt emits it and no verify pass rewrites it; `normaliseMaster` carries it from the stored record (the editor cannot overwrite it, like `voice_samples`), the merge/augment prompts copy it through verbatim, and `saveMasterCv()` re-attaches it whenever an incoming record lacks one — otherwise a rebuild from a fresh CV upload would silently delete it. Both generators read it for voice only: cadence, sentence shapes, vocabulary. It is Layer 2 in the CV stack (`CV_RULES.md` → `humanScannability()`), so it never overrides parseability, bullet limits, banned phrasing or the invariants, and never licenses a fact the master lacks. Tests: `__tests__/voice-guide.test.js`.
- **Never-fabricate** is absolute here too: the master records only what the input evidences; gaps stay gaps. The build prompt's SELF-CONSISTENCY block + the verify pass are the two layers that keep gaps/country/conflicts honest on a cheap model.

## Voice (per-user, cover letters only)

The **voice profile** makes a cover letter sound like the person applying instead of like a language model. It lives in `cv_data.voice_profile` (JSONB, `009_voice_profile.sql`) — **never inside `master_cv`**, and that separation is load-bearing: the master is the evidence set the truth-verify pass and the Layer 6 validator check every claim against, so voice text stored there would launder a sample's wording into a "supported" fact. `prompts/voice-profile.js` + `prompts/voice-check.js`; `getVoiceProfile()` / `saveVoiceProfile()` in `utils/database.js`; route `pages/api/voice-profile.js`; UI `components/VoiceProfilePanel.js` (on `/me`).

- **Input is the user's own writing, never their CV.** Two to four samples, 300+ words each (one is accepted with a stated warning that the result is weaker). Bullet fragments carry no voice, so the CV is refused.
- **The register is READ, never asked.** The extraction infers from the text itself what each sample is — previous application, work email, public writing, personal message — and returns it as `registers[]`, which the UI shows back and which calibrates how far each List B translation has to travel. There is no label question and no label buttons: a question the model can answer itself is not worth asking, and the samples carry only their text.
- **One extraction call** (`buildVoiceProfile()`, on `GEMINI_ANALYSIS_MODEL` — judgment about prose, and it runs once per user) returns 15–25 plain-prose observations, **not scores or tags**, split into two lists:
  - **List A — carries across registers.** Applied directly: sentence length and variation, leading with the point vs building to it, hedging, concreteness, quantification, punctuation habits, transitions, metaphor, how they open and close.
  - **List B — register-bound.** Profanity, slang, casual openers, rhetorical questions, second-person, emoji, fragments, subject-specific vocabulary. **Never applied raw.** Each is stored with a **translation** into its business-appropriate equivalent that preserves what the habit was *doing* ("swears when emphatic" → "states it flat, no hedging"). `voiceProfileBlock()` emits List A + translations only; a trait whose translation is empty is dropped. A raw List B trait reaching a generator is the defect that puts profanity in a cover letter — pinned by tests in both directions.
- **The review screen is not optional.** The user edits List A, the translations and their own lines, and their lines outrank the extracted ones. Their edits and the `cleanup` option survive a re-extract.
- **Generation** hands the letter the profile block plus **1–2 short excerpts** of the samples (`voiceExcerptBlock()`), because a description of cadence loses the cadence. The excerpts are fenced absolutely: manner only, no fact, no claim, no number, no phrasing, and the master wins any contradiction.
- **The WRITER owns the voice — it is not a pass applied afterwards.** The profile and the candidate's own writing sit at the TOP of `prompts/cover-letter.js`, above the rules, with the shape stated as targets before a word is written (at least one sentence ≤6 words, wide variation, no paragraph past ~90 words, no stub-chopping, open on a concrete thing done). Two owners for one document (draft + separate restyle pass) is the defect; do not reintroduce it.
- **`applyVoice()` NO LONGER RUNS ON THE COVER LETTER — one document, one owner.** It survived for a while as a fallback for a draft that measured flat. Run against a real record and a real ad it did the opposite: handed a thin draft it satisfied `coverShapeFaults` literally and produced a five-word orphan paragraph ("Data must drive the algorithm."), which is a second model reshaping the first model's letter — the very defect the writer-owns-the-voice change settled. A flat draft is a WRITING-PROMPT problem and is fixed in `prompts/cover-letter.js`. Do not reintroduce the call. `coverShapeFaults` / `coverBreadthFault` survive as Layer 6 measurements only.
- **No appropriateness or rigidity check is layered on top.** Where the profile and business convention conflict, **the profile wins**; mild informality is an acceptable outcome and a letter that reads slightly too casual beats one that reads like a template. The only limits are the ones that already existed: the invariants and the truth passes.
- **The CV is not promised voice.** Bullets are bullets and the constraint there is accuracy; the UI says so. `voice_guide` (see the master-CV section) still reaches the CV as Layer 2.
- Tests: `__tests__/voice-profile.test.js`, `__tests__/apply-voice.test.js`.

## The cover letter (READ THIS BEFORE TOUCHING prompts/cover-letter.js)

**The letter exists to PERSUADE — one job: the reader decides to call this
person for an interview.** It is not a compliance artefact. The CV is the
record and its constraint is accuracy; the letter argues, and argument is the
point. `CV_RULES.md`, "What the cover letter IS", is the binding statement of
this and wins over any rule that disagrees.

**The rule stack was removed on 2026-08-15, and the removal is evidence-based.**
`prompts/cover-letter.js` produced a 51,721-character prompt of which ~33,000
characters were byte-identical for every user and every job. Nik's own four-line
prompt — the master record, the ad, "highlight the achievements that align with
the requirements, professional tone, 250-400 words" — beat it decisively on the
same model, the same record and the same ads, while breaking three of the rules
this file enforced. The stack is now Nik's prompt plus only what earns its
place: the candidate's VOICE, their STEERING, the output LANGUAGE, and the
letter's furniture (date, salutation, signature, length).

**Do not restore a rule to that prompt without a run that shows the letter is
better with it.** Every rule the stack contained was plausible; together they
made the letter worse, and no test in this repo could see it. The measurements
that condemned them:

- the letter opened on the candidate's most recent job, because a rule said
  "open on a fact the candidate did" — a reader cares about their OWN mission
- it never answered what the ad said it did NOT want. An ad states its fear in
  the negative ("ne někoho, kdo celý den obvolává studené kontakty"), and
  answering that with a real fact is the most persuasive move available. No
  rule mentioned it existed.
- it chose recent evidence over RELEVANT evidence — a 2017 lectureship is the
  right proof for a job about presenting to teachers.
- it wrote flowing prose where labelled themes show the match faster, because
  the shape was prescribed rather than chosen.

**What persuasion never licenses:** invention. The one absolute in the writing
prompt is that nothing is invented, inflated, or claimed beyond the record.
Truth is enforced downstream, where it demonstrably works — the verify pass and
`utils/cv-validate.js`, both of which ran clean over the minimal prompt's
output.

**Rules deliberately dropped, with the run that condemned each:**

- **Check 12 (identity epithets) does not run on the letter.** "As an
  experienced product leader" opened the letter Nik judged far better than
  anything the pipeline produced. It still binds on the CV.
- **Derived arithmetic from bounded numbers is legitimate.** "under $20k to
  over $100k" IS more than fivefold — the bounds make the multiple a FLOOR, so
  the claim is accurate and conservative. Flagging it flagged a true,
  understated number as fabrication.

**The salutation recognises a NAME, not a title** (`salutationName()` in
`prompts/cover-evidence.js`). Job titles are inventive now — "Chief Happiness
Officer", "People & Culture Lead" — so a keyword list of titles cannot work.
The test is inverted: a token is a name unless it is a structural word, and the
whole contact is refused unless a person survives. "Dear Chief Happiness," is
impossible, an email address is never a salutation, and no name is ever
guessed. Czech and Polish decline it into the VOCATIVE ("Vážený pane Nováku,").

## CV rules (the layer stack)

**`CV_RULES.md` at the repo root is the SOURCE OF TRUTH (binding).** It is the prose statement of what a generated CV must be, and it wins over any code that disagrees with it.

**Any change to CV behaviour starts there and cascades down.** Edit `CV_RULES.md` first and get it approved; then change `prompts/cv-rules.js` / `scenarios.js` / `market.js` / `cv-sections.js`, then `cv-generator.js` / `cover-letter.js`, then `utils/cv-validate.js`, then the locale warning strings, then the tests. Never the other way round: a rule that exists only in code, or a code change that quietly contradicts the doc, is the defect that put "no bullets in the Summary" into three files at once. If code and `CV_RULES.md` disagree, the doc is right and the code is fixed — never the reverse without Nik editing the doc.

`prompts/cv-rules.js` is its implementation. `cv-generator.js` imports `cvRulesBlock(hasJobText)` for the whole stack; `cover-letter.js` imports `cvInvariants()` and `coverMatchingRule(hasJobText)`. Precedence: **Layer 4 > Layer 3 > Layer 2**, with **Layer 1 as the floor beneath all three** and the invariants above everything.

| Layer | What it governs | Lives in |
|---|---|---|
| 0 — Invariants (T1–T4) | never fabricate; never falsify titles/employers/dates; no invented timeline entries; parseability is a floor | `prompts/cv-rules.js` |
| 1 — Machine parseability | standard section names, single column, official titles, MM/YYYY dates, 10–15 year recency window, education years | `prompts/cv-rules.js` |
| 2 — Human scannability | the ~120-word impact zone, bullet form, metric fallback, bullet ceilings, no paragraphs in Work Experience | `prompts/cv-rules.js` |
| 3 — Job matching (job ad only) | bounded keyword coverage, priority alignment, relevance-based selection; the cover letter answers the ad's requirements with evidence | `prompts/cv-rules.js` |
| 4 — Situational overrides | per-scenario CV mitigations, max two active | `prompts/scenarios.js` |
| 5 — Market conventions | photo / DOB / consent / page count per target market | `prompts/market.js` |
| 6 — Output validation | deterministic checks over the finished document | `utils/cv-validate.js` |

- **T2 in practice:** omission is permitted, alteration is not. Normalising a date's FORMAT to MM/YYYY is required; changing a date is forbidden. Year-only dates are never used to soften a gap — the "Earlier Career" line is the only undated entry a CV may carry.
- **The impact zone** is the Summary section: headline, a 2–3 sentence value proposition, then UP TO three achievement bullets that each name the role and employer they came from, all inside the first ~120 words. They come from `generation_framework.cv_blueprint.top_three_achievements`. Three is a **ceiling, not a quota** — a thin record prints fewer. Their repetition under the roles is **deliberate**: a recruiter who reads only the top block still sees the strongest results. Pinned by tests in both directions (Summary must carry bullets; Summary must not exceed the ceiling).
- **Openers name facts, not identities — ON THE CV.** "veteran", "seasoned", "accomplished", "industry expert", "technology leader" and equivalents are banned in the Summary and headline — a category asserted in place of evidence, and an age signal under an Older Applicant override. Check 12 warns. **It does NOT run on the cover letter**: there the same words are ordinary persuasive English, and the ban was costing more than it saved (see "The cover letter" above).
- **Layer 1 forbids layout HTML.** Skills render as a single-column bullet list; the validator hard-blocks any `div` / `table` / `ul` / `img` in the output. `utils/exportDocxFormatted.js` flattens such tags anyway, so a column grid buys nothing and costs parsing.
- **Layer 5** keys off the job's country when there is a job ad, otherwise the candidate's own (`targetCountry()`). An unrecognised country falls back to the neutral default. It never generates a photo, date of birth or consent line the candidate did not supply.
- Unit tests: `prompts/cv-rules.test.js` (all layers, both prompts), `utils/cv-validate.test.js`.

### Languages (this is an EU product — nothing here is English-only)

`prompts/cv-sections.js` is the registry of standard section names per language (`en`, `cs`, `pl`), plus the per-language bullet-length band. **Adding a language is one entry in that file and nothing else.** Each slot holds an array: the first value is canonical (what the generator is told to write), the rest are accepted market variants the validator treats as equally valid.

- `sectionNameBlock(language)` gives the generator the exact headings for a known output language; on `auto` it states the rule without picking a language, because the model resolves that from the master CV.
- The validator accepts a heading that is standard in **any** registered language **or** named by the blueprint's `section_order`. Both sources are needed: `section_order` is written in the CV's language while the document may be generated in another (`prompts/language.js` lets the candidate pick), so neither alone can judge a Czech CV built from an English record. A creative heading is in neither and still hard-fails.
- `isSlot()` recognises the "Earlier Career" line and the Projects section in every registered language, so a Czech CV's collapsed-roles line is not mistaken for an ordinary undated role.
- `BULLET_BAND` is per language because Czech and Polish carry the same content in fewer words — no articles, heavy inflection. An unregistered language falls back to the default band rather than being judged on English assumptions.
- **Warnings are `{ code, params }`, never sentences.** `TabbedViewer.js` renders them through `t('cvWarning.<code>', params)`, with strings in `locales/{en,cs,pl}/tabbedViewer.json`. Hard failures stay English: their only readers are the log and the generator itself on the retry.
- `GENERATION_LANGUAGES` in `prompts/language.js` is what the candidate can explicitly pick (currently `auto`, `en`, `cs`). The section registry is deliberately wider — a Polish master CV generates in Polish through `auto`.

## Truth enforcement (three stages, in order)

The never-fabricate rule is enforced at three points, not one. Each catches what the previous cannot.

1. **Prompt** — REFRAME vs ADD in `prompts/analysis.js` governs every instruction the strategist gives; T1–T3 in `prompts/cv-rules.js` bind both generators. A capability the candidate lacks reaches the user only as `analysis.ats_keywords_missing`, which is barred from `skills_to_highlight` and from the CV.
2. **AI verify pass** — `prompts/generation-verify.js` + `verifyGeneratedDoc()` in `utils/openai.js`, run over every generated CV and cover letter. It never rewrites: it returns exact spans, and `applyGenerationCorrections()` applies them by literal string match, discarding anything not verbatim in the document. Five categories: invented fact, invented number (incl. **derived tenure** — any "X+ years" the record does not state), upgraded claim (contributed → led, team → department, exposure → expertise), borrowed requirement, and **unearned intensifier**.
   - **Rule 2b — derived arithmetic**: a figure the document COMPUTES from real ones ("a gain of over 400%" from "under $20k to over $100k", a fivefold increase, an annual total). Nothing is fabricated and every input is real, which is exactly why every other category passed it. `CV_RULES.md` T1 says so outright.
   - Rule 5 is deliberately narrow — it reaches only fact-shaped degree claims: totality/uniqueness ("single-handedly", "revolutionised"), self-assessed expertise ("expert in", "world-class") over ordinary use, and magnitude that overshoots a number the master records. Strong action verbs, evaluative words ("strong", "significant", "effective") and the chosen tone's deliberate vocabulary are explicitly out of its reach. The pass is conservative throughout: when in doubt it does not flag, because a false flag costs a real achievement.
3. **Deterministic validation** — `utils/cv-validate.js`, described below.

## Output validation (Layer 6)

`validateCv(document, { master, analysis, language })` in `utils/cv-validate.js` is code, not a prompt, so it cannot hallucinate a violation. It returns `{ ok, hard, warnings }`.

- **Hard (checks 1–4):** every number in the document traces to the master; dates match the master and are MM/YYYY throughout Work Experience; no Work Experience entry that is not a real role; single column, no layout HTML, section names standard in some registered language or named by the blueprint.
- **Hard (check 10):** with the Older Applicant override active, no graduation year in Education and no "X+ years" anywhere. Hard rather than a warning because it is pure arithmetic and one stray year undoes the whole override.
- **Warnings (checks 5–9, 11–12):** impact zone within ~120 words carrying its achievement bullets, each naming its role; bullet ceilings and the metric-fallback share; no invented photo/DOB/consent; unevidenced job requirements listed as gaps; a Projects section only under an Under-qualified or Career Pivot override; an Earlier Career line that names at least one real employer from the master (check 11); no identity epithet in the Summary or headline (check 12).
- **The cover letter's own slice (checks 17–23)** runs through `validateCoverLetter()` in the same file: banned phrasing, the market word band (the one hard failure), matched pairs, salutation, one objection, stray numbers, and **check 23 — an invented domain**. Check 23 does NOT warn: like check 17 it is the app's own writing failing, so `unsourcedDomainHits()` feeds `repairUnsourcedDomains()` in `utils/openai.js` (one narrow `GEMINI_VERIFY_MODEL` call through `buildPhraseRepairPrompt({ kind: 'domain' })`, corrections applied by literal string match) and the word is gone before delivery. The hit list is a **closed list** of industry labels (`DOMAIN_TERMS`), matched by diacritic-folded 6-character stems so CZ/PL inflection counts as one word, against the **master alone** — the ad is NOT a source, since it names where the EMPLOYER works, not the applicant's background. The list is closed on purpose — judging every word by whether the sources used it flags ordinary prose. Grow the list only by adding a term actually seen invented. The repair never substitutes a different industry (there is no source for one either) — it says what the candidate did and drops the label.
- **The letter reads the AD ITSELF, verbatim.** `analyzeCvJob` attaches the raw ad text to the analysis record as `analysis.job_text` (capped at 8k) — attached THERE, in `utils/openai.js`, not in the Netlify worker, so every caller gets it: the worker, `scripts/test-generate.mjs`, and anything added later. `rawAdBlock()` in `prompts/job-target.js` renders it for the cover letter; `targetJobBlock()` (the extraction) stays the fallback for records saved before this and for standalone reviews, and remains what the CV uses. This is load-bearing and was the single biggest cause of every letter reading the same: the extraction is a de-natured bullet list, an ad has a REGISTER ("nebojí se computer science", "neexistuje žádný univerzální recept"), and a letter that reads as written for THIS job is one that answered that register. Do not "simplify" the letter back onto the extraction.
- **`dressCv()` — the CV's counterpart to `dressLetter()`** (`utils/openai.js`). `prompts/cv-generator.js` states its template with `<!-- BLOCK:START -->` / `<!-- BLOCK:END -->` markers; nothing consumes them, one writing model dropped them and another copied them into the document, and they reached the page. Template punctuation is the prompt's, never the document's. Applied to the draft AND the validation retry — a retry judged on text the candidate would never receive is judged on the wrong document.
- **Span surgery cleans up after itself** (`applyGenerationCorrections`). Corrections are applied by literal string removal, so a cut leaves debris the checker never sees: a deletion whose quote ran to the end of its sentence ate the full stop and welded the next sentence on ("…a group of twelve Earlier, at Česká spořitelna"); a mid-sentence cut left ", ." on the page. The span is still cut; its terminator is kept where the sentence would otherwise be unterminated, and orphaned punctuation/spacing is normalised — deterministically, no second AI call. Regression tests in `__tests__/generation-verify.test.js` are red on the old code.
- **The letter is COMPOSED, not executed** (`CV_RULES.md`, Layer 3). The analysis hands the letter EVIDENCE — `generation_framework.cover_evidence` = `requirement_evidence[]` (up to five unranked `{requirement, evidence}` the record genuinely answers) + `concerns[]` (`{flag, answer_evidence}`, only those the record can answer) — rendered by `prompts/cover-evidence.js`. It decides nothing: the hook, which requirements are used and in what order, whether a concern is raised at all, and the close are the writer's, chosen at write time when the steering, tone, voice profile and market length are finally all present. **Do not add a field that decides the letter's shape** (names the hook, orders the pairs, picks the objection, sets the close) — that is the writer's job, done with full context, not analysis's. The salutation is the one exception: it is a fact read off `job_extraction.hr_contact` by `salutationName()`, never a plan's pick.
- **Steering is in scope when the document is composed** (`CV_RULES.md`, Invariants). The emphasise / play-down boxes compose into `tweak` (`utils/steering.js`) and reach both generators: demoted content is not evidence (use other real evidence, or leave the requirement unanswered); emphasised content leads and is proved; demotion is never deletion (T2 keeps every role and date); steering never adds a fact. `job-target.js` carries the matching exception. **Check 19 never takes `tweak` and is never suspended** — it warns only when the letter answers NONE of the answerable requirements, which is true regardless of steering. Tests: `__tests__/cover-provenance.test.js`, `__tests__/cover-evidence.test.js`.
- `pages/me.js` renders `cover_warnings` on the cover tab (alongside `cv_warnings`).
- `generateCV()` runs it after the AI verify pass. A hard failure triggers **one** regeneration with `validationFeedback(hard)` appended to the messages; the retry is kept only if it has no more hard failures than the draft it replaces. Every call it makes lands in `gemini_usages`, so the cost-logging rule is satisfied.
- Warnings ride out as `cv_warnings` from the background generation run and render as a banner on the CV tab in `TabbedViewer.js`, translated from their `{ code, params }` form.
- A check whose evidence is missing (no parseable master, no `section_order`) reports nothing rather than guessing.

## Career-scenario layer

`prompts/scenarios.js` is the single source of truth for career scenarios — the durable definition module the prompts import (like `tone.js`/`voice.js`), **not** a stored DB field. Scenarios persist only as `analysis.scenario_tags` / `job_match.career_scenario` inside the analysis JSON blob (`gen_data`); there is no scenario table or column. This is **Layer 4** of the CV rule stack.

- Each scenario carries three things: `detect` (how to recognise it), `handling` (how the **analysis** frames it — feeds `positioning_strategy` + `generation_framework`), and `generation` (the concrete CV mitigations the **generator** applies).
- **Base scenarios** (apply with or without a job ad): Recent Grad, Employment Gap, Job Returner, Older Applicant, Senior Portfolio / Independent Consultant. **Job-relative** (only when a job ad is present): Overqualified, Under-qualified, Career Pivot, Major Pivot, Standard Career Progression. The model picks **1–2 max**, and `scenarioGenerationRules()` caps the rendered block at two regardless of how many tags arrive.
- Wiring: the **teaser** (`analysis-teaser.js`) classifies the scenario FIRST (it steers scan_verdict / hr_first_seconds / red_flags / positioning) and emits `analysis.scenario_tags` — but **never prints the label** (proving scenario-awareness through the specificity of the read, not jargon; labelling "Older Applicant"/"Job Returner" would surface the very bias being managed). `analysis.js` then carries those tags forward (`CARRIED_FROM_TEASER`) so the deep pass applies the handling without re-choosing, and imports `scenarioList` + `scenarioHandling` (the standalone no-teaser path still classifies from scratch); `cv-generator.js` imports `scenarioGenerationRules(scenario_tags)` so the per-scenario mitigations reach the CV. Gating by `hasJobText` keeps job-relative scenarios out of standalone reviews.
- **Older Applicant** manages the age signal at *generation* only — the 10–15 year window applied strictly, early roles collapsed into an undated "Earlier Career" line, graduation years stripped from **every** Education entry (all or none, never selectively), and no "X+ years" anywhere. Trigger: the earliest evidenced role begins more than 15 years before the most recent role's end date. The **master CV is never touched**: it keeps every role and date verbatim; age-management is selection of what to show, never falsification.
- **Employment Gap and Job Returner** keep MM/YYYY dates so the gap is simply visible. Under 6 months: nothing. Over 6 months: no timeline entry and no summary apology — one neutral line only where the master records what happened, in the candidate's own recorded words. Job Returner adds the same handling plus a summary that opens on current capability rather than history.
- **REFRAME vs ADD still absolute:** every `generation` rule reframes/reorders/relabels/cuts real content; none inserts a fact. Unit tests: `prompts/scenarios.test.js`.

## AI cost tracking (the meter — DO NOT make this opt-in again)

**Every AI call is metered inside `callGemini`, and nowhere else.** `utils/ai-meter.js` is the single accounting point: the moment a Gemini response arrives — before parsing, before validation, before anything that can throw — it writes the `transactions` row (`type = 'ai_cost'`, via `logAiTransaction()`) and adds the cost to the day's running total. A call cannot escape it without bypassing the HTTP client.

**Why it moved there.** On 2026-08-15 the bill came in at ~5x what `transactions` could account for. Metering was opt-in at the callsite: sixteen hand-maintained pairs of `logAiTransaction()` + `trackDailySpend()`, all of them AFTER the response was parsed. So (1) a response that failed to parse, a discarded validation retry, or any throw before the logging line was money spent with no row; (2) `scripts/*.mjs` — every model bake-off and experiment — called `utils/openai.js` directly and logged nothing at all, by construction; (3) the guard only wrote a `logger.error` and the run carried on. **Never reintroduce per-callsite cost logging.** A route or worker that logs cost by hand is the defect.

- **NO CONTEXT, NO CALL.** `callGemini` calls `assertAttributed()` first and throws `AiContextError` if there is no AI cost context. A call nobody claimed cannot be billed to a user, a surface or a script, so it is REFUSED rather than recorded as "unattributed" and hoped about — forgetting the one-line declaration costs a crash, not money. The test runner is not exempt: `vitest.setup.js` puts every test in a `context: 'test'`.
- **There is exactly one door to Gemini, and it is guarded by tests.** `__tests__/ai-spend-containment.test.js` fails if any file outside `utils/openai.js` names the Gemini endpoint, if a Google GenAI SDK is imported or added to `package.json`, or if a script under `scripts/` imports `utils/openai.js` without entering a context. A second way to reach the API is a second way to spend invisibly.
- **Attribution rides in an AsyncLocalStorage context**, not in arguments. Entry points wrap themselves: `runWithAiContext({ user_id, context, source_gen_id, detail }, fn)` for workers, `withAiContext('api:x', handler)` INSIDE `requireAuth` for Next routes, `enterAiContext({ context: 'script:x' })` for scripts (plus `setAiContext({ user_id })` once a script resolves its user). The `user_id` on the row is the SESSION user, never a body value — pinned by tests in `__tests__/cv-headline.test.js`, `__tests__/master-add-info.test.js`, `__tests__/voice-profile.test.js`.
- **`context` and `step` land in `detail`**, so the ledger says which surface and which prompt spent the money: `context='generation'`, `step='generate CV (validation retry)'`.
- **EXPERIMENTS ARE SPEND.** `scripts/test-generate.mjs`, `scripts/minimal-cover.mjs` and `scripts/master-determinism.mjs` all enter a `script:*` context, so a bake-off is in the same ledger and counts against the same budget as a user's run. A new script that calls Gemini adds one `enterAiContext` line — otherwise it spends invisibly.
- **THERE IS NO SPEND CAP (owner decision, 2026-08-16).** The old `assertUnderBudget()` / `AiBudgetError` / `GEMINI_DAILY_BUDGET_USD` ceiling is GONE: it blocked real work, including the bake-off runs this file requires before any prompt or model change. What actually made the 5x day impossible to repeat was unconditional METERING, not the ceiling on top of it. Do not reintroduce a blocking cap without an owner order. Spend is SEEN, not stopped: `scripts/ai-costs.mjs`, plus `reportUnpriced()` for calls whose model has no rate.
- **The day's total is read from `transactions`, NOT Redis** (`getAiSpendSince()` in `utils/database.js`, cached 60s, plus locally metered calls added immediately). Upstash is unreachable from the Next server runtime, so the old Redis counter was blind on exactly the paths that spend most. Guard and ledger now read the same rows and cannot disagree.
- **One price list, and an unpriced call is never invisible.** Rates live only in `PRICING` in **`utils/pricing.js`** (shared with the `[Gemini] …` console line and the guard). A model with no rate is `logger.error`-ed, the row is still inserted with `amount_usd = null`, and the guard counts those rows SEPARATELY and reports them rather than treating them as zero. **Adding a model constant means adding its rate to `utils/pricing.js`** — `utils/pricing.test.js` pins that every selectable model has one. `model_pricing` is no longer read by any code path.
- **A metering failure never fails the user's request**, but it is shouted with the full token split so the row can be reconstructed by hand.
- **Seeing the money:** `doppler run -- node scripts/ai-costs.mjs [--days 7] [--by model|context|step|user]` reports the ledger per day, flags unpriced calls, and prints the budget.
- Tests: `__tests__/ai-meter.test.js`.

## Generation flow (async — do not make it synchronous)

A generation run is up to six Gemini calls (write → verify → validate → one retry → re-verify, per document), far past Netlify's 10s synchronous limit. It is a **background function**, same shape as analysis:

- The run itself lives in `utils/run-generation.js` (lock, allowance, source, both AI calls, deferred decrement, saves, cost logging). It is transport-agnostic and throws `GenerationError { code, status, detail }`.
- Browser → `POST /.netlify/functions/generate-background` (relative URL, client-minted `generation_id`), which answers 202 and always publishes a terminal status.
- Status is a `gen_data` row of type `generation_status`, keyed by `analysis_id = generation_id` (`saveGenerationStatus()` / `getGenerationStatus()` in `utils/database.js`); the documents land in `gen_data` as before. Browser polls `POST /api/get-generation-status`. **Not Redis:** Upstash is not reachable from the Next server runtime — the `gen_lock` has always failed open there, silently — so a Redis-backed poll 500s on every call.
- Every call site goes through `utils/generateDocuments.js` — keep them on that single helper.
- `user_id` comes from the verified session cookie in the background function, never the body. Middleware cannot see `/.netlify/functions/*`, so the 10/min `rl_generate` limiter runs inside the function, keyed by user.

## Analysis flow (async — do not make it synchronous)

Gemini analysis runs longer than Netlify's 10s synchronous function limit (which **cannot** be raised on this plan), so analysis is a **background function**:

- Browser → `POST /.netlify/functions/analyse-background.mjs` (15-min budget). Call it with a **relative URL** — never via `NEXT_PUBLIC_SITE_URL` server-to-server, because that hop silently saves nothing.
- **Two-tier analysis, one growing record (build-on, never recompute):** the worker always runs the **teaser** (`analyzeTeaser`, strong model, small/cheap) — the landing-page sell, and the SEED that carries `analysis.scenario_tags` + scores + verdicts. Then, **only for authenticated (past-the-wall) callers** (`verified?.user_id`), it runs the **deep pass** (`analyzeCvJob(cv, job, file, teaserJSON)`), which is handed the teaser and generates ONLY the delta (the rewrite blueprint, action items, full red-flags), merged via `mergeTeaserAndDelta`. Anonymous landing visitors get teaser-only (cheap). The carried fields (`CARRIED_FROM_TEASER` in `prompts/analysis.js`, incl. `analysis.scenario_tags`) are not re-emitted by the delta, so they cannot be clobbered on merge. **Log every analysis call** (teaser + deep) — the cost-logging rule has no exceptions. **Source split:** the **teaser** reads the **raw `cv_data` text** (first impressions live in page order/salience — the master's reordered, reconciled structure dissolves them), plus a **transient layout note** (from the request body, computed at upload, never stored) that drives ONLY the ATS/graphics gate. The **deep pass** reads the **master** (`JSON.stringify(master)`, falling back to raw `cv_data` only if the master build failed) because its `master_flags` index into the master's `experience[]`; it inherits the teaser's raw-based verdicts via `CARRIED_FROM_TEASER`.
- The worker always writes either the analysis **or** an `{ "__analysis_error": "…" }` sentinel to `gen_data` under a client-minted `analysis_id` — never silent. A deep-pass failure keeps the teaser content rather than sinking the run.
- Browser polls `POST /api/get-analysis-status` (`{ analysis_id }`; `user_id` comes from the verified session cookie, never the body) until `done` / `error`. It also returns `_gemini_usage` for the console cost log.
- All three entry points (landing page, CV uploader, Start-Fresh modal) go through `utils/uploadAndAnalyze.js` — keep them on that single helper.
- `/.netlify/functions/*` are **not** served by `next dev`; test locally with `doppler run -- netlify dev`.

### Mothballed analysis fields (kept for revival — do not "restore" them casually)

The read-out is deliberately trimmed to what the candidate can **act on**. These prose fields are **no longer requested by any prompt, no longer filled by `formatAnalysis`, and no longer rendered**:

`summary` (incl. `fit_summary`), `analysis.overall_commentary`, `analysis.cv_format_analysis`, `analysis.cultural_fit`, `analysis.style_wording`, `analysis.suitable_positions`, `final_thought`.

They are **mothballed, not dead** — Nik may want them back. Their absence is intentional; an agent that finds a "missing" field must not re-add it without being asked. To revive one: put its field instruction + schema slot back in **both** prompt bodies in `prompts/analysis.js` (the `review` half and the standalone path), add its key to `REQUIRED_SCHEMA` in `utils/formatAnalysis.js`, and re-add its `<Field>` in `components/AnalysisDisplay.js`. Locale strings for all of them are still in `locales/*/analysisDisplay.json`.

Still generated but **not displayed**: `analysis.career_arc`, `parallel_experience`, `transferable_skills` — the CV generator consumes them through `prompts/analysis-brief.js`. Do not drop them from the blueprint pass.

What remains on screen: scores, ATS keywords present/missing, `quick_wins`, `red_flags`, `action_items`, `positioning_strategy`, and the teaser's first-impression block (verdicts, snags, `hr_first_seconds`, `nuance_clarifications`).

## Judging output — RUN IT, don't reason about it

`scripts/test-generate.mjs` reproduces the REAL generation path with no UI, no
auth, no token spend and no DB writes: `--user <id|email>` pulls the stored
master, voice profile and candidate core out of Supabase through the existing
`utils/database.js` helpers; teaser then deep pass; `--emphasise` / `--play-down`
/ `--freeform` compose through the real `composeTweak()`; `--voice on|off`,
`--language`, `--tone`, `--type`. It prints a VERIFICATION DIGEST — resolved
source, whether a voice profile was used, the tweak verbatim, `cover_evidence`,
red flags, scenario tags, the full validation object (ok / every hard failure /
every warning) and a cost line for every call.

Run it through Doppler (`doppler run -- node scripts/test-generate.mjs …`), or
with `.env.local` if the Doppler token is stale.

**A change to writing quality is not finished until it has been run and the
output read.** Reasoning about what a prompt change should do produced three
days of changes that moved nothing; one real run found the cause in an hour.
The same rule governs model choices and every entry in `COVER_LETTER_LOG.md`.

## Cover-letter quality — READ THE LOG BEFORE CHANGING ANYTHING

`COVER_LETTER_LOG.md` records what has already been TRIED on letter quality and
what it actually did to the output — including the dead ends, which git cannot
show you because a failed experiment gets reverted and leaves no trace. Read it
before proposing a fix, and add an entry after running one. An entry is only
added once the change was RUN against a real record and a real ad and the letter
was read; reasoning about what a change should do is not an entry.

## Sacred files — do not rewrite or inline

```
prompts/analysis.js
prompts/cv-generator.js
prompts/cover-letter.js
prompts/master-cv.js
prompts/cv-rules.js
prompts/generation-verify.js
prompts/cv-sections.js
prompts/voice-profile.js
prompts/voice-check.js
```

These are the product IP. Import them; never copy-paste their content into handlers.

## Deployment

```bash
npm run build          # next build
```

`netlify.toml` drives the build. Node 22. The `@netlify/plugin-nextjs` plugin handles SSR.

Secrets come from **Doppler** — do not add `.env` files or hardcode values. If a secret is missing locally, fetch it via `doppler run -- npm run dev`.

## AI cost logging rule (DO NOT REMOVE — owner order required to change)

Every AI step — job extraction, master-CV build/merge, master-CV verify, CV+job analysis, CV generation, cover-letter generation, voice-profile extraction, voice fix — **must** report all of the following in **both** places. The DB half is now automatic (the meter in `callGemini` does it for every call, including ones whose result is thrown away); the console half is still the caller's job:

| Field | DB column (`transactions`) | Console (`[Gemini] …` line) |
|---|---|---|
| Model name | `model` | `model:` |
| Input tokens | `cache_miss_tokens` | `in:` |
| Output tokens | `completion_tokens - thinking_tokens` | `out:` |
| Thinking tokens | `thinking_tokens` | `think:` |
| Cost (USD) | `amount_usd` (calculated from `PRICING` in `utils/pricing.js`) | `cost:` |

Implementation pattern:
- Use `gemini_usage` returned by every `utils/openai.js` function — it already contains `{ model, inputTokens, outputTokens, thinkingTokens, costUsd }`.
- **Do NOT call `logAiTransaction()` from a route, worker or script.** The meter already wrote the row; a second call double-counts. Give the call a `label` in its `callGemini` options and wrap the entry point in an AI context — that is the whole contract.
- Console log is emitted by `logGemini(gemini_usage)` in `utils/uploadAndAnalyze.js` (server-side) or `DocumentGenerator.js` / `TabbedViewer.js` (browser-side).
- Adding a new AI call without both DB and console logging is a defect. No exceptions.

## Security rules

Every API route that touches state or PII is wrapped in `requireAuth` (`lib/requireAuth.js`), which verifies the `auth-token` cookie and populates `req.user`. Never bypass this:

1. `user_id` for any state change or PII read comes from `req.user.user_id` — never from the request body.
2. No unauthenticated routes touch tokens, DB writes, or AI calls.
3. One Redis client: `@upstash/redis` only.
4. Token mutations go through Supabase RPCs (`add_tokens`, `decrement_token`, `decrement_generations`) — never read-modify-write.
5. The Stripe webhook dedupes on `event.id` via Redis `NX`; `runGeneration()` holds a per-user `gen_lock` (Redis `NX`, 600s, released in `finally`) to block double-submissions.
6. All DB access goes through `utils/database.js`. Writes use the service-role client (`getAdminSupabase()`); the anon client is for reads only. No `createClient` calls in route files.
7. **Magic-link email:** `pages/api/auth/send-magic-link.js` sends through **nodemailer over Gmail SMTP**, with the sender address `pod.one@gmail.com` hardcoded and the password in `GMAIL_APP_PASSWORD`. Resend (`RESEND_API_KEY` / `RESEND_FROM_EMAIL`) is configured but this route does not use it. Known open items, left as-is until Nik decides: the hardcoded personal sender, and the 500 response leaking `detail: mailErr.message` to the client. Users delete their own account and all data via `DELETE /api/delete-account` → `deleteUserData()`.

## Key environment variables

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEYS` | Comma-separated Gemini keys, rotated by KeyManager |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (read-only public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin (server-only) |
| `UPSTASH_REDIS_REST_URL` | Upstash endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash auth |
| `STRIPE_SECRET_KEY` | Stripe server key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook validation |
| `RESEND_API_KEY` | Email sending |
| `RESEND_FROM_EMAIL` | Verified sender address, e.g. noreply@mysuper.cv |
| `NEXT_PUBLIC_SITE_URL` | `https://mysuper.cv` |
| `JWT_SECRET` | Signs session cookies — required at startup, no fallback |
| `SENTRY_DSN` | Error monitoring (server + edge) |
| `NEXT_PUBLIC_SENTRY_DSN` | Error monitoring (browser) |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | Sentry source-map upload at build time |

## Testing law (binding — applies to ALL tests, now and forever)

Tests exist to prove the code is **actually correct**, not to produce a green checkmark.
A test that cannot fail is worse than no test, because it lies. The following rules are
non-negotiable for every test ever added to this repo:

1. **Test real behaviour.** A test MUST call the actual function/route/module under test
   and assert on its real output or real side effects. Never re-implement the logic inside
   the test and assert against your own copy.
2. **Only mock the outside world.** You may stub *external boundaries* only — network calls,
   Supabase, Stripe, Gemini, email, the clock (`Date`), and randomness (`crypto`/`uuid`).
   You may NEVER mock, stub, or replace the unit under test or the internal logic you are
   trying to verify. If a test asserts on the return value of a mock, it proves nothing.
3. **Every test must be capable of failing.** Assert on specific expected values and
   behaviours. Banned: tests whose only assertion is "did not throw", `expect(true)`,
   `expect(mock).toHaveBeenCalled()` as the *sole* assertion, or snapshots of nothing.
4. **Every bug fix ships with a regression test that fails on the old code.** Before
   changing the code, the new test must demonstrably FAIL against the current (broken)
   behaviour, then PASS after the fix. State this in the PR/commit ("red on old, green on new").
5. **Security and money paths require negative tests.** For anything touching auth, tokens,
   or payments, you must test the *attack*: forged/missing session is rejected, a user
   cannot act on another `user_id`, a replayed Stripe event does not double-credit, etc.
6. **Coverage is not the goal; meaningful assertions are.** Do not pad with trivial tests
   to raise a number. One test that pins real behaviour beats ten that pin nothing.

If a change cannot be verified by a real test, say so explicitly and explain how it was
verified instead — do not write a hollow test to fill the gap.
