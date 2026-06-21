# DB.md — Supabase schema reference

## Tables

### `users`
| Column | Type | Default | Notes |
|---|---|---|---|
| `user_id` | text | — | PK |
| `email` | text | — | |
| `tokens` | integer | 3 | Paid token balance |
| `generations_left` | integer | 10 | Free generation allowance |
| `auth_id` | uuid | — | Unique; links to Supabase Auth |
| `phone_hash` | text | — | |
| `created_at` | timestamp | now() | |

### `cv_data`
| Column | Type | Default | Notes |
|---|---|---|---|
| `user_id` | text | — | PK, FK → users |
| `cv_data` | text | — | Extracted CV text |
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
| `user_id` | text | — | FK → users |
| `type` | text | — | Always `'ai_cost'` currently |
| `source_gen_id` | uuid | — | FK → gen_data.id |
| `model` | text | — | e.g. `'gemini-3.5-flash'` |
| `cache_hit_tokens` | integer | — | |
| `cache_miss_tokens` | integer | — | |
| `completion_tokens` | integer | — | Output tokens + thinking tokens (both billed at output rate) |
| `thinking_tokens` | integer | 0 | Thinking tokens only (subset of completion_tokens) |
| `amount_usd` | numeric | — | Calculated from model_pricing |
| `detail` | jsonb | — | `{ job_title, company, tone }` |
| `key_index` | integer | — | Which API key was used |
| `created_at` | timestamp | now() | |

Inserted by `pages/api/log-transaction.js` after every AI call.

### `model_pricing`
| Column | Type | Notes |
|---|---|---|
| `model` | text | PK (composite with event_type) |
| `event_type` | text | `'cache_hit'`, `'cache_miss'`, `'completion'` |
| `cost_per_call` | numeric | USD per token |

Current rows (as of 2026-06-20):

| model | cache_miss | cache_hit | completion |
|---|---|---|---|
| gemini-3.5-flash | $1.50/1M | $0.15/1M | $9.00/1M |
| gemini-2.5-flash | $0.30/1M | $0.075/1M | $2.50/1M |
| gemini-2.5-pro | $1.25/1M | $0.3125/1M | $10.00/1M |
| gemini-2.5-flash-lite | $0.10/1M | $0.025/1M | $0.40/1M |

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
  DELETE FROM transactions WHERE user_id = uid;
  DELETE FROM users        WHERE user_id = uid;
END $$;
```

## Known schema issues

- `pages/api/log-transaction.js` and `pages/api/analyze-cv-job.js` are dead code — nothing calls them. The live logging path is `logAiTransaction()` in `utils/database.js`, called directly from `netlify/functions/analyse-background.mjs` (analysis) and `pages/api/generate-cv-cover.js` (generation).
