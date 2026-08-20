# Onboarding sweep — a1 / mysuper.cv

Run 2026-08-20. Plain-English state of the project at adoption of the contract.
Everything below was checked in the repo this session; anything I could not
verify is marked **unverified**.

## 1. Inventory — what runs

| Piece | What it is |
|---|---|
| Web app | Next.js 16 (Pages Router, JavaScript). 13 pages, 29 API routes. |
| Hosting | Netlify. Build `npm run build`, Node 22, `@netlify/plugin-nextjs`. |
| Long jobs | Two Netlify background functions: `analyse-background.mjs` (CV↔job analysis) and `generate-background.mjs` (CV / cover letter writing). Both run past the 10s limit ordinary routes have. |
| Database | Supabase (Postgres). All access through `utils/database.js`. Schema documented in `DB.md`, 10 applied migrations in `scripts/migrations/`. |
| Sessions / rate limits | Upstash Redis. Not reachable from the Next server runtime — known and worked around. |
| Payments | Stripe. Token packs €6 / €8 / €23 / €42 for 1 / 2 / 10 / 30 tokens; card-on-file setup for the free download. |
| AI | Google Gemini through its OpenAI-compatible endpoint, one door only (`utils/openai.js`). |
| Email | Magic links sent via Gmail SMTP (nodemailer) from a hardcoded personal address. |
| Errors | Sentry (browser, server, edge, background function). |
| Languages | English, Czech, Polish. |
| Tests | Vitest. **69 files, 840 tests, all passing** (run this session). CI runs lint + build + test on every push. |

## 2. Spend baseline

**Gemini, from our own ledger: $9.50 over the last 30 days (477 calls).** Highest
day $1.88 (13 Aug). This includes development experiments, which are billed to the
same ledger on purpose. Read it any time with `node scripts/ai-costs.mjs --days 30`.

Everything else is **unverified** — I can see which services are wired up but not
what plan they are on or what they bill:

| Service | Status |
|---|---|
| Gemini | $9.50 / 30 days, measured |
| Netlify | plan unknown — the 10s function limit means it is not Enterprise |
| Supabase | plan unknown |
| Upstash Redis | plan unknown |
| Sentry | plan unknown |
| Stripe | per-transaction fees only |
| Gmail SMTP | free, but see risk R2 |

One line from you on the four unknowns and this becomes a real monthly number.

## 3. State of the world

**Works, verified by tests and by the code:** upload → analysis → generation →
validation → download; the token/Stripe path with replay protection; the AI cost
meter (every call recorded, no exceptions); the master-CV build + verify; the
voice profile; three-language output.

**Half-built or unused:**

- **`config/limits.js` is only half-wired.** `FREE_GENERATIONS` and
  `FREE_DOWNLOADS` are read; **`FREE_ANALYSES` is read by nothing** — free
  analyses are effectively unlimited whatever that number says.
- **`pages/test-login.js` is a dead debug page that ships to production.** It
  uses Supabase Auth (not this app's auth) and redirects to `localhost:3000`.
- **Resend is configured and paid-for-nothing.** The `resend` package and its
  env vars exist; no code imports it. Magic links go out over Gmail SMTP.
- **Four npm packages are installed but imported nowhere:** `resend`,
  `next-translate`, `uncrypto`, `nanoid`, `iso-639-3`, `marked`, `uuid`.
- **Untracked scratch in the repo:** `scripts/_tmp-check.mjs`,
  `scripts/extract-master-cv.mjs`, `scripts/extract-voice-profile.mjs`,
  `deno.lock`. Two tracked ones are named `-tmp`: `cost-analysis-tmp.mjs`,
  `redis-check-tmp.mjs`.
- **`master-dump.txt`** contains a Doppler auth error, nothing else.

**No stubs, TODOs or fake pass-values were found in the application code.**

## 4. Risk register — ranked by business impact

| # | Risk | Cost to fix |
|---|---|---|
| R1 | **Any logged-in user can read your whole AI spend.** `/api/ai-costs` is app-wide by design but only requires *a* session, so a customer can call it and see total costs and volumes. | ~30 min — gate it to your own user id |
| R2 | **Magic links depend on one personal Gmail account.** Sender `pod.one@gmail.com` hardcoded, password in an env var; Gmail rate-limits and can lock the account. Every login breaks if it does. | ~1 h — switch to Resend, already paid for |
| R3 | **A failed login leaks the mail server's error text to the browser.** Known, left as-is. | ~10 min |
| R4 | **No spend cap on Gemini.** Deliberate owner decision; spend is seen, not stopped. Listed so it is on the record, not as a defect. | n/a |
| R5 | **`test-login.js` is publicly reachable.** No data path, but it is a live page nobody should find. | ~5 min — delete |
| R6 | **`FREE_ANALYSES` gives false confidence.** The funnel doc says analyses are limited; the code does not limit them. | ~1 h to wire, or delete the setting |
| R7 | **Seven unused dependencies.** Install size and audit noise, no runtime risk. | ~20 min |

## 5. Missing

**There is no `PRODUCT.md`.** The contract expects one — who it is for, the
problem, the one number that matters, non-goals, budget, current focus,
trade-off order. Until it exists I resolve ambiguity by asking you instead of
reading it. `DECISIONS.md` did not exist either; I have backfilled it this session.
