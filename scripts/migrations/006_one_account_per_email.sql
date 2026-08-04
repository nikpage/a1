-- 006_one_account_per_email.sql
--
-- Enforce ONE account per email address at the database level.
--
-- Until now nothing stopped two users rows carrying the same email: signup
-- looked the address up first, but a race (or any code path that wrote email
-- directly) could still create a second one. getUserByEmail papers over it by
-- returning the OLDEST row, so the newer duplicates are already dead weight —
-- no tokens are spent from them and no history is read out of them.
--
-- Step 1 makes the data consistent with that existing oldest-wins rule by
-- clearing the email off the newer duplicates. NOTHING IS DELETED: the rows and
-- all their data survive, they simply stop competing for the address. Run the
-- SELECT below first if you want to see exactly what will be touched.
--
--   SELECT email, count(*), array_agg(user_id ORDER BY created_at)
--   FROM users WHERE email IS NOT NULL GROUP BY email HAVING count(*) > 1;
--
-- Step 2 adds the unique index. It is partial (email IS NOT NULL) because
-- anonymous upload sessions legitimately have no email yet, and lower(email)
-- so Nik@x.com and nik@x.com cannot both exist. Application code normalises to
-- lowercase on write; this is the backstop.

BEGIN;

-- Step 1 — retire duplicate emails, oldest row keeps the address.
UPDATE users u
SET email = NULL
WHERE u.email IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM users older
    WHERE lower(older.email) = lower(u.email)
      AND (older.created_at, older.user_id) < (u.created_at, u.user_id)
  );

-- Step 2 — one account per email, enforced by the database from here on.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique
  ON users (lower(email))
  WHERE email IS NOT NULL;

COMMIT;
