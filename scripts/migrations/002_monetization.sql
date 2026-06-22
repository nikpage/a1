-- 002_monetization.sql
-- Apply manually in the Supabase SQL editor.
--
-- Shifts the free tier to a card-capture model:
--   * New users start with 0 paid tokens (was 3).
--   * card_on_file / card_verified_at track Stripe SetupIntent verification
--     (card captured, no charge) which unlocks the free download(s).
--   * free_downloads_left is the per-account free-download allowance,
--     seeded from config/limits.js FREE_DOWNLOADS once a card is verified.
--   * candidate_core stores the AI-drafted, user-tunable "who I am" profile.
--
-- generations_left default is lowered to 1 to match LIMITS.FREE_GENERATIONS
-- (one free CV & cover). Existing rows are NOT retroactively changed.

ALTER TABLE users ALTER COLUMN tokens SET DEFAULT 0;
ALTER TABLE users ALTER COLUMN generations_left SET DEFAULT 1;

ALTER TABLE users ADD COLUMN IF NOT EXISTS candidate_core      text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS card_on_file        boolean     NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS card_verified_at    timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id  text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS free_downloads_left integer     NOT NULL DEFAULT 0;
