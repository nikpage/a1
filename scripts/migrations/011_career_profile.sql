-- 011_career_profile.sql
--
-- The per-user CAREER PROFILE: the job-agnostic half of the analysis — arc,
-- parallel experience, transferable skills, the base scenario, the standing
-- risks a recruiter reads before any ad, and the proven-keyword inventory.
--
-- It exists because none of that changes when the job ad changes, yet it was
-- being re-derived by a full-record AI call on EVERY application. It is keyed
-- by a fingerprint of the master, so it is rebuilt only when the record itself
-- changes, and patched (not rebuilt) when a skill is added.
--
-- Its own column, NOT a field inside master_cv: the master is the evidence set
-- the truth passes check every claim against, and interpretation stored there
-- would launder judgement into fact.

ALTER TABLE cv_data ADD COLUMN IF NOT EXISTS career_profile jsonb;
