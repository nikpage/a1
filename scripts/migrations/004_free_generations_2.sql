-- 004_free_generations_2.sql
-- Apply manually in the Supabase SQL editor (after 002).
--
-- New accounts get 2 free writes (one CV + one cover; each document costs one
-- write). Keeps the DB default in sync with config/limits.js FREE_GENERATIONS.
-- Existing rows are NOT changed.

ALTER TABLE users ALTER COLUMN generations_left SET DEFAULT 2;
