# Instruction set #5 — Observability (REBUILD.md 3.1, 3.2, 3.3)

**You are the implementing CLI (Sonnet).** Branch `claude/confident-volta-kuvgys`.
Read the **Testing law** in `CLAUDE.md` first — binding. Reuse helpers in `__tests__/helpers.js`.
Do not touch `prompts/`, do not undo any auth or resilience work from prior sets.

---

## Task 3.1 — Leveled logger; replace all console.X calls

### Create `lib/logger.js`

```js
const IS_PROD = process.env.NODE_ENV === 'production';

export const logger = {
  debug: IS_PROD ? () => {} : (...a) => console.log('[DEBUG]', ...a),
  info:  IS_PROD ? () => {} : (...a) => console.log('[INFO]',  ...a),
  warn:  (...a) => console.warn('[WARN]',  ...a),
  error: (...a) => console.error('[ERROR]', ...a),
};
```

Rules for replacing callsites (apply to every file below):
- `console.log(...)` → `logger.info(...)`  
- `console.warn(...)` → `logger.warn(...)`  
- `console.error(...)` → `logger.error(...)`  
- Never log: raw CV text, email addresses in errors, full Stripe event objects,
  any string from `process.env`, JWT tokens, or full API keys.
  Where a log currently does this, trim or omit the sensitive field.

Files to update (replace every console.X):

| File | Sensitive-field action |
|---|---|
| `utils/database.js` | `upsertUser` logs `user_id` — ok; remove the `data` dump from the success log |
| `utils/openai.js` | The two `console.log` prompt/output preview lines → `logger.debug`. The `console.warn` inside callGemini → `logger.warn`. The two JSON-parse error lines → `logger.error`. |
| `utils/key-manager.js` | Replace all; the key-preview log (`key.slice(0,12)`) is ok at debug level |
| `utils/generation-utils.js` | Replace all |
| `utils/uploadAndAnalyze.js` | The Gemini cost `console.log` → `logger.info` |
| `pages/api/generate-cv-cover.js` | Replace all |
| `pages/api/get-analysis.js` | Replace all |
| `pages/api/get-analysis-status.js` | Replace all |
| `pages/api/upload-cv.js` | Replace all |
| `pages/api/auth/send-magic-link.js` | Replace all; the mail-error log — do NOT log the full `mailError` object in prod (it may contain email); log `mailError.message` only |
| `pages/api/auth/verify.js` | Replace all |
| `pages/api/stripe/webhook.js` | The success log currently includes `user_id` — omit user_id; keep event_id and quantity |
| `pages/api/stripe/create-session.js` | Replace all |
| `pages/api/stripe/create-checkout.js` | Replace all |
| `netlify/functions/analyse-background.mjs` | Replace all |

**Tests** (`__tests__/logger.test.js`):
- In non-production (`NODE_ENV !== 'production'`), `logger.info` calls `console.log`.
- In simulated production (`NODE_ENV = 'production'`), `logger.info` and `logger.debug` are no-ops (spy confirms console.log never called).
- `logger.warn` and `logger.error` always emit regardless of NODE_ENV.

(Mock `console.log`, `console.warn`, `console.error` via `vi.spyOn`.)

---

## Task 3.2 — Sentry error monitoring

Install: `npm install @sentry/nextjs`

### Config files

**`sentry.server.config.js`** (API routes — Node runtime):
```js
import * as Sentry from '@sentry/nextjs';
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: !!process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
});
```

**`sentry.edge.config.js`** (middleware — Edge runtime):
```js
import * as Sentry from '@sentry/nextjs';
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: !!process.env.SENTRY_DSN,
  tracesSampleRate: 0,
});
```

**`sentry.client.config.js`** (browser):
```js
import * as Sentry from '@sentry/nextjs';
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
});
```

### Wrap `next.config.js`

Read the current `next.config.js`. Wrap its export with `withSentryConfig`:

```js
import { withSentryConfig } from '@sentry/nextjs';

// ... existing config object as `nextConfig` ...

export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
});
```

### Wire Sentry into the background function

In `netlify/functions/analyse-background.mjs`, import Sentry and capture the top-level catch:
```js
import * as Sentry from '@sentry/node';
// In the outer try/catch that currently logs '[analyse-bg] analysis error':
catch (e) {
  Sentry.captureException(e);
  logger.error('[analyse-bg] analysis error:', e.response?.data || e.message);
  // ... existing sentinel save ...
}
```

Add `SENTRY_DSN` to the key env-var table in `CLAUDE.md` (purpose: "Error monitoring").

**Tests:** Sentry itself is a third-party SDK — testing its wiring is an integration test
that requires a live DSN and is infeasible in unit tests. Document this explicitly in a
comment at the top of the Sentry config files: "Verified manually: exceptions captured
when SENTRY_DSN is set; no-op when DSN is absent." No hollow unit test.

---

## Task 3.3 — Gemini daily spend guard

Add a daily spend accumulator to `utils/openai.js`. After each successful AI call, fire-and-forget a Redis increment. If the day's total exceeds `GEMINI_DAILY_BUDGET_USD` (env var, default `10`), emit a `logger.error` alert.

### Implementation in `utils/openai.js`

Add after the existing imports:
```js
import { Redis } from '@upstash/redis';

let _redis;
function getRedis() {
  if (!_redis) _redis = Redis.fromEnv();
  return _redis;
}

const DAILY_BUDGET = parseFloat(process.env.GEMINI_DAILY_BUDGET_USD || '10');

export async function trackDailySpend(costUsd) {
  const key = `gemini_spend:${new Date().toISOString().slice(0, 10)}`; // YYYY-MM-DD
  try {
    const redis = getRedis();
    const newTotal = await redis.incrbyfloat(key, costUsd);
    await redis.expire(key, 60 * 60 * 26); // 26h TTL — survives midnight briefly
    if (newTotal >= DAILY_BUDGET) {
      logger.error(`[spend-guard] Daily Gemini spend $${newTotal.toFixed(4)} has reached/exceeded budget $${DAILY_BUDGET}`);
    }
  } catch (e) {
    logger.warn('[spend-guard] Could not record spend:', e.message);
  }
}
```

Call `trackDailySpend` (no await — fire-and-forget) at the end of each of the three exported functions, passing `gemini_usage.costUsd`:

- `analyzeCvJob`: after `return { choices, output, usage, gemini_usage }` — just before the return, call `trackDailySpend(gemini_usage.costUsd)` (without await).
- `generateCV`: same, after computing `gemini_usage`.
- `generateCoverLetter`: same.

**Tests** (`__tests__/spend-guard.test.js`, mock `@upstash/redis` and `utils/openai.js`'s Redis singleton):
- `trackDailySpend(0.002)` with a mocked `incrbyfloat` returning `0.002` → `redis.expire` called with 26h TTL; no error logged.
- `trackDailySpend(1.0)` with mocked `incrbyfloat` returning `11.5` (over $10 budget) → `logger.error` called (spy on logger.error).
- Redis throws → `logger.warn` called (spy), no exception propagated (function resolves).

(Import and call the real `trackDailySpend` function — do not test a mock of it.)

---

## Report back
1. `npm test`, `npm run lint`, `npm run build` — all must pass.
2. Logger test: confirm production no-op test would go red if you removed the `IS_PROD` condition.
3. Spend guard test: confirm budget-exceeded test would go red if the threshold comparison were removed.
4. For Sentry: state explicitly that it is documented-only (no unit test), per the Testing law honesty clause.
5. Files changed + commit hash.
