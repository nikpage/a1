-- 008_top_up_generations.sql
-- Apply manually in the Supabase SQL editor (after 004).
--
-- Refills the free generation allowance after a successful download. This must
-- only ever RAISE the balance: greatest(generations_left, amount). The old
-- read-modify-write SET destroyed generations a user had already been granted.
--
-- Argument names must stay `user_id` / `amount` — Supabase RPC passes named
-- args and `topUpFreeGenerations()` in utils/database.js calls it with exactly
-- those keys. The parameter `user_id` collides with the `users.user_id` column,
-- so the WHERE clause qualifies the column (`users.user_id`) and the parameter
-- is referenced via the function alias (`top_up_generations.user_id`);
-- otherwise the predicate would be column = column and update EVERY row.
--
-- Returns: void

CREATE OR REPLACE FUNCTION top_up_generations(user_id text, amount integer)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE users
     SET generations_left = greatest(users.generations_left, top_up_generations.amount)
   WHERE users.user_id = top_up_generations.user_id;
END;
$$;
