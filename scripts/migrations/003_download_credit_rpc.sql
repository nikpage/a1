-- 003_download_credit_rpc.sql
-- Apply manually in the Supabase SQL editor (after 002).
--
-- Atomic download-credit consumption: spend a free download first (card-on-file
-- grant), otherwise spend a paid token. Single-statement updates keep it race-safe
-- without a read-modify-write, per the project's token-mutation rule.
--
-- Returns: 'free'  -> a free_downloads_left credit was used
--          'token' -> a paid token was used
--          'none'  -> nothing available (caller must block the download)

CREATE OR REPLACE FUNCTION consume_download_credit(p_user_id text)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE users
     SET free_downloads_left = free_downloads_left - 1
   WHERE user_id = p_user_id
     AND free_downloads_left > 0;
  IF FOUND THEN
    RETURN 'free';
  END IF;

  UPDATE users
     SET tokens = tokens - 1
   WHERE user_id = p_user_id
     AND tokens > 0;
  IF FOUND THEN
    RETURN 'token';
  END IF;

  RETURN 'none';
END;
$$;
