# Instruction set #4 — Correctness & resilience (REBUILD.md 2.1, 2.2, 2.3, 2.4)

**You are the implementing CLI (Sonnet).** Branch `claude/confident-volta-kuvgys`.
Read the **Testing law** in `CLAUDE.md` first — binding. Reuse helpers in `__tests__/helpers.js`.
Do not touch `prompts/`, do not undo any auth work from prior sets.

---

## Task 2.1 — Don't lose a generation on AI failure (`pages/api/generate-cv-cover.js`)

Today the route decrements `generations_left` **before** calling Gemini. If Gemini fails,
the user loses a generation for nothing.

Fix: move the decrement to **after** both AI calls succeed. If either call throws, the
decrement must not have happened. The decrement still uses `decrementGenerations` from
`utils/generation-utils.js` — do not replace it with raw SQL.

**Tests** (mock `generateCV`, `generateCoverLetter`, `decrementGenerations`, `getCV`, `getUserById`, `saveGeneratedDoc`, `logAiTransaction`):
- Happy path: Gemini succeeds → `decrementGenerations` called once after success.
- Gemini throws on CV generation → `decrementGenerations` **not** called; response is 500.
- Gemini throws on cover-letter generation → `decrementGenerations` **not** called; response is 500.

Self-check: temporarily move the decrement back before the AI call, confirm the
"Gemini throws → not called" test goes red, restore.

## Task 2.2 — Double-submit guard on generation

Two rapid clicks (or tab-duplicates) can fire two concurrent generate requests, spending
two generations. Guard with a short per-user Redis lock.

Add to `pages/api/generate-cv-cover.js` (after auth, before any DB/AI work):
```js
const lockKey = `gen_lock:${user_id}`;
const acquired = await redis.set(lockKey, '1', { nx: true, ex: 30 });
if (acquired !== 'OK') return res.status(429).json({ error: 'Generation already in progress' });
```
Release the lock in a `finally` block (`await redis.del(lockKey)`) so it always clears even
on error. Use the singleton Redis client from `@upstash/redis` (`Redis.fromEnv()`).

**Tests** (mock Redis alongside existing mocks):
- Lock acquired (`redis.set` returns `'OK'`) → generation proceeds normally.
- Lock already held (`redis.set` returns `null`) → 429 immediately, no AI call, no decrement.
- AI throws (after lock acquired) → lock is released (`redis.del` called).

## Task 2.3 — Shared Gemini call helper with 429 rotation

Today `analyzeCvJob` retries across keys on 429, but `generateCV` and `generateCoverLetter`
each make a single call with no retry. Extract a shared helper and use it everywhere.

1. In `utils/openai.js`, add a private `callGemini(model, messages)` function that:
   - Iterates over all available keys (same logic as `analyzeCvJob` today).
   - On 429 from any key, logs a warning and tries the next key.
   - After exhausting all keys on 429, throws with `.isRateLimit = true`.
   - On any other error, throws immediately (don't retry non-rate-limit failures).
2. Refactor `analyzeCvJob`, `generateCV`, `generateCoverLetter` to all use `callGemini`.
   Their public interfaces (parameters, return shape) must not change.

**Tests** (mock `axios.post`):
- First key returns 429, second key succeeds → result returned, no error thrown.
- Both keys return 429 → error thrown with `.isRateLimit === true`.
- First key returns a non-429 error (e.g. 500) → error thrown immediately, second key never tried.
- Happy path (first key succeeds) → result returned from first call.

Self-check: break the "first 429 → try second" logic (e.g. throw immediately on any error),
confirm the first test goes red, restore.

## Task 2.4 — Real rate limiting on live routes; fix the middleware

Two problems today: the middleware guards the deleted `analyze-cv-job` route (pointless),
and none of the real routes have per-IP rate limiting.

1. **Rewrite `middleware.js`** to guard the three routes that should be rate-limited:
   `/api/upload-cv`, `/api/generate-cv-cover`, `/api/auth/send-magic-link`.
   Use `@upstash/ratelimit` with `Ratelimit.slidingWindow` — pick sensible limits:
   - `upload-cv`: 10 requests per minute per IP.
   - `generate-cv-cover`: 10 per minute per IP.
   - `send-magic-link`: 5 per minute per IP.
   Use Netlify's real client-IP header: `x-nf-client-connection-ip`, falling back to
   `x-forwarded-for` (first value), then `127.0.0.1`.
2. **Remove the old 100KB content-length check** (it was guarding the deleted route and the
   limit was too small for CV uploads anyway — `upload-cv.js` already enforces 200KB).
3. **Update the `matcher`** to: `['/api/upload-cv', '/api/generate-cv-cover', '/api/auth/send-magic-link']`.

Note: Next.js middleware runs in the Edge runtime — keep it import-clean (no Node-only APIs).
`@upstash/redis` and `@upstash/ratelimit` both support Edge.

**Tests** for middleware are hard in the Next.js edge environment — if you cannot write a
meaningful runtime test for the middleware itself, document this explicitly (allowed by the
Testing law's honesty clause) and instead test the *rate limiter configuration*: assert that
the three `Ratelimit` instances are constructed with the expected window sizes and request
limits (mock `Ratelimit` constructor and assert call args).

---

## Report back
1. `npm test`, `npm run lint`, `npm run build` results (all must pass).
2. Self-check confirmation for 2.1 (decrement-before vs after) and 2.3 (retry logic).
3. For 2.4: whether you wrote a runtime test or a config test, and why.
4. Files changed + commit hash.
</content>
