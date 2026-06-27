-- MANUAL APPLY REQUIRED: run in Supabase SQL editor (Dashboard > SQL Editor)
--
-- Adds the LAYOUT SIGNAL sidecar: a small JSON record of how the uploaded file
-- itself parses — column count, whether it is a scanned/image CV with no real
-- machine-readable text, and the verbatim date strings. The landing teaser reads
-- this to judge the ATS gate and buried-credential scan against the REAL
-- document, instead of the cleaned master CV (which has erased all of it).
-- Captured at extract time in utils/extractCvText.js; nullable, since capture is
-- best-effort and an upload must still succeed on text alone.

BEGIN;
ALTER TABLE cv_data ADD COLUMN IF NOT EXISTS cv_layout jsonb;
COMMIT;
