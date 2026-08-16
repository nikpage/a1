-- 010_ai_cost_unpriced_rows.sql
--
-- A call whose model has no rate in utils/pricing.js must STILL leave a row.
-- That is the whole lesson of 2026-08-15: `logAiTransaction` used to return
-- without inserting when it could not price a call, and ~$4 of a ~$5 day
-- vanished from the ledger.
--
-- The code was fixed to insert the row with `amount_usd = NULL` — "this call
-- happened, at a price we do not know". But the column is NOT NULL, so the
-- database rejects exactly those rows and the hole is still open:
--
--   [ERROR] logAiTransaction: insert failed
--           null value in column "amount_usd" of relation "transactions"
--           violates not-null constraint
--
-- (Observed against the live table on 2026-08-16.)
--
-- NULL here means UNKNOWN, never zero. scripts/ai-costs.mjs counts these rows
-- separately and flags them, and the budget guard treats them as spend of an
-- unknown size rather than adding zero — so an unpriced model shows up as a
-- warning instead of quietly deflating the day's total.

ALTER TABLE transactions ALTER COLUMN amount_usd DROP NOT NULL;

COMMENT ON COLUMN transactions.amount_usd IS
  'USD cost of the call, priced from PRICING in utils/pricing.js. NULL = the model had no recorded rate; the call still happened and its price is unknown. Never interpret NULL as zero.';
