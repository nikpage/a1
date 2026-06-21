# REBUILD.md — master work plan & API contract

This is the tracked contract for bringing a1 / thecv.pro to **professional SaaS quality**:
secure, resilient, observable, and safe to build on. Work is executed in **milestones**.
Each task is small, independently verifiable, and **ships with real tests** (see the
"Testing law" in `CLAUDE.md` — tests must prove correctness, not just pass).

**Roles**
- **Architect (Opus):** owns this plan, writes each CLI instruction set, verifies results.
- **CLI (Sonnet):** implements one instruction set at a time, writes the specified tests,
  reports back.

**Definition of done for every task**
1. Code change made on branch `claude/confident-volta-kuvgys`.
2. Real tests added per the Testing law; for bug fixes the test is red on old code, green on new.
3. `npm run lint`, `npm run build`, and `npm test` all pass.
4. Checkbox ticked here with the commit hash.

**Global rules (from CLAUDE.md — do not violate)**
- `user_id` for any state change or PII read comes from `req.user.user_id` via auth, never the body.
- Token/generation mutations go through Supabase RPCs (`add_tokens`, `decrement_token`, …) — never read-modify-write.
- One Redis client (`@upstash/redis`). One Supabase service-role client for writes.
- Never touch the sacred prompt files except to import them: `prompts/analysis.js`, `prompts/cv-generator.js`, `prompts/cover-letter.js`.

---

## Milestone 0 — Test & CI foundation  *(blocks everything else)*

Without a real test harness we cannot verify any later change. Build it first and prove it
works on stable, already-correct code.

- [x] **0.1** Add test runner (Vitest) + `node-mocks-http` for API-route tests. Add scripts: `test`, `test:watch`, `test:coverage`. *(03f4a75)*
- [x] **0.2** Write real tests for stable pure logic to validate the harness: the AI-cost math in `logAiTransaction` and the JWT mint→verify roundtrip in `lib/auth.js`. *(03f4a75 — architect-verified via source mutation: both suites go red when the real code is broken, incl. the signature-bypass attack)*
- [x] **0.3** GitHub Actions CI: run `lint`, `build`, `test` on every push/PR. *(03f4a75)*
- [ ] **0.4** Add a shared test helpers module (mock Supabase client, mock Stripe, fake req/res) so later tests reuse it. *(folded into instruction set #2)*

## Milestone 1 — Security P0  *(must land before public launch)*

- [x] **1.1** `lib/auth.js`: remove the hardcoded JWT fallback secret; throw at startup if `JWT_SECRET` is missing. Test: missing secret throws; valid secret signs/verifies. *(c7ddf17 — throws lazily at call time so build is safe)*
- [x] **1.2** Put **every** state-changing / PII route behind `requireAuth` and derive `user_id` from `req.user` only. Routes: `generate-cv-cover`, `decrement-token`, `tokens`, `get-docs`, `get-cvs`, `get-analysis`, `get-analysis-status`, `upload-cv`, `header-stats`. Negative tests: missing/forged session → 401; user A cannot read/act on user B. *(c7ddf17 — architect-verified: cross-user attack test goes red when the route is reverted to trust the request)*
- [x] **1.3** Delete verified-dead routes. *(c7ddf17 — 8 routes removed; build still green)*
- [x] **1.4** Stripe webhook: credit via `add_tokens` RPC; idempotency via Redis `NX`; PII logs removed. Tests: credits once; replay zero; bad sig 400; credit failure del+500. *(3fedbe1 — architect-verified: removing idempotency guard or credit call both go red)*
- [x] **1.5** `upload-cv.js`: use the service-role client (not anon) for writes; fix the misspelled `data_gen` → `gen_data`; remove the env-var console dump. *(c7ddf17 — stray data_gen write removed as a dup of upsertCV)*
- [x] **1.6** Consolidated origin checking into one helper keyed on `NEXT_PUBLIC_SITE_URL`; `lib/originCheck.js` deleted. *(3fedbe1)*
- [x] **1.7** Single credit path confirmed: only `webhook.js` calls `addTokens`; `payment-success.js` is a pure redirect. *(3fedbe1 — grep-verified)*
- [x] **1.8** Background function locked to auth cookie; body `user_id` ignored; 401 if no valid token. *(3fedbe1)*

## Milestone 2 — Correctness & resilience

- [x] **2.1** `generate-cv-cover`: decrement only after both AI calls succeed; AI failure leaves `generations_left` untouched. *(e5fd0db — architect-verified: moving decrement back before the AI call goes red)*
- [x] **2.2** Double-submit guard: per-user Redis `NX` lock (30s), released in `finally`; second concurrent call → 429. *(e5fd0db)*
- [x] **2.3** Shared `callGemini` helper with 429 key-rotation; used by all three AI functions. *(e5fd0db — architect-verified: breaking the 429 retry goes red)*
- [x] **2.4** Middleware rewritten to rate-limit `upload-cv`, `generate-cv-cover`, `send-magic-link` (real Netlify client IP); dead 100KB check removed. *(e5fd0db — config-level test, runtime edge test documented as infeasible)*

## Milestone 3 — Observability

- [ ] **3.1** Introduce a leveled logger; replace the 34 `console.log`s; silence info/debug in production; never log secrets, tokens, full Stripe events, or full CV text.
- [ ] **3.2** Wire error monitoring (Sentry or equivalent) for API routes + the background function.
- [ ] **3.3** Add a Gemini spend guard/alert (daily budget threshold) so a cost-bomb is visible.

## Milestone 4 — Database & data hygiene

- [ ] **4.1** Fix `transactions.user_id` type mismatch (uuid vs text) — migration so casts are no longer needed. Update `DB.md`.
- [ ] **4.2** Make `model_pricing` (DB) the single source of pricing; remove the duplicated hardcoded tables in `openai.js` and `key-manager.js`.
- [ ] **4.3** GDPR: authenticated "delete my account & data" endpoint implementing the cascade currently documented as manual SQL in `DB.md`. Test: deletes across all tables.

## Milestone 5 — Maintainability & launch polish

- [ ] **5.1** Standardize on one email path (Resend + verified domain) for magic links; remove the hardcoded Gmail SMTP. Test: send path called with correct args (mock Resend).
- [ ] **5.2** Single Supabase access layer — route all DB access through `utils/database.js`; remove ad-hoc `createClient` calls scattered in routes.
- [ ] **5.3** Remove repo junk: the empty `User-Agent:` file, stray `project-tree.txt`; prune unused deps (`ioredis`, `pg`, `magic-sdk`, `textract`, `franc`, `openai`) after confirming each is unreferenced.
- [ ] **5.4** Privacy policy + documented data-retention (the `gen_data` 90-day expiry) surfaced in the product.

---

## Instruction-set log  *(architect fills in as we go)*

| # | Milestone tasks | Status | Commit |
|---|---|---|---|
| 1 | 0.1, 0.2, 0.3 | ✅ verified | 03f4a75 |
| 2 | 0.4, 1.1, 1.2, 1.3, 1.5 | ✅ verified | c7ddf17 |
| 3 | 1.4, 1.6, 1.7, 1.8 | ✅ verified | 3fedbe1 |
| 4 | 2.1, 2.2, 2.3, 2.4 | ✅ verified | e5fd0db |
</content>
