# Rebuild handoff — thecv.pro / a1

Read this end-to-end before touching anything. This is the contract for the rewrite. **Push back on anything wrong before writing code, not after.**

## Status

- This repo (`a1`, deployed at thecv.pro as "a1-mk2") is the live project.
- Sibling dirs `cv-pro`, `dev`, `z4`, `cvpro` are abandoned restart attempts of the same product. Ignore them.
- No paying users. No data migration concerns. The DB schema in Supabase exists but has not been validated by real demand.
- The user has explicitly said this rewrite is meant to be the **last** start, not another fresh start.

## What this product does

CV/cover-letter generator with token-based billing.

1. User uploads a CV (PDF or DOCX).
2. Optionally pastes a job description.
3. App analyzes CV ↔ job using DeepSeek, returns structured analysis.
4. User picks a tone (Formal / Neutral / Casual / Cocky) and generates a tailored CV, cover letter, or both.
5. Each generation costs 1 token. Tokens are bought via Stripe (€6 / €8 / €23 / €42 for 1 / 2 / 10 / 30).

That's the whole product. Don't add features.

## What to keep

- **`prompts/*.js`** — `analysis.js`, `cv-generator.js`, `cover-letter.js`. These are the actual product IP. Do not rewrite them. Do not inline them into handlers.
- **DeepSeek as the model** — no migration to OpenAI. Pricing model is built around DeepSeek's cache-hit/cache-miss tokens.
- **Supabase as the DB** — keep the project, drop unused tables, tighten RLS (see below).
- **Stripe + Resend** — current setup is fine, the bugs are in *how* they're called, not the choice.
- **Magic-link auth** — pattern is right (token in DB, click link, get session cookie). Implementation needs to be redone safely.
- **Tailwind + Pages Router** — don't migrate to App Router as part of this rewrite. That's a separate decision; doing both at once is how rewrites die.

## What to throw out

| File / area | Why |
|---|---|
| All of `pages/api/*.js` | None use `requireAuth`. `user_id` is trusted from request bodies. P0 vulns throughout. |
| `lib/originCheck.js` AND `utils/originCheck.js` | Two different impls. The lib one allows any `*.vercel.app`. |
| `lib/rateLimiter.js`, `lib/emailRateLimiter.js` | TOCTOU race; hand-rolled when `@upstash/ratelimit` is already installed. |
| `lib/redis.js` (ioredis) | Wrong client for serverless. Use `@upstash/redis` (REST) only. |
| `pages/api/stripe/add-tokens.js` | **Public unauthenticated token-granting endpoint.** Delete on day one. |
| `pages/api/process-prompt.js` | Public unauthenticated DeepSeek burner. |
| `pages/api/generate-cover.js` | ReferenceError on every call (uses `jobTextFinal` before declaration). Dead code. |
| `pages/api/generate.js` | Trusts `paid` flag from body. |
| `pages/api/test-login.js` | Test page in production. |
| `pages/api/stripe/create-session.js` | Duplicate of `create-checkout.js` with worse code. |
| `pages/api/decrement-token.js` | Anyone can decrement anyone's tokens. |
| `next-translate` + `i18next` + `react-i18next` + `i18next-browser-languagedetector` | Pick one. Recommend `next-translate` only. |
| `marked` + `react-markdown` | Pick one. Recommend `react-markdown` (already used in components). |
| `textract`, `pdf.js-extract`, `pdf-lib` | Unused. `pdf-parse` + `mammoth` are enough. |
| `magic-sdk` | Unused (you rolled your own magic link). |
| `dotenv` | Next.js handles `.env.local` natively. |
| `User-Agent:` (literal filename, 0 bytes) | Shell-redirect artifact. Delete. |

## Architecture contracts

### Stack

- Next.js 14.x Pages Router (upgrade from 13.4.5; CVE-driven)
- Supabase v2 (upgrade from v1; v1 is EOL, `onConflict: ['user_id']` array syntax breaks)
- `@upstash/redis` + `@upstash/ratelimit` (drop ioredis, drop raw `fetch` to Upstash REST)
- Stripe SDK (current)
- Resend (current)
- `pdf-parse` + `mammoth` for parsing
- `react-markdown` for rendering
- `next-translate` for i18n

### Data model

Six tables. Anything outside this list needs justification.

```sql
-- users: identity + balance
users (
  user_id      uuid primary key default gen_random_uuid(),
  email        text unique,           -- nullable until first magic-link login
  tokens       int  not null default 0,
  created_at   timestamptz not null default now()
)

-- cv_data: one current CV per user (upsert on user_id)
cv_data (
  user_id      uuid primary key references users(user_id) on delete cascade,
  cv_text      text not null,
  updated_at   timestamptz not null default now()
)

-- gen_data: every analysis/cv/cover the user has generated
gen_data (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(user_id) on delete cascade,
  type            text not null check (type in ('analysis','cv','cover')),
  tone            text,                       -- null for analysis
  content         text not null,
  company         text,
  job_title       text,
  hr_contact      text,
  source_gen_id   uuid references gen_data(id),  -- analysis a cv/cover was based on
  created_at      timestamptz not null default now()
)

-- magic_tokens: short-lived auth tokens (15 min)
magic_tokens (
  token        text primary key,         -- 32 random bytes hex
  email        text not null,
  user_id      uuid not null references users(user_id) on delete cascade,
  expires_at   timestamptz not null,
  used         boolean not null default false
)

-- transactions: audit log of all money + AI cost events
transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references users(user_id) on delete set null,
  type            text not null check (type in ('purchase','ai_cost')),
  amount_usd      numeric(10,4) not null,   -- negative for cost, positive for purchase
  source_gen_id   uuid references gen_data(id),
  stripe_event_id text unique,              -- only set for purchases
  model           text,                     -- only set for ai_cost
  detail          jsonb,
  created_at      timestamptz not null default now()
)

-- processed_stripe_events: webhook idempotency
processed_stripe_events (
  event_id     text primary key,
  processed_at timestamptz not null default now()
)
```

Atomic SQL functions (define in Supabase, call from server only):

```sql
-- add_tokens(p_user_id, p_amount) -> int (new balance)
-- decrement_tokens(p_user_id, p_amount default 1) -> int (new balance) or raises if insufficient
```

RLS: deny all from anon role. All access goes through server using the service role key. Anon key is never used for writes.

### API surface — exactly these routes

Auth column legend: `none` = public, `cookie` = requires session cookie via `withAuth`, `signed` = Stripe webhook signature.

| Method + path | Auth | Body / query | Returns |
|---|---|---|---|
| `POST /api/auth/request-link` | none | `{email}` | `{ok:true}` (rate-limited per email + per IP) |
| `GET  /api/auth/verify`       | none | `?token=` | sets cookie, redirects to `/dashboard` |
| `POST /api/auth/logout`       | cookie | — | clears cookie |
| `POST /api/cv/upload`         | cookie | multipart `file` (≤200KB, pdf/docx) | `{ok:true}` |
| `GET  /api/cv`                | cookie | — | `{cv_text, updated_at}` |
| `POST /api/analyze`           | cookie | `{job_text?}` | `{analysis_id, content}` |
| `POST /api/generate`          | cookie | `{analysis_id, tone, kind: 'cv'\|'cover'\|'both'}` | `{cv?, cover?, tokens_remaining}` (atomic decrement; 402 if 0) |
| `POST /api/billing/checkout`  | cookie | `{quantity: 1\|2\|10\|30}` | `{url}` (Stripe checkout URL) |
| `POST /api/billing/webhook`   | signed | Stripe event | `{ok:true}` |
| `GET  /api/account`           | cookie | — | `{email, tokens, recent_generations}` |

That's 10 endpoints. The current code has ~20. If you find yourself adding an 11th, stop and justify it.

**Hard rules:**
1. **`user_id` is never accepted from a request body or query.** It comes from `req.user.user_id`, which `withAuth` populates from the session cookie. This is the single biggest fix from the old code.
2. **Every cookie-auth route is wrapped in `withAuth`.** No exceptions. Forgetting `withAuth` is the failure mode that produced the P0s last time.
3. **Every state-changing op that touches `tokens` uses an atomic SQL RPC.** No read-modify-write JS.
4. **Origin check** — single helper in `lib/security.js`, applied via `withAuth`. Allowlist: `https://www.thecv.pro`, `https://thecv.pro`, plus `localhost:3000` in dev. No `*.vercel.app` wildcard.

### Auth model

- Magic-link only, no passwords.
- `request-link` rate limit: 5 per minute per email, 10 per minute per IP (via `@upstash/ratelimit` sliding window).
- Token is 32 random bytes hex, stored in `magic_tokens`, expires in 15 minutes.
- On `verify`: validate (unused, unexpired), mark used, mint a session token (32 random bytes hex), store `session:<token>` → `{user_id, email}` in Upstash with 30-day TTL, set HTTP-only `auth-token` cookie (Secure + SameSite=Lax in prod).
- `withAuth` middleware:
  1. Read `auth-token` cookie.
  2. Look up `session:<token>` in Upstash.
  3. If missing/expired → 401.
  4. Apply origin check.
  5. Set `req.user = {user_id, email}`.
  6. Call handler.
- Logout deletes the Redis key and clears the cookie.

### Money flow

1. Browser → `POST /api/billing/checkout {quantity}` → server creates Stripe Checkout Session with `metadata: {user_id: req.user.user_id, quantity}` → returns hosted URL.
2. User pays at Stripe.
3. Stripe → `POST /api/billing/webhook` (signed):
   - Verify signature with `stripe.webhooks.constructEvent`.
   - **Idempotency:** `INSERT INTO processed_stripe_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING event_id`. If no row returned, the event was already processed → return 200 immediately.
   - Only handle `checkout.session.completed`.
   - Call `add_tokens(metadata.user_id, metadata.quantity)` (atomic SQL RPC).
   - Insert `transactions` row with `stripe_event_id = event.id`, `type='purchase'`, `amount_usd = paid amount`.
   - Return 200.
4. Generation flow uses `decrement_tokens` RPC, which raises if balance < 1; handler catches and returns 402.

### File layout

```
src/
  lib/
    auth.ts          (withAuth, sessions, magic tokens — single file)
    security.ts      (origin check, rate limiters — single file)
    redis.ts         (one Upstash client, no ioredis)
    db.ts            (Supabase service-role client + typed RPCs)
    deepseek.ts      (axios call, key rotation, usage extraction)
    stripe.ts        (one Stripe client + price map)
  prompts/           (verbatim from old repo: analysis.js, cv-generator.js, cover-letter.js)
  pages/
    api/
      auth/{request-link,verify,logout}.ts
      cv/{upload,index}.ts
      analyze.ts
      generate.ts
      billing/{checkout,webhook}.ts
      account.ts
    {index,login,dashboard,pricing,payment-success}.tsx
  components/        (port the React components, retarget endpoints)
```

TypeScript optional but recommended — types catch the `user_id`-from-body class of bug at the boundary.

## Anti-patterns from the old code — never recreate

1. **`user_id` from request body.** Always `req.user.user_id`.
2. **Multiple Redis clients.** One client. One pattern.
3. **In-memory rate limiting** (`new Map()` in handler scope). Always Upstash.
4. **Read-modify-write on `tokens`.** Always atomic RPC.
5. **Inline copy-pasted prompts.** Import from `prompts/`.
6. **Two endpoints that do the same thing.** If you're tempted, refactor instead.
7. **Anon key for writes.** Service role only, server-side only.
8. **`console.log` of env vars.** Never.
9. **Self-fetching internal API calls.** Call the function directly.
10. **CORS `*` + `Allow-Credentials: true`** (invalid combo per CORS spec). Don't set CORS at all on same-origin Next.js routes.

## Build order

Do these in order. Don't start step N+1 until step N is deployed and smoke-tested.

1. **New project skeleton.** Recommend `/home/nik/repos/cvpro` as a fresh dir (the existing `cvpro` clone of a1.git is abandoned and can be wiped or moved aside). Or create a new branch in `a1` and prune. Either way — the old `pages/api/` tree must not survive.
2. **DB migration.** Apply the schema above. Define `add_tokens` and `decrement_tokens` RPCs. Tighten RLS to deny-all from anon.
3. **Auth.** `withAuth`, request-link, verify, logout. Test the magic-link flow end-to-end.
4. **CV upload + retrieval.** Port `pdf-parse` and `mammoth` parsing into a single helper. Test with a real PDF and a real DOCX.
5. **Analyze + generate.** Port the three `prompts/*.js` files unchanged. Wire to DeepSeek via `lib/deepseek.ts`. Atomic token decrement.
6. **Billing.** Checkout + webhook with idempotency. Test with Stripe test mode and at least one duplicate-delivery scenario.
7. **Frontend.** Port React components from `a1/components/` and `a1/pages/`, point them at the new endpoints. Accept that some will need rewrites where they relied on the old `user_id`-in-body pattern.
8. **Cutover.** Deploy as a Vercel preview, run the full flow (signup → upload → analyze → generate → buy tokens → generate again). When green, swap the production deployment.

## Definition of done

The rewrite is done when **all of these are true**:

- [ ] Every cookie-auth route is wrapped in `withAuth` and uses `req.user.user_id` exclusively.
- [ ] No API route accepts `user_id` from a request body or query.
- [ ] Stripe webhook deduplicates on `event.id` via `processed_stripe_events`.
- [ ] All token mutations go through `add_tokens` / `decrement_tokens` RPCs.
- [ ] Exactly one Redis client (`@upstash/redis`), one rate limiter pattern (`@upstash/ratelimit`), one origin check.
- [ ] Prompts are imported from `prompts/`, never inlined.
- [ ] RLS on Supabase denies all from anon role.
- [ ] Smoke test passes end-to-end on a Vercel preview.
- [ ] The old `a1/pages/api/` tree is deleted or archived, not left adjacent to live code.

If any box is unchecked, the work isn't finished — patch it before merging, don't defer.

## Things the next agent should ask the user before starting

1. New repo / new dir, or rewrite in this one? (Strong recommendation: new dir, `cvpro/`.)
2. TypeScript or stay JavaScript? (Recommend TypeScript — it would have caught half the old bugs.)
3. Keep the existing Supabase project (drop unused tables) or start a new one? (Recommend keep — schema extras are cheap.)
4. Are the old DeepSeek API keys still valid, and how many are configured? (`KeyManager` rotates across `DEEPSEEK_API_KEY*`.)
5. Stripe products — keep the same price IDs or recreate? (No reason to recreate; just reference them by amount.)

Don't start coding until those five are answered.
