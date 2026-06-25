# Instruction set #3 — Finish security P0: Stripe, origin, background function (REBUILD.md 1.4, 1.6, 1.7, 1.8)

**You are the implementing CLI (Sonnet).** Branch `claude/confident-volta-kuvgys`.
Read the **Testing law** in `CLAUDE.md` first — binding. This set completes Milestone 1
(security). After it, no route or function should trust a `user_id` from the request, and
money cannot be double-credited.

**Respect prior work:** routes are already behind `requireAuth` and derive `user_id` from
`req.user`. Do not undo that. Do not touch the sacred `prompts/` files. Reuse the test
helpers in `__tests__/helpers.js`.

---

## Task 1.4 — Harden the Stripe webhook (`pages/api/stripe/webhook.js`)
Two defects today: it does read-modify-write on `tokens` (race), and it has no idempotency
(Stripe retries → double credit). Also it logs the full event/session (PII).

1. **Add a token-credit RPC wrapper** in `utils/database.js`:
   `export async function addTokens(user_id, amount)` → calls `rpc('add_tokens', { p_user_id: user_id, p_amount: amount })`, throws on error. (Mirror the existing `decrementToken`.)
2. **Rewrite the `checkout.session.completed` branch** to:
   - Read `user_id` and `quantity` from `session.metadata` (as today).
   - **Idempotency via Upstash Redis** (use `@upstash/redis` — the only allowed Redis client):
     ```js
     const key = `stripe_evt:${event.id}`;
     const first = await redis.set(key, '1', { nx: true, ex: 60 * 60 * 24 * 7 });
     if (first !== 'OK') return res.json({ received: true, duplicate: true }); // already processed
     ```
   - Then credit with `await addTokens(user_id, quantity)` (no select-then-update).
   - If `addTokens` throws, `await redis.del(key)` (so a Stripe retry can re-process) and
     return 500.
3. **Remove the `console.log('📦 RAW EVENT', event)` and `console.log('🧾 WEBHOOK SESSION', session)`** lines (PII in logs). A terse `console.log` of just `event.id` + `user_id` is fine.

**Tests** (mock the boundaries: `stripe` SDK's `constructEvent`, `@upstash/redis`, and `addTokens`):
- Valid first-time event → `addTokens` called **once** with `(user_id, quantity)`; responds 200.
- Replayed event (`redis.set` returns `null`/not `'OK'`) → `addTokens` **not** called; 200.
- Bad signature (`constructEvent` throws) → 400, no credit.
- `addTokens` throws → `redis.del(key)` called and response is 500.
Self-check: break the "credits once" assertion and the "replay credits zero" assertion,
confirm each goes red, restore. (Money path — this is mandatory.)

## Task 1.6 — One origin checker (`utils/originCheck.js`)
- Make `utils/originCheck.js` the single source. `isValidOrigin(origin)` must allow the
  production site from `NEXT_PUBLIC_SITE_URL` (i.e. `https://mysuper.cv`) and `http://localhost:3000`
  in non-production. Drop the hardcoded `cv-pro.netlify.app`.
- `getBaseUrl()` stays (returns `NEXT_PUBLIC_SITE_URL` || localhost).
- Grep for `lib/originCheck.js` usages; if unused, **delete it**; if used, repoint callers to
  `utils/originCheck.js` and then delete it. There must be exactly one origin module.
- **Tests:** allowed origin (the configured site) → true; a foreign origin → false; localhost
  allowed only when not production. Set/restore `process.env.NEXT_PUBLIC_SITE_URL` and
  `NODE_ENV` in the test.

## Task 1.7 — Confirm a single credit path (no code change expected)
- Verify nothing client-reachable credits tokens: `pages/payment-success.js` only redirects
  (good); the deleted `stripe/add-tokens.js` is gone. Grep components/pages for any fetch to a
  token-crediting endpoint and confirm there are none besides the Stripe **checkout** session
  creators (which only *start* payment, they don't credit).
- **Test:** a guard test asserting the webhook is the only module that calls `addTokens`
  (e.g. grep-style unit: import the credit path and assert `payment-success` exports no
  network/credit call). If a meaningful runtime test isn't possible here, state that in the
  report and describe the grep you ran instead (allowed by the Testing law's honesty clause).

## Task 1.8 — Lock the Netlify background function (`netlify/functions/analyse-background.mjs`)
Today it trusts `user_id` from the POST body → anyone can run AI on / write analysis for any
user (cost + data-integrity vector). It's same-origin, so the browser already sends the
`auth-token` cookie.
1. Parse the cookie from `event.headers.cookie` (or `event.headers.Cookie`), extract
   `auth-token`, and verify it with `verifyToken` from `lib/auth.js`.
2. If there is no valid token → return `{ statusCode: 401 }` and do **not** call Gemini or
   write anything.
3. Derive `user_id` from the verified token; **ignore** any `user_id` in the body. Keep
   `jobText`, `created_at`, `file_name`, `analysis_id` from the body (analysis_id is a
   client nonce — fine).
4. In `utils/uploadAndAnalyze.js`, add `credentials: 'include'` to the
   `/.netlify/functions/analyse-background` fetch to make the cookie send explicit.
**Tests** (mock `analyzeCvJob`, `saveGeneratedDoc`, `logAiTransaction`, `supabase`):
- No cookie / invalid cookie → handler returns 401 and `analyzeCvJob` is **never** called and
  nothing is written.
- Valid cookie → uses the token's `user_id` even if a different `user_id` is in the body
  (assert the DB lookup / save used the token's id, not the body's).

---

## Report back
1. `npm test`, `npm run lint`, `npm run build` results.
2. Confirmation of the money-path self-checks (credits-once + replay-zero went red, restored).
3. What you did for 1.7 (runtime test or documented grep) and the result.
4. Whether `lib/originCheck.js` was deleted or repointed, and any callers you touched.
5. Files changed + commit hash. Note anything deferred or surprising.
</content>
