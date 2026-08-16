# DB.md — Supabase schema reference

## Tables

### `users`
| Column | Type | Default | Notes |
|---|---|---|---|
| `user_id` | text | — | PK |
| `email` | text | — | |
| `tokens` | integer | 0 | Paid token balance (default lowered from 3 by `002_monetization.sql`) |
| `generations_left` | integer | 2 | Free generation allowance (`002_monetization.sql` set 1, `004_free_generations_2.sql` set 2 — one CV + one cover) |
| `auth_id` | uuid | — | Unique; links to Supabase Auth |
| `phone_hash` | text | — | |
| `candidate_core` | text | — | AI-drafted, user-tunable "who I am" profile (`002_monetization.sql`) |
| `card_on_file` | boolean | false | NOT NULL. Stripe SetupIntent verified (card captured, never charged) |
| `card_verified_at` | timestamptz | — | When the card was verified |
| `stripe_customer_id` | text | — | Stripe customer for the captured card |
| `free_downloads_left` | integer | 0 | NOT NULL. Per-account free-download allowance, seeded from `config/limits.js` FREE_DOWNLOADS once a card is verified |
| `created_at` | timestamp | now() | |

### `cv_data`
| Column | Type | Default | Notes |
|---|---|---|---|
| `user_id` | text | — | PK, FK → users |
| `cv_data` | text | — | Extracted CV text |
| `master_cv` | jsonb | — | Per-user MASTER CV (source-of-truth): structured career record built once from `cv_data` by the background analysis worker and reused by every later match. Built/merged via `buildOrMergeMaster()` in `utils/openai.js`; read/written via `getMasterCv()` / `saveMasterCv()`. Added in `005_master_cv.sql`. |
| `voice_profile` | jsonb | — | Per-user VOICE PROFILE — how they write, from samples of their own writing: `{ samples: [{text}], registers: [{sample,register,distance}], list_a: [], list_b: [{trait,translation}], confidence, profile_text, options: { cleanup }, updated_at }`. Read by the cover-letter generator (`prompts/voice-profile.js`); read/written via `getVoiceProfile()` / `saveVoiceProfile()`. Deliberately NOT inside `master_cv` — that record is the evidence set the truth-verify pass and Layer 6 validator check claims against, and voice text in it would launder a sample's wording into a "supported" fact. Added in `009_voice_profile.sql`. |
| `cv_file_url` | text | — | Storage URL |
| `created_at` | timestamp | now() | |

One row per user (upserted on upload).

### `gen_data`
| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | uuid | gen_random_uuid() | PK |
| `user_id` | text | — | FK → users |
| `source_cv_id` | uuid | — | |
| `type` | text | — | `'analysis'`, `'cv'`, `'cover'` |
| `tone` | text | — | |
| `company` | text | — | Extracted from analysis |
| `job_title` | text | — | Extracted from analysis |
| `hr_contact` | text | — | Extracted from analysis |
| `file_name` | text | — | |
| `content` | text | — | Generated document text |
| `analysis_id` | uuid | — | Links cv/cover rows back to their analysis |
| `paid` | boolean | false | |
| `paid_at` | timestamp | — | |
| `created_at` | timestamp | now() | |
| `expires_at` | timestamp | now()+90d | |

### `transactions`
| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | uuid | gen_random_uuid() | PK |
| `user_id` | uuid | — | FK → users; **type is `uuid` here while `users.user_id` is `text`** — cast with `user_id::text` on joins/deletes. `scripts/migrations/001_fix_transactions_user_id.sql` converts it to `text`; apply that and the cast is no longer needed. |
| `type` | text | — | Always `'ai_cost'` currently |
| `source_gen_id` | uuid | — | FK → gen_data.id |
| `model` | text | — | e.g. `'gemini-3.5-flash'` |
| `cache_hit_tokens` | integer | — | |
| `cache_miss_tokens` | integer | — | |
| `completion_tokens` | integer | — | Output tokens + thinking tokens (both billed at output rate) |
| `thinking_tokens` | integer | 0 | Thinking tokens only (subset of completion_tokens) |
| `amount_usd` | numeric | — | Calculated in code from `PRICING` in `utils/pricing.js`. **Null** means the model had no recorded rate — the call still gets a row, because an unpriced call must stay visible. |
| `detail` | jsonb | — | `{ job_title, company, tone }` |
| `key_index` | integer | — | Which API key was used |
| `created_at` | timestamp | now() | |

Inserted by `logAiTransaction()` in `utils/database.js` (service-role client), called from `netlify/functions/analyse-background.mjs` (analysis) and `utils/run-generation.js` (generation).

### `model_pricing` — NO LONGER READ BY THE APP

Prices live in `PRICING` in `utils/pricing.js`. This table is dead weight kept
only for historical rows; nothing queries it.

It is why the 2026-08-15 bill could not be explained from `transactions`: the
table held rates for four models, the code had moved generation to
`gemini-3.6-flash` and the master build to `gemini-3.5-flash-lite`, and
`logAiTransaction` returned *without inserting* whenever the model was absent
here. Those calls billed at Google and left no row. Two price lists that must be
kept in step is the defect; there is one now.

| Column | Type | Notes |
|---|---|---|
| `model` | text | PK (composite with event_type) |
| `event_type` | text | `'cache_hit'`, `'cache_miss'`, `'completion'` |
| `cost_per_call` | numeric | USD per token |

### `magic_tokens`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `email` | text | |
| `token` | text | Unique |
| `user_id` | text | Set after claim |
| `temp_user_id` | uuid | |
| `expires_at` | timestamptz | |
| `remember_me` | boolean | |
| `used` | boolean | |
| `created_at` | timestamptz | |

## RPCs (stored functions)

| Function | Purpose |
|---|---|
| `add_tokens(user_id, amount)` | Safely increments `users.tokens` |
| `decrement_token(user_id)` | Safely decrements `users.tokens` |
| `decrement_generations(user_id, amount)` | Decrements `users.generations_left` |
| `reset_generations(user_id)` | Resets `users.generations_left` |
| `consume_download_credit(p_user_id)` | Atomically spends one download credit: a `free_downloads_left` credit first, else a paid token. Returns text: `'free'`, `'token'`, or `'none'` (nothing available — caller must block the download). `003_download_credit_rpc.sql` |
| `top_up_generations(user_id, amount)` | Refills `users.generations_left` to `greatest(generations_left, amount)` after a download — can only raise, never lower. Returns void. `008_top_up_generations.sql` |
| `claim_account(...)` | Links temp user to authenticated account |
| `handle_new_user` | Trigger: runs on auth.users insert |
| `set_magic_token_expiration` | Trigger: sets expires_at on magic_tokens insert |
| `stop_delete` | Trigger: prevents deletes on a table |

Always use RPCs for token/generation mutations — never read-modify-write directly.

## Delete a user and all data (testing)

```sql
DO $$
DECLARE
  uid TEXT := 'replace_with_user_id';
BEGIN
  DELETE FROM gen_data     WHERE user_id = uid;
  DELETE FROM cv_data      WHERE user_id = uid;
  DELETE FROM magic_tokens WHERE user_id = uid;
  DELETE FROM transactions WHERE user_id::text = uid;  -- transactions.user_id is uuid
  DELETE FROM users        WHERE user_id = uid;
END $$;
```

The authenticated `DELETE /api/delete-account` route runs this same cascade via `deleteUserData()` in `utils/database.js`.

## Migrations

`scripts/migrations/` holds SQL applied manually in the Supabase SQL editor. `001_fix_transactions_user_id.sql` converts `transactions.user_id` from `uuid` to `text`; after it runs, drop the `::text` casts above. `005_master_cv.sql` adds the `cv_data.master_cv` JSONB column. `008_top_up_generations.sql` defines the `top_up_generations` RPC that `topUpFreeGenerations()` calls (missing until then, which 500'd every download after the credit was already spent). `009_voice_profile.sql` adds the `cv_data.voice_profile` JSONB column.
