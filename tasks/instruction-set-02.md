# Instruction set #2 — Auth backbone & lock the doors (REBUILD.md 0.4, 1.1, 1.2, 1.3, 1.5)

**You are the implementing CLI (Sonnet).** Work on branch `claude/confident-volta-kuvgys`.
Do exactly this set. Read the **Testing law** in `CLAUDE.md` first — it is binding.

**Auth model decision (already made — implement exactly this):**
The free trial stays login-free, but it is *not* anonymous-and-trusting. On CV upload the
**server mints a signed session cookie** bound to that visitor's own freshly-created
`user_id`. From then on, every protected route derives `user_id` **only** from the verified
cookie (`req.user.user_id`) and **ignores any `user_id` in the body or query**. Logging in
via magic link later just re-mints the same kind of cookie. Net effect: a visitor can only
ever act as their own account; the "pass someone else's user_id" hole is closed without
adding login friction.

**Out of scope for this set (reserved for set #3 — do NOT touch):** Stripe webhook & checkout,
`utils/originCheck.js` / `lib/originCheck.js`, the Netlify background function
`netlify/functions/analyse-background.mjs`, email. Leave them as-is. Do not touch the sacred
prompt files in `prompts/`.

---

## Task 0.4 — Shared test helpers
Create `test/helpers.js` (or `__tests__/helpers.js`) exporting reusable helpers so route
tests don't repeat boilerplate:
- `mockReqRes({ method, cookies, body, query })` → returns `node-mocks-http` req/res.
- `makeSupabaseMock(tables)` → a chainable fake Supabase client whose `.from(table)` returns
  canned data per table, and records inserts/updates for assertions. Must support the chains
  this codebase actually uses (`.select().eq().single()`, `.select().eq().maybeSingle()`,
  `.insert()`, `.update().eq()`, `.rpc()`).
- `authCookieFor(user_id)` → returns a valid signed `auth-token` cookie value (uses the real
  `mintSessionToken`, with `JWT_SECRET` set in the test).
These helpers wrap the **real** boundaries only; never stub the code under test.

## Task 1.1 — Kill the JWT fallback secret (`lib/auth.js`)
- Remove the hardcoded `'fallback-dev-secret-change-in-prod'` fallback.
- If neither `JWT_SECRET` nor `API_SHARED_SECRET` is set, `mintSessionToken` and `verifyToken`
  must **throw** a clear error (validate lazily, at call time — do NOT throw at module import,
  or you will crash `next build`).
- Tests: with no secret set, `mintSessionToken(...)` throws; with a secret set, the existing
  roundtrip still works. (Use `vi.resetModules()` / re-import to test the unset case cleanly.)

## Task 1.2 — Session cookie helper + mint on upload + auth everywhere
1. **Create `lib/session.js`** exporting `setSessionCookie(res, { user_id, email })` that sets
   the `auth-token` HttpOnly cookie exactly as `pages/api/auth/verify.js` does today
   (Max-Age 30d; `SameSite=None; Secure` in prod, `SameSite=Lax` in dev). Refactor
   `verify.js` to use this helper (DRY — no behaviour change there).
2. **`pages/api/upload-cv.js`**: after the user row is resolved/created and you have the
   final `user_id`, call `setSessionCookie(res, { user_id })` before returning. Upload stays
   a public route (it's the first action), but it now hands back a trusted session.
   *(Also apply Task 1.5 below while editing this file.)*
3. **Put these routes behind `requireAuth` and source `user_id` from `req.user.user_id` only**
   (delete any `const { user_id } = req.body/req.query`):
   `generate-cv-cover.js`, `decrement-token.js`, `tokens.js`, `get-docs.js`, `get-cvs.js`,
   `get-analysis.js`, `get-analysis-status.js`, `header-stats.js`.
   - For GET routes currently reading `req.query.user_id`, switch to `req.user.user_id`.
   - Keep all other body fields (e.g. `analysis`, `tone`, `type`, `analysis_id`) as-is.

**Required tests (this is the security core — negative tests are mandatory):**
- `requireAuth`: a wrapped dummy handler returns **401** when no cookie is present, and is
  invoked with `req.user.user_id` set when a valid cookie is present.
- **Cross-user attack (the important one):** pick one representative protected route
  (e.g. `tokens.js`). Mock the DB so user `A` and user `B` have different balances. Call the
  route with `authCookieFor('A')` but `user_id=B` injected in the query/body. Assert the
  response contains **A's** data, proving the injected `user_id` was ignored. This test MUST
  fail if someone reverts the route to reading `user_id` from the request.
- `setSessionCookie`: sets an HttpOnly `auth-token` cookie whose value `verifyToken` accepts
  and decodes back to the given `user_id`.
- `upload-cv` (focused): mock formidable/extraction/DB; on a successful upload assert a
  `Set-Cookie: auth-token=...` header is present and decodes to the returned `user_id`.

## Task 1.3 — Delete verified-dead routes
Delete these files (confirmed unreferenced anywhere in the repo):
`pages/api/log-transaction.js`, `pages/api/generate.js`, `pages/api/generate-cover.js`,
`pages/api/process-prompt.js`, `pages/api/send-link.js`, `pages/api/download-doc.js`,
`pages/api/analyze-cv-job.js`, `pages/api/stripe/add-tokens.js`.
- `analyze-cv-job` is referenced only by `middleware.js`'s matcher — since the route is gone,
  update the matcher to no longer point at it (point it at nothing / a non-existent path is
  fine for now; the middleware rewrite is set #3). Do not expand the middleware's scope.
- After deletion, `npm run build` must still pass.

## Task 1.5 — Fix `upload-cv.js` while you're in it
- Use the **service-role** Supabase client for writes, not the anon key.
- Fix the misspelled table write: `data_gen` → the correct table (`gen_data`), or remove that
  stray write if it duplicates `upsertCV` — use your judgement and explain in the report.
- Remove the `console.log('ENV VARS CHECK', …)` block and any other secret/PII logging in
  this file.

---

## Known interactions to respect (don't break these)
- After this change the **analysis poll** (`get-analysis-status`) is authed; that's fine
  because the visitor now holds the upload-minted cookie.
- The Netlify **background analysis function is still open** (takes `user_id` from body) —
  that's knowingly deferred to set #3. Note it in your report; don't fix it here.
- Same-origin `fetch` from the frontend already sends cookies automatically, so no frontend
  changes should be needed for logged-in/trial users. If you find a `fetch` that needs
  `credentials`, flag it — don't broadly edit components.

## Report back
1. `npm test`, `npm run lint`, `npm run build` results.
2. Confirmation you ran the self-check on the **cross-user attack** test (revert the route to
   read `user_id` from the request, see the test go red, restore).
3. The list of routes you locked and how each now gets `user_id`.
4. Decision you made on the `data_gen` stray write, and anything noticed-but-not-changed.
5. Files changed + commit hash.
</content>
