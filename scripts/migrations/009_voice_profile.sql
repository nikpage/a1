-- 009_voice_profile.sql
--
-- The per-user VOICE PROFILE: samples of the user's own writing, the extracted
-- List A / List B(+translations), and their hand-edited lines. Read by the
-- cover-letter generator so the letter sounds like the person who is applying.
--
-- Its own column, NOT a field inside master_cv, and that separation is
-- load-bearing: master_cv is the evidence set the truth-verify pass and the
-- Layer 6 validator check every generated claim against, so voice text stored
-- inside it would launder a claim from a writing sample into a "supported" fact.

ALTER TABLE cv_data ADD COLUMN IF NOT EXISTS voice_profile jsonb;
