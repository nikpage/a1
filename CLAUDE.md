# CLAUDE.md — a1 / mysuper.cv

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
| Email | Resend |
| AI | **Gemini** (model constants in `utils/openai.js`; currently `gemini-2.5-flash-lite`) |
| Styling | Tailwind CSS |
| i18n | react-i18next, namespace JSON in `locales/{en,cs,pl}/` registered in `i18n.js` |
| Deployment | **Netlify** (`@netlify/plugin-nextjs`) |
| Monitoring | **Sentry** (`@sentry/nextjs` for routes/edge, `@sentry/node` in the background fn) |
| Logging | Leveled logger in `lib/logger.js` (info/debug silenced in production) |
| Secrets | **Doppler** (injects env vars at build/runtime; do not commit secrets) |

## AI layer

- `utils/openai.js` (misleading name — calls **Gemini**, not OpenAI) via the Gemini OpenAI-compatible endpoint. Model is chosen per task by the constants at the top of the file, allocated by task nature: **lite** for extract/classify/check-against-a-schema-or-source (verifiable; lite ≈ flagship at a fraction of the cost) — `GEMINI_EXTRACTION_MODEL` (job-ad parsing), `GEMINI_MASTER_MODEL` (master build/merge, once per user, backstopped by verify), `GEMINI_VERIFY_MODEL` (the master verify checker); **flash** for strategy + prose that can't be fully verified — `GEMINI_ANALYSIS_MODEL` (the strategic brain) and `GEMINI_GENERATION_MODEL` (CV/cover prose). Putting the per-use heavy calls on flash also keeps them off the overloaded flash-lite pool. Raise a lite constant (e.g. master → `gemini-2.5-pro`) for more quality; never hardcode a model string elsewhere. Key rotation via `utils/key-manager.js` over `GEMINI_API_KEYS`.
- The OpenAI-compatible endpoint cannot set `safetySettings`. Mild profanity (e.g. the "cocky" tone's "shit-hot") comes through fine; if Gemini ever sanitizes output, the only lever is switching that call to the native `generateContent` endpoint with `BLOCK_NONE`.
- Pricing is in `PRICING` in `utils/openai.js` — the single source of truth. Verify rates at ai.google.dev/gemini-api/docs/pricing. Per-call cost is logged to the browser console as `[Gemini] …` and written to the `transactions` table via `logAiTransaction()` in `utils/database.js`.
- Every successful AI call fires `trackDailySpend()` (fire-and-forget) in `utils/openai.js`, which accumulates the day's USD spend in Redis and emits a `logger.error` alert once `GEMINI_DAILY_BUDGET_USD` (default $10) is reached.
- The prompt builders in `prompts/` are provider-agnostic; tone definitions live in `prompts/tone.js` (shared by cv-generator and cover-letter).

## Master CV (per-user source-of-truth)

Each user has one persisted **master CV** — a structured career record (facts + verbatim `voice_samples` + transferable-value notes) in `cv_data.master_cv` (JSONB). It is the durable thing analysis reasons from, built once and reused across every later job match. See `prompts/master-cv.js` (build + merge modes) and `buildOrMergeMaster()` in `utils/openai.js`; read/write via `getMasterCv()` / `saveMasterCv()` in `utils/database.js`.

- **Build:** the background analysis worker builds the master from the raw CV text the first time it's absent, persists it, cost-logs it, then feeds the master (not the raw CV — that would process the same CV twice) into `analyzeCvJob`. Falls back to raw text only if the build fails.
- **Merge (multi-CV):** when a user who already has a master uploads another CV, `uploadAndAnalyze` shows `AddCvChoiceModal` (add-to-profile vs start-fresh). "Merge" → `/api/add-cv` previews the merge and stashes the proposed master in Redis under a nonce (nothing saved yet); if it surfaces conflicts, `MergeConflictModal` lets the user resolve them; `/api/add-cv-commit` saves (re-merging once only when the user overrides the newest-wins default). Identity always from `req.user`.
- **Verify pass (runs after every build/merge, i.e. each time the CV is updated):** `buildOrMergeMaster` automatically follows the build/merge with `verifyMaster()`. It is a safety net for cheap-model slips: (1) a **deterministic code check** drops any `voice_sample` that isn't a real substring of the source (catches paraphrased "verbatim" quotes, no AI); (2) **one targeted AI call** (`buildMasterVerifyPrompt`) flags only a wrong most-recent-role country, gaps that contradict the extracted data, and skills/metrics unsupported by the source — corrections are applied deterministically, so it cannot rewrite `candidate_core` / `transferable_notes` / achievement text (no churn). On merge it gets the existing master as "trusted prior facts" so legacy content isn't flagged. `buildOrMergeMaster` returns `usages: [build/merge, verify]`; **log every entry** (the cost-logging rule covers the verify call too).
- **Never-fabricate** is absolute here too: the master records only what the input evidences; gaps stay gaps. The build prompt's SELF-CONSISTENCY block + the verify pass are the two layers that keep gaps/country/conflicts honest on a cheap model.

## AI cost logging

Every AI call writes a row to `transactions` (`type = 'ai_cost'`) via `logAiTransaction()` in `utils/database.js`. It looks up per-token rates from the `model_pricing` table and inserts directly using the service-role client — no HTTP self-call.

- **Analysis**: logged in `netlify/functions/analyse-background.mjs` after `saveGeneratedDoc` succeeds.
- **Generation**: logged in `pages/api/generate-cv-cover.js` after each document is saved. The generation counter is decremented only after both AI calls succeed — a failed call leaves the user's balance untouched.

## Analysis flow (async — do not make it synchronous)

Gemini analysis runs longer than Netlify's 10s synchronous function limit (which **cannot** be raised on this plan), so analysis is a **background function**:

- Browser → `POST /.netlify/functions/analyse-background.mjs` (15-min budget). Call it with a **relative URL** — never via `NEXT_PUBLIC_SITE_URL` server-to-server (that hop is what made a prior attempt save nothing).
- The worker always writes either the analysis **or** an `{ "__analysis_error": "…" }` sentinel to `gen_data` under a client-minted `analysis_id` — never silent.
- Browser polls `POST /api/get-analysis-status` (`{ analysis_id }`; `user_id` comes from the verified session cookie, never the body) until `done` / `error`. It also returns `_gemini_usage` for the console cost log.
- All three entry points (landing page, CV uploader, Start-Fresh modal) go through `utils/uploadAndAnalyze.js` — keep them on that single helper.
- `/.netlify/functions/*` are **not** served by `next dev`; test locally with `doppler run -- netlify dev`.

## Sacred files — do not rewrite or inline

```
prompts/analysis.js
prompts/cv-generator.js
prompts/cover-letter.js
prompts/master-cv.js
```

These are the product IP. Import them; never copy-paste their content into handlers.

## Deployment

```bash
npm run build          # next build
```

`netlify.toml` drives the build. Node 22. The `@netlify/plugin-nextjs` plugin handles SSR.

Secrets come from **Doppler** — do not add `.env` files or hardcode values. If a secret is missing locally, fetch it via `doppler run -- npm run dev`.

## AI cost logging rule (DO NOT REMOVE — owner order required to change)

Every AI step — job extraction, master-CV build/merge, master-CV verify, CV+job analysis, CV generation, cover-letter generation — **must** report all of the following in **both** places:

| Field | DB column (`transactions`) | Console (`[Gemini] …` line) |
|---|---|---|
| Model name | `model` | `model:` |
| Input tokens | `cache_miss_tokens` | `in:` |
| Output tokens | `completion_tokens - thinking_tokens` | `out:` |
| Thinking tokens | `thinking_tokens` | `think:` |
| Cost (USD) | `amount_usd` (calculated from `model_pricing`) | `cost:` |

Implementation pattern:
- Use `gemini_usage` returned by every `utils/openai.js` function — it already contains `{ model, inputTokens, outputTokens, thinkingTokens, costUsd }`.
- Pass `model: gu.model` (never hardcode the model string), `cache_miss_tokens: gu.inputTokens`, `completion_tokens: gu.outputTokens + gu.thinkingTokens`, `thinking_tokens: gu.thinkingTokens` to `logAiTransaction()`.
- Console log is emitted by `logGemini(gemini_usage)` in `utils/uploadAndAnalyze.js` (server-side) or `DocumentGenerator.js` / `TabbedViewer.js` (browser-side).
- Adding a new AI call without both DB and console logging is a defect. No exceptions.

## Security rules

Every API route that touches state or PII is wrapped in `requireAuth` (`lib/requireAuth.js`), which verifies the `auth-token` cookie and populates `req.user`. Never bypass this:

1. `user_id` for any state change or PII read comes from `req.user.user_id` — never from the request body.
2. No unauthenticated routes touch tokens, DB writes, or AI calls.
3. One Redis client: `@upstash/redis` only.
4. Token mutations go through Supabase RPCs (`add_tokens`, `decrement_token`, `decrement_generations`) — never read-modify-write.
5. The Stripe webhook dedupes on `event.id` via Redis `NX`; `generate-cv-cover` holds a per-user `gen_lock` (Redis `NX`, 30s, released in `finally`) to block double-submissions.
6. All DB access goes through `utils/database.js`. Writes use the service-role client (`getAdminSupabase()`); the anon client is for reads only. No `createClient` calls in route files.
7. Magic-link email uses Resend (`RESEND_FROM_EMAIL`). Users delete their own account and all data via `DELETE /api/delete-account` → `deleteUserData()`.

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
| `GEMINI_DAILY_BUDGET_USD` | Daily Gemini spend alert threshold (default $10) |
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
