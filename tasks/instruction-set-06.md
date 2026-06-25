# Instruction set #6 — Database hygiene + Maintainability (REBUILD.md 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4)

**You are the implementing CLI (Sonnet).** Branch `claude/confident-volta-kuvgys`.
Read the **Testing law** in `CLAUDE.md` — binding. Reuse helpers in `__tests__/helpers.js`.
Do not touch `prompts/`, do not undo any auth, resilience, or observability work.

Work through the tasks in order — each is independently committable. One commit per task is fine; one big commit covering all is also fine.

---

## Task 4.1 — Fix `transactions.user_id` type mismatch

`transactions.user_id` is `uuid` but `users.user_id` is `text`. This forces `::text` casts everywhere. Fix it with a migration.

Create `scripts/migrations/001_fix_transactions_user_id.sql`:

```sql
-- Migrate transactions.user_id from uuid to text to match users.user_id
BEGIN;
ALTER TABLE transactions ALTER COLUMN user_id TYPE text USING user_id::text;
COMMIT;
```

This file is committed for reference; **it must be applied manually** in the Supabase SQL editor or via the Supabase CLI. Add a note at the top of the file:
```
-- MANUAL APPLY REQUIRED: run in Supabase SQL editor (Dashboard > SQL Editor)
-- After applying, remove the ::text cast in DB.md's delete-user snippet.
```

Update `DB.md`:
- In the `transactions` table, change the `user_id` type column from `**uuid**` to `text`.
- Remove the `⚠️ Type mismatch` note from that row.
- In the "Delete a user" SQL block, remove the `::text` cast: `DELETE FROM transactions WHERE user_id = uid;`
- Remove both duplicate lines in the "Known schema issues" section that describe this mismatch (keep the section header, remove the two duplicate bullet points about transactions.user_id).

**No runtime code changes needed** — the cast is only in DB.md documentation.
**No test needed** — this is a documentation + migration file; no logic to test.

---

## Task 4.2 — Remove duplicate pricing tables

`utils/key-manager.js` has a `pricingRates` object (used only by `calculateCost` / `trackUsage`, which are dead code — never called from any server path). Remove it entirely:

In `utils/key-manager.js`:
- Delete the `pricingRates` object from the constructor.
- Delete the `calculateCost(usage, model)` method.
- Delete the `trackUsage(usageData, model)` method.
- Delete the `getUsageStats()` method (returns the usage log built by trackUsage — also dead).
- Delete the `usageLog` array from the constructor.
- The `localStorage` block inside `trackUsage` goes with it.

Confirm `utils/openai.js`'s `PRICING` table is the only remaining one and verify its rates match `DB.md`'s `model_pricing` section. If any rate differs, update the comment in openai.js to flag it (do not change the rates themselves without checking ai.google.dev/gemini-api/docs/pricing).

**No test needed** — this is deletion of dead code. Verify by running `npm run build` and confirming no import of the removed methods exists.

---

## Task 4.3 — GDPR: authenticated user self-delete endpoint

Create `pages/api/delete-account.js`:

```js
import requireAuth from '../../lib/requireAuth';
import { deleteUserData } from '../../utils/database';

async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
  const { user_id } = req.user;
  await deleteUserData(user_id);
  res.setHeader('Set-Cookie', 'auth-token=; Max-Age=0; Path=/; HttpOnly');
  return res.status(200).json({ deleted: true });
}

export default requireAuth(handler);
```

Add `deleteUserData(user_id)` to `utils/database.js` (use the admin client):

```js
export async function deleteUserData(user_id) {
  const db = getAdminSupabase();
  // Order matters: delete child rows before users
  for (const table of ['gen_data', 'cv_data', 'magic_tokens']) {
    const { error } = await db.from(table).delete().eq('user_id', user_id);
    if (error) throw new Error(`deleteUserData: ${table} delete failed: ${error.message}`);
  }
  // transactions.user_id may still be uuid in prod until migration 001 is applied;
  // cast to text to be safe
  const { error: txErr } = await db.from('transactions').delete().eq('user_id', user_id);
  if (txErr) throw new Error(`deleteUserData: transactions delete failed: ${txErr.message}`);
  const { error: userErr } = await db.from('users').delete().eq('user_id', user_id);
  if (userErr) throw new Error(`deleteUserData: users delete failed: ${userErr.message}`);
}
```

**Tests** (`__tests__/delete-account.test.js`, mock `utils/database.js`):
- Authenticated DELETE → `deleteUserData` called with correct `user_id`; response 200 `{ deleted: true }`; `Set-Cookie` header clears the auth token.
- `deleteUserData` throws → response 500.
- Unauthenticated request → 401 (this comes from `requireAuth` — assert it here to verify the route is protected).
- Cross-user test: user A cannot delete user B's data — user_id comes from `req.user`, never from the request body.

Also add a unit test for `deleteUserData` itself (mock the admin Supabase client via `__tests__/helpers.js`):
- Happy path: all five deletes called in the correct table order.
- First delete throws: error propagates; remaining deletes NOT called.

---

## Task 5.1 — Resend for magic-link email (remove Gmail/nodemailer)

`pages/api/auth/send-magic-link.js` currently uses `nodemailer` with a hardcoded Gmail SMTP account. Replace with Resend (`resend` is already in `dependencies`).

Remove:
```js
import nodemailer from "nodemailer";
const transporter = nodemailer.createTransport({ ... });
```

Add:
```js
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);
```

Replace the `transporter.sendMail(...)` call with:
```js
const { error: mailErr } = await resend.emails.send({
  from: process.env.RESEND_FROM_EMAIL || 'noreply@mysuper.cv',
  to: emailNorm,
  subject: 'Your login link for mysuper.cv',
  html: `<p>Click <a href="${magicLink}">here</a> to log in. Link expires in 15 minutes.</p>`,
});
if (mailErr) {
  logger.error('Mail error:', mailErr.message);
  return res.status(500).json({ error: 'Email send failed.' });
}
```

Add `RESEND_FROM_EMAIL` to the env-var table in `CLAUDE.md` (purpose: "Verified sender address for magic-link email, e.g. noreply@mysuper.cv").

**Tests** (`__tests__/send-magic-link.test.js`):

Mock `resend` (`vi.mock('resend', () => ({ Resend: vi.fn(() => ({ emails: { send: mockSend } })) }))`).

- Valid new-user email → `resend.emails.send` called with `to: emailNorm`, `subject` containing "login link", `from` set; response 200.
- Resend returns an error object → response 500 `{ error: 'Email send failed.' }`.
- In `NODE_ENV !== 'production'`: dev shortcut path returns 200 with `devLink` and does NOT call `resend.emails.send`.
- Invalid email (no `@`) → 400, `resend.emails.send` never called.

---

## Task 5.2 — Single Supabase access layer

Every route that calls `createClient(...)` directly must be updated to use functions from `utils/database.js` instead.

### Step 1: Add functions to `utils/database.js`

Add these to the admin section (using `getAdminSupabase()`):

```js
export async function getLatestAnalysis(user_id) {
  const { data, error } = await getAdminSupabase()
    .from('gen_data').select('content')
    .eq('user_id', user_id).eq('type', 'analysis')
    .order('created_at', { ascending: false }).limit(1).single();
  if (error) throw error;
  return data;
}

export async function getCvList(user_id) {
  const { data, error } = await getAdminSupabase()
    .from('cv_data').select('*')
    .eq('user_id', user_id).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getUserStats(user_id) {
  const { data, error } = await getAdminSupabase()
    .from('users').select('generations_left, tokens, email')
    .eq('user_id', user_id).single();
  if (error) throw error;
  return data;
}

export async function getGenDataByAnalysisId(user_id, analysis_id) {
  const { data, error } = await getAdminSupabase()
    .from('gen_data').select('content')
    .eq('user_id', user_id).eq('analysis_id', analysis_id).eq('type', 'analysis')
    .order('created_at', { ascending: false }).limit(1);
  if (error) throw error;
  return data;
}

export async function getUserByEmail(email) {
  const { data } = await getAdminSupabase()
    .from('users').select('user_id, email').eq('email', email).maybeSingle();
  return data;
}

export async function updateUserEmail(user_id, email) {
  const { error } = await getAdminSupabase()
    .from('users').update({ email }).eq('user_id', user_id);
  if (error) throw error;
}

export async function createUserWithEmail(email) {
  const { data, error } = await getAdminSupabase()
    .from('users').insert([{ email, user_id: crypto.randomUUID() }])
    .select('user_id').maybeSingle();
  if (error) throw new Error(`createUserWithEmail failed: ${error.message}`);
  return data;
}

export async function getMagicToken(token) {
  const { data, error } = await getAdminSupabase()
    .from('magic_tokens').select('*')
    .eq('token', token).eq('used', false)
    .gt('expires_at', new Date().toISOString()).single();
  if (error) return null;
  return data;
}

export async function deleteMagicToken(token) {
  await getAdminSupabase().from('magic_tokens').delete().eq('token', token);
}

export async function insertMagicToken({ email, token, user_id, expires_at, remember_me }) {
  const { error } = await getAdminSupabase().from('magic_tokens').insert([{
    email, token, user_id, expires_at, remember_me, used: false,
  }]);
  if (error) throw new Error(`insertMagicToken failed: ${error.message}`);
}

export async function deleteMagicTokensByEmail(email) {
  await getAdminSupabase().from('magic_tokens').delete().eq('email', email);
}
```

Add `import crypto from 'crypto';` at the top of `utils/database.js`.

### Step 2: Update the routes

For each file, remove the `import { createClient } from '@supabase/supabase-js'` and the local `const supabase = createClient(...)`, then replace the inline Supabase calls with the new database.js functions.

**`pages/api/get-analysis.js`**  
Import `getLatestAnalysis` from `../../utils/database`. Replace the `supabase.from('gen_data')...` block with `await getLatestAnalysis(user_id)`.

**`pages/api/get-cvs.js`**  
Import `getCvList`. Replace the `supabase.from('cv_data')...` block with `await getCvList(user_id)`.

**`pages/api/header-stats.js`**  
Import `getUserStats`. Replace the `supabase.from('users')...` block with `await getUserStats(user_id)`.

**`pages/api/get-analysis-status.js`**  
Import `getGenDataByAnalysisId`. Replace the `supabase.from('gen_data')...` block with `await getGenDataByAnalysisId(user_id, analysis_id)`.

**`pages/api/generate-cv-cover.js`**  
Remove the unused `createClient` import and the local `supabase` variable (they were never called — the file already uses `getCV`/`saveGeneratedDoc` from `utils/database.js`).

**`pages/api/auth/verify.js`**  
Import `getMagicToken`, `deleteMagicToken` from `../../../utils/database`. Replace the two `supabase.from('magic_tokens')` calls.

**`pages/api/auth/send-magic-link.js`**  
Import `getUserByEmail`, `updateUserEmail`, `createUserWithEmail`, `deleteMagicTokensByEmail`, `insertMagicToken` from `../../../utils/database`. Replace all `supabase.from(...)` calls. Remove the local `createClient` import and `const supabase = createClient(...)`.

**`pages/api/upload-cv.js`**  
The `upsertCV` and `upsertUser` functions already exist in `utils/database.js`. Remove the local `createClient` + `supabase` and use those imports instead.

**Tests**: The existing tests for these routes already mock `utils/database.js` — confirm they still pass. Add one new test to `__tests__/database.test.js` verifying that `getLatestAnalysis` calls `.from('gen_data')` with the correct user_id (mock the admin Supabase client).

---

## Task 5.3 — Remove junk files and unused deps

### Junk files
Delete these two files (they are empty/stale and tracked in git):
- `User-Agent:` (the literal filename with colon)
- `project-tree.txt`

```bash
git rm "User-Agent:" project-tree.txt
```

### Unused dependencies

Confirm each is unreferenced, then remove:

| Package | Why safe to remove |
|---|---|
| `ioredis` | `lib/redis.js` says it's no longer needed; no import anywhere in routes |
| `pg` | No import anywhere — Supabase SDK handles DB |
| `magic-sdk` | No import anywhere — removed with dead routes in M1 |
| `textract` | No import anywhere — replaced by mammoth + pdf-parse |
| `franc` | No import anywhere |
| `openai` | No import anywhere — we call Gemini's OpenAI-compatible endpoint directly via axios |

```bash
npm uninstall ioredis pg magic-sdk textract franc openai
```

Verify `npm run build` passes after removal.

**No test needed** — confirmed by build passing.

---

## Task 5.4 — Surface data-retention policy

Create `pages/privacy.js` — a simple static page:

```jsx
export default function Privacy() {
  return (
    <main style={{ maxWidth: 680, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'sans-serif', lineHeight: 1.6 }}>
      <h1>Privacy & Data Retention</h1>
      <p><strong>What we store:</strong> your uploaded CV text, generated documents, and (if you log in) your email address.</p>
      <p><strong>How long:</strong> generated documents are automatically deleted after 90 days. Your CV and account data are kept until you delete your account.</p>
      <p><strong>Your rights:</strong> you can delete your account and all associated data at any time from your account page.</p>
      <p><strong>Payments:</strong> we do not store card details. Payments are processed by Stripe.</p>
      <p><strong>AI processing:</strong> your CV and job description are sent to Google Gemini for analysis and document generation. Google's data-handling terms apply.</p>
      <p><strong>Contact:</strong> questions? Email us at privacy@mysuper.cv.</p>
    </main>
  );
}
```

Add a footer link to `/privacy` in the existing layout or footer component. Find the footer component — `grep -r "footer\|Footer" pages/ components/ --include="*.js" --include="*.jsx" -l` — and add an `<a href="/privacy">Privacy</a>` link. If there is no shared footer component, add the link directly to `pages/index.js`'s bottom section.

**No test needed** — static page with no logic.

---

## Report back
1. `npm test`, `npm run lint`, `npm run build` — all must pass.
2. Confirm: `grep -r "createClient" pages/ --include="*.js"` returns zero results.
3. Confirm: `grep -r "nodemailer\|gmail\|GMAIL" pages/ --include="*.js"` returns zero results.
4. Confirm: `npm ls ioredis pg openai franc textract magic-sdk 2>&1` shows none installed.
5. Files changed + commit hash.
