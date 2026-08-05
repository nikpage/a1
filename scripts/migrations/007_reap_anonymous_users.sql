-- 007_reap_anonymous_users.sql
--
-- Every landing-page CV upload mints a users row before anyone has signed up
-- (that is deliberate — the funnel analyses first and asks for an email after).
-- Nothing has ever cleaned up the ones that never convert, so emailless rows
-- and their CVs accumulate forever.
--
-- This adds a reaper. It is CONSERVATIVE by design: a row is only deleted when
-- every one of these is true —
--   * no email        (never signed up)
--   * no card on file (never entered the paid funnel)
--   * no tokens       (never bought anything)
--   * older than the cutoff, default 30 days
-- so a paying or identified account can never be caught by it, and a visitor
-- who uploaded this morning has a month to come back and claim the analysis.
--
-- Children are removed first, mirroring deleteUserData() in utils/database.js,
-- because there are no ON DELETE CASCADE constraints to rely on.
--
-- Preview before scheduling — this is a dry run, it changes nothing:
--
--   SELECT count(*) FROM users
--   WHERE email IS NULL AND coalesce(card_on_file,false) = false
--     AND coalesce(tokens,0) = 0 AND created_at < now() - interval '30 days';
--
-- Run it manually:      SELECT reap_anonymous_users();
-- Or with a cutoff:     SELECT reap_anonymous_users(interval '90 days');
--
-- To run it nightly, enable pg_cron in Supabase and schedule it (uncommented
-- at the bottom of this file — left commented so applying this migration never
-- silently starts deleting on a timer):
--
--   SELECT cron.schedule('reap-anonymous-users', '0 3 * * *',
--                        $$SELECT reap_anonymous_users()$$);

BEGIN;

CREATE OR REPLACE FUNCTION reap_anonymous_users(older_than interval DEFAULT interval '30 days')
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  doomed uuid[];
  removed integer;
BEGIN
  SELECT array_agg(user_id) INTO doomed
  FROM users
  WHERE email IS NULL
    AND coalesce(card_on_file, false) = false
    AND coalesce(tokens, 0) = 0
    AND created_at < now() - older_than;

  IF doomed IS NULL THEN
    RETURN 0;
  END IF;

  DELETE FROM gen_data      WHERE user_id = ANY(doomed);
  DELETE FROM cv_data       WHERE user_id = ANY(doomed);
  DELETE FROM magic_tokens  WHERE user_id = ANY(doomed);
  DELETE FROM transactions  WHERE user_id = ANY(doomed);
  DELETE FROM users         WHERE user_id = ANY(doomed);

  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

COMMIT;

-- Nightly schedule — uncomment once pg_cron is enabled and the dry-run count
-- above looks right to you.
-- SELECT cron.schedule('reap-anonymous-users', '0 3 * * *',
--                      $$SELECT reap_anonymous_users()$$);
