# CLAUDE.md — a1 / thecv.pro

## What this is

CV and cover-letter generator with token-based billing. Deployed at **thecv.pro**.

- User uploads CV (PDF/DOCX) → optionally pastes job description → app analyses CV ↔ job → user picks tone → generates tailored CV, cover letter, or both.
- Each generation costs 1 token. Tokens bought via Stripe (€6/€8/€23/€42 for 1/2/10/30).

Read `REBUILD.md` before touching any API route. It is the contract for the ongoing rewrite.

Read `DB.md` for the full Supabase schema — tables, columns, RPCs, known issues, and the SQL to wipe a test user.

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 Pages Router (JS, no App Router migration) |
| Database | Supabase (service-role key only; anon key never used for writes) |
| Sessions / rate-limit | Upstash Redis (`@upstash/redis` + `@upstash/ratelimit`) |
| Payments | Stripe |
| Email | Resend |
| AI | **Gemini** (`gemini-3.5-flash` via `utils/openai.js`) |
| Styling | Tailwind CSS |
| i18n | next-translate (en, cs) |
| Deployment | **Netlify** (`@netlify/plugin-nextjs`) |
| Secrets | **Doppler** (injects env vars at build/runtime; do not commit secrets) |

## AI layer

- `utils/openai.js` (misleading name — calls **Gemini**, not OpenAI) via the Gemini OpenAI-compatible endpoint. Both analysis and generation use `gemini-3.5-flash`. Key rotation via `utils/key-manager.js` over `GEMINI_API_KEYS` (comma-separated).
- The OpenAI-compatible endpoint cannot set `safetySettings`. Mild profanity (e.g. the "cocky" tone's "shit-hot") comes through fine; if Gemini ever sanitizes output, the only lever is switching that call to the native `generateContent` endpoint with `BLOCK_NONE`.
- Pricing per `PRICING` in `utils/openai.js` — verify rates at ai.google.dev/gemini-api/docs/pricing. Per-call cost is logged to the browser console as `[Gemini] …`.
- The three prompt builders in `prompts/` are provider-agnostic; tone definitions live in `prompts/tone.js` (shared by cv-generator and cover-letter).

## Analysis flow (async — do not make it synchronous)

Gemini analysis runs longer than Netlify's 10s synchronous function limit (which **cannot** be raised on this plan), so analysis is a **background function**:

- Browser → `POST /.netlify/functions/analyse-background.mjs` (15-min budget). Call it with a **relative URL** — never via `NEXT_PUBLIC_SITE_URL` server-to-server (that hop is what made a prior attempt save nothing).
- The worker always writes either the analysis **or** an `{ "__analysis_error": "…" }` sentinel to `gen_data` under a client-minted `analysis_id` — never silent.
- Browser polls `POST /api/get-analysis-status` (`{ user_id, analysis_id }`) until `done` / `error`. It also returns `_gemini_usage` for the console cost log.
- All three entry points (landing page, CV uploader, Start-Fresh modal) go through `utils/uploadAndAnalyze.js` — keep them on that single helper.
- `/.netlify/functions/*` are **not** served by `next dev`; test locally with `doppler run -- netlify dev`.

## Sacred files — do not rewrite or inline

```
prompts/analysis.js
prompts/cv-generator.js
prompts/cover-letter.js
```

These are the product IP. Import them; never copy-paste their content into handlers.

## Deployment

```bash
npm run build          # next build
```

`netlify.toml` drives the build. Node 22. The `@netlify/plugin-nextjs` plugin handles SSR.

Secrets come from **Doppler** — do not add `.env` files or hardcode values. If a secret is missing locally, fetch it via `doppler run -- npm run dev`.

## Security — active P0 issues (do not make worse)

The current `pages/api/` tree has critical vulnerabilities (documented in `REBUILD.md`). The rewrite is in progress. Until it is complete:

1. Never add a new API route that trusts `user_id` from the request body — it must come from `req.user.user_id` via `withAuth`.
2. Never add unauthenticated routes that touch tokens, DB writes, or AI calls.
3. Never add a second Redis client — use `@upstash/redis` only.
4. Never do read-modify-write on `tokens` — use the `add_tokens` / `decrement_tokens` Supabase RPCs.

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
| `RESEND_API_KEY` | Email |
| `NEXT_PUBLIC_SITE_URL` | `https://thecv.pro` |

## No tests

There is no test suite. Verify changes manually end-to-end (upload → analyse → generate → buy → generate again).
