# Instruction set #1 — Test & CI foundation (REBUILD.md tasks 0.1, 0.2, 0.3)

**You are the implementing CLI (Sonnet).** Do exactly this set, nothing more. Work on
branch `claude/confident-volta-kuvgys`. When done, report back per the "Report" section.

**Read first:** the "Testing law" section in `CLAUDE.md`. It is binding. In short: tests
must call the real code and assert real values; mock only external boundaries; every test
must be able to fail.

This set deliberately changes **no application code**. Its only job is to stand up a test
harness and CI, and prove they genuinely verify correctness by testing two pieces of
already-correct, stable code. Do not "fix" anything you notice — log it in your report instead.

---

## Task 0.1 — Install and configure the test runner

1. Add dev dependencies: `vitest`, `node-mocks-http`.
2. Create `vitest.config.js` with a Node environment (these are server modules, not React):
   ```js
   import { defineConfig } from 'vitest/config';
   export default defineConfig({
     test: { environment: 'node', include: ['**/*.test.js'], globals: true },
   });
   ```
3. Add to `package.json` scripts:
   - `"test": "vitest run"`
   - `"test:watch": "vitest"`
   - `"test:coverage": "vitest run --coverage"`
4. Tests must run with **no Doppler/secrets** — they set their own env vars and mock every
   external service. `npm test` must work on a clean checkout.

## Task 0.2 — Two real tests that prove the harness verifies correctness

Put tests next to the code (e.g. `lib/auth.test.js`, `utils/database.test.js`) or under
`__tests__/` — your choice, but keep it consistent.

### Test A — JWT mint→verify roundtrip (`lib/auth.js`)
Mock only the clock if you need to; do **not** mock `jsonwebtoken` (it is the logic under test).
- Set `process.env.JWT_SECRET` to a fixed test value before importing.
- `mintSessionToken({ user_id: 'u123', email: 'a@b.com' })` then `verifyToken(...)` returns
  an object with exactly `user_id: 'u123'` and `email: 'a@b.com'`.
- A token signed with a **different** secret returns `null` from `verifyToken`.
- A structurally tampered token (flip a character in the payload segment) returns `null`.
- `verifyToken(null)` returns `null`.

### Test B — AI-cost math (`logAiTransaction` in `utils/database.js`)
This verifies the money math and the exact row written. Mock **only** the Supabase client
boundary: mock `@supabase/supabase-js`'s `createClient` so that
- `.from('model_pricing').select(...).eq('model', …)` resolves to known pricing rows, and
- `.from('transactions').insert(rows)` captures the inserted row and resolves `{ error: null }`.

Use these pricing rows (USD per token):
`cache_miss = 0.0000015`, `cache_hit = 0.00000015`, `completion = 0.000009`.

Call:
```js
await logAiTransaction({
  user_id: 'u123', model: 'gemini-3.5-flash',
  cache_miss_tokens: 1000, cache_hit_tokens: 0,
  completion_tokens: 500, thinking_tokens: 100,
  detail: { type: 'cv' },
});
```
Assert on the **captured inserted row**:
- `amount_usd === '0.006000000000'`  (= 1000×0.0000015 + 500×0.000009, formatted to 12 dp)
- `user_id === 'u123'`, `type === 'ai_cost'`, `model === 'gemini-3.5-flash'`,
  `completion_tokens === 500`, `thinking_tokens === 100`, `cache_miss_tokens === 1000`.
- Also add a case where the pricing lookup returns an empty array → `insert` is **never**
  called (the function bails). This is a real negative assertion, not a mock-only one.

**Self-check (required):** temporarily break each assertion's expected value, confirm the
test FAILS, then restore. Confirm in your report that you did this — a test that can't fail
is a violation of the Testing law.

## Task 0.3 — CI

Create `.github/workflows/ci.yml`:
- Trigger on push and pull_request.
- Node 22 (matches Netlify).
- Steps: `npm ci`, `npm run lint`, `npm test`, `npm run build`.
- For the build step only, provide **placeholder** env vars so module-load `createClient`
  calls don't crash (e.g. `NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=test`, `SUPABASE_SERVICE_ROLE_KEY=test`,
  `JWT_SECRET=test-secret`). Never put real secrets in CI.
- If `npm run lint` fails on pre-existing issues unrelated to this task, do not fix code —
  report the failures and, if needed, scope lint to passing config; flag it for the architect.

---

## Report back (paste into your final message)
1. Exact commands to run the suite (`npm test`) and their output (pass counts).
2. Confirmation you ran the self-check (broke each assertion, saw red, restored green).
3. Anything you noticed but did NOT change (dead code, bugs, lint failures) — list for the architect.
4. Files added/changed and the commit hash.
</content>
