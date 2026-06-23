-- MANUAL APPLY REQUIRED: run in Supabase SQL editor (Dashboard > SQL Editor)
--
-- Adds the per-user MASTER CV: a persisted, reusable source-of-truth built once
-- from the user's CV (and merged when they upload more). Every later job match
-- reasons from this instead of re-deriving the candidate from raw text each time.
-- Stored as JSONB on the existing one-row-per-user cv_data table.

BEGIN;
ALTER TABLE cv_data ADD COLUMN IF NOT EXISTS master_cv jsonb;
COMMIT;
