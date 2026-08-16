// utils/ai-meter.js — the ONE place an AI call is accounted for.
//
// Why this exists: on 2026-08-15 the day's bill came in at roughly five times
// what `transactions` could account for. Two separate defects produced that,
// and both were possible only because metering was OPT-IN AT THE CALLSITE:
//
//   1. Every caller in utils/openai.js had to remember two lines — one
//      `logAiTransaction()` for the durable row, one `trackDailySpend()` for the
//      guard. Sixteen callsites, hand-maintained. A new call that forgot either
//      was free as far as this app could see.
//   2. Both lines sat AFTER the response was parsed. Gemini bills the moment it
//      responds, so an unparseable payload, a discarded validation retry, or any
//      throw between the response and the logging line was money spent with no
//      row written and no counter moved.
//   3. Nothing ran the numbers for SCRIPTS. scripts/test-generate.mjs and the
//      model bake-offs call utils/openai.js directly and never touched either
//      line — every experiment was invisible spend by construction.
//
// So metering moved INTO callGemini, the single function every call passes
// through, and it happens the instant a response arrives — before parsing,
// before validation, before anything that can throw. A call cannot escape it
// without bypassing the HTTP client itself.
//
// Attribution rides in an AsyncLocalStorage context (`runWithAiContext`) set by
// the entry point — background function, API route, or script — so the meter
// knows who to bill without every intermediate function passing a user_id down.
//
// The day's spend is read from `transactions` in Supabase, NOT from Redis.
// Upstash is not reachable from the Next server runtime (see CLAUDE.md — the
// gen_lock has always failed open there), so a Redis-backed guard was blind on
// exactly the paths that spend the most. Supabase is reachable everywhere the
// app runs, and it is the same row the cost report reads, so the guard and the
// ledger can never disagree.

import { AsyncLocalStorage } from 'node:async_hooks';
import { costUsdFor } from './pricing.js';
// Loaded lazily, on the first call that actually needs the ledger. Importing
// utils/database.js at module load would drag a Supabase client into every
// process that so much as declares an AI context — including the test runner
// before its mocks are in place.
const db = () => import('./database.js');
import { logger } from '../lib/logger.js';

// There is NO daily ceiling. Owner decision (2026-08-16): the cap blocked real
// work — including the bake-off runs CLAUDE.md requires before any prompt or
// model change — and the thing that actually fixed the 5x day was making
// metering unconditional, not the ceiling on top of it. Metering stays; the
// ledger and scripts/ai-costs.mjs remain the way spend is seen.
//
// How long a spend total read from Supabase is trusted before re-reading. In
// between, locally metered calls are added to it, so the figure only ever
// UNDERSTATES concurrent spend by other runtimes for at most this long.
const TOTAL_TTL_MS = 60_000;

const store = new AsyncLocalStorage();

// Wrap an entry point so every AI call inside it is attributed. `context` is a
// free-text label that lands in the transaction row: 'analyse-background',
// 'api:voice-profile', 'script:test-generate', …
export function runWithAiContext(ctx, fn) {
  return store.run({ user_id: null, context: 'unattributed', source_gen_id: null, detail: {}, ...ctx }, fn);
}

// Next API route wrapper. Sits INSIDE requireAuth so `req.user` is already
// populated: `export default requireAuth(withAiContext('api:x', handler))`.
export function withAiContext(context, handler) {
  return (req, res) => runWithAiContext({ user_id: req.user?.user_id || null, context }, () => handler(req, res));
}

export function aiContext() {
  return store.getStore() || { user_id: null, context: 'unattributed', source_gen_id: null, detail: {} };
}

// FAIL CLOSED. A call with no context is a call nobody claimed, and an
// unclaimed call is exactly how spend goes invisible: it cannot be attributed
// to a user, a surface, or a script, so nobody knows it happened until the bill
// arrives. Rather than record it as "unattributed" and hope someone reads the
// log, the call is REFUSED. Declaring a context is one line; forgetting it now
// costs a crash instead of money.
export function assertAttributed(model) {
  if (store.getStore()) return;
  throw new AiContextError(model);
}

export class AiContextError extends Error {
  constructor(model) {
    super(
      `Refusing to call ${model}: no AI cost context. Every Gemini call must be attributed — ` +
      `wrap the entry point in runWithAiContext({ user_id, context }, fn), withAiContext('api:x', handler), ` +
      `or enterAiContext({ context: 'script:x' }) at the top of a script.`
    );
    this.name = 'AiContextError';
    this.code = 'no_ai_context';
    this.status = 500;
  }
}

// Enter a context for the REST of this process. For scripts, which have no
// request boundary to wrap: one line at the top and every call the script makes
// is attributed, counted and capped like any other.
export function enterAiContext(ctx) {
  store.enterWith({ user_id: null, context: 'unattributed', source_gen_id: null, detail: {}, ...ctx });
}

// Fill in attribution that is only known part-way through a run (a script that
// resolves its user after start). A no-op outside a context.
export function setAiContext(patch) {
  const ctx = store.getStore();
  if (ctx) Object.assign(ctx, patch);
}

// ---------------------------------------------------------------------------
// The day's spend

let cached = { day: null, total: 0, unpriced: 0, readAt: 0 };

const today = () => new Date().toISOString().slice(0, 10);

const readDayFromLedger = async (day) => (await db()).getAiSpendSince(`${day}T00:00:00.000Z`);

// Today's spend so far: { total, unpriced, stale }. `stale` is true when the
// ledger could not be read — the caller decides what to do with an unknown.
export async function dailySpend({ force = false } = {}) {
  const day = today();
  const fresh = cached.day === day && !force && Date.now() - cached.readAt < TOTAL_TTL_MS;
  if (fresh) return { total: cached.total, unpriced: cached.unpriced, stale: false };

  try {
    const { total, unpriced } = await readDayFromLedger(day);
    cached = { day, total, unpriced, readAt: Date.now() };
    return { total, unpriced, stale: false };
  } catch (e) {
    logger.error('[spend-guard] could not read today\'s spend:', e.message);
    // Keep whatever we last knew plus what this process has metered since.
    const total = cached.day === day ? cached.total : 0;
    return { total, unpriced: cached.day === day ? cached.unpriced : 0, stale: true };
  }
}

// Add locally metered spend to the cached figure so a burst inside one
// invocation is capped immediately, without waiting for the TTL to expire.
function addLocalSpend(costUsd) {
  const day = today();
  if (cached.day !== day) cached = { day, total: 0, unpriced: 0, readAt: Date.now() };
  if (Number.isFinite(costUsd)) cached.total += costUsd;
  else cached.unpriced += 1;
}

// An unpriced call is the one thing still worth shouting about: it means a
// model has no rate in utils/pricing.js, so the ledger UNDERSTATES the day.
// Nothing here blocks a call.
export async function reportUnpriced() {
  const { total, unpriced } = await dailySpend();
  if (unpriced > 0) {
    logger.error(`[spend] ${unpriced} call(s) today have no recorded rate — today's true spend is at least $${total.toFixed(4)}. Add the model to utils/pricing.js.`);
  }
}

// ---------------------------------------------------------------------------
// Recording a call

// Record one Gemini call: a durable `transactions` row plus the running day
// total. Takes the usage object geminiUsage() builds. Never throws — a metering
// failure must not fail the user's request — but every failure is logged at
// error level, because an unrecorded call is the whole defect this file exists
// to prevent.
export async function meterGeminiCall(usage) {
  const { label, model, inputTokens, outputTokens, thinkingTokens, costUsd } = usage;
  const ctx = aiContext();

  addLocalSpend(costUsd);

  try {
    const { logAiTransaction } = await db();
    await logAiTransaction({
      user_id: ctx.user_id,
      source_gen_id: ctx.source_gen_id,
      model,
      cache_hit_tokens: 0,
      cache_miss_tokens: inputTokens,
      completion_tokens: outputTokens + thinkingTokens,
      thinking_tokens: thinkingTokens,
      detail: { ...ctx.detail, context: ctx.context, step: label },
    });
  } catch (e) {
    // The call is already billed at Google. Losing the row is exactly the
    // failure mode that hid $4 of a $5 day, so it is shouted, with the numbers
    // needed to reconstruct the row by hand.
    logger.error(
      `[ai-meter] FAILED TO RECORD a billed call — model=${model} step=${label} context=${ctx.context} ` +
      `in=${inputTokens} out=${outputTokens} think=${thinkingTokens} cost=${costUsd === null ? 'UNPRICED' : '$' + costUsd.toFixed(6)}: ${e.message}`
    );
  }
}

// Priced total for a set of usages — used by scripts to print what a run cost.
export function totalCost(usages = []) {
  return usages.reduce((sum, u) => sum + (Number.isFinite(u?.costUsd) ? u.costUsd : 0), 0);
}

export { costUsdFor };
