-- MANUAL APPLY REQUIRED: run in Supabase SQL editor (Dashboard > SQL Editor)
-- After applying, remove the ::text cast in DB.md's delete-user snippet.

-- Migrate transactions.user_id from uuid to text to match users.user_id
BEGIN;
ALTER TABLE transactions ALTER COLUMN user_id TYPE text USING user_id::text;
COMMIT;
