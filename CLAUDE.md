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
| AI | **DeepSeek** (`deepseek-chat` via `utils/openai.js`) — **migrating to Gemini** |
| Styling | Tailwind CSS |
| i18n | next-translate (en, cs) |
| Deployment | **Netlify** (`@netlify/plugin-nextjs`) |
| Secrets | **Doppler** (injects env vars at build/runtime; do not commit secrets) |

## AI layer — current and upcoming

- Current: `utils/openai.js` (misleading name — calls DeepSeek, not OpenAI). Key rotation via `utils/key-manager.js` across `DEEPSEEK_API_KEY_1…N`.
- **Switching to Gemini** — when the migration happens, replace `utils/openai.js` and update `key-manager.js` accordingly. The three prompt builders in `prompts/` stay unchanged; they are provider-agnostic.
- Pricing model was built around DeepSeek's cache-hit / cache-miss token split. Revisit cost logging after the Gemini switch.

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
| `DEEPSEEK_API_URL` | DeepSeek endpoint |
| `DEEPSEEK_API_KEY_1…N` | Rotated by KeyManager |
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
