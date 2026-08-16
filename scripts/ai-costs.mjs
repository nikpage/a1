// scripts/ai-costs.mjs
//
// What the AI actually cost, straight out of the `transactions` ledger — the
// same rows the budget guard reads, so the report and the guard can never
// disagree.
//
//   doppler run -- node scripts/ai-costs.mjs [--days 7] [--by model|context|step|user]
//
// Every row is a call that Gemini billed for: the meter in utils/ai-meter.js
// writes it the moment a response arrives, before any parsing, so failed
// parses, discarded validation retries and script experiments are all in here.
// A row with a NULL amount is a call whose model has no rate in
// utils/pricing.js — real spend of an unknown size, reported separately and
// never counted as zero.

import { createClient } from '@supabase/supabase-js';

const argOf = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : (process.argv[i + 1] ?? fallback);
};

const days = parseInt(argOf('days', '7'), 10);
const groupBy = argOf('by', 'model');
const GROUPS = { model: (r) => r.model || '(no model)', context: (r) => r.detail?.context || '(unattributed)', step: (r) => r.detail?.step || r.detail?.type || '(no step)', user: (r) => r.user_id || '(no user)' };
if (!GROUPS[groupBy]) {
  console.error(`--by must be one of: ${Object.keys(GROUPS).join(', ')}`);
  process.exit(1);
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const since = new Date(Date.now() - days * 86400000).toISOString();
const { data, error } = await sb
  .from('transactions')
  .select('created_at, user_id, model, amount_usd, cache_miss_tokens, completion_tokens, thinking_tokens, detail')
  .eq('type', 'ai_cost')
  .gte('created_at', since)
  .order('created_at', { ascending: true });

if (error) {
  console.error(error.message);
  process.exit(1);
}

const money = (n) => `$${n.toFixed(4)}`;
const key = GROUPS[groupBy];

const byDay = new Map();
for (const row of data || []) {
  const day = row.created_at.slice(0, 10);
  if (!byDay.has(day)) byDay.set(day, { total: 0, calls: 0, unpriced: 0, groups: new Map() });
  const d = byDay.get(day);
  const amount = row.amount_usd === null ? null : Number(row.amount_usd);

  d.calls += 1;
  if (amount === null) d.unpriced += 1;
  else d.total += amount;

  const k = key(row);
  if (!d.groups.has(k)) d.groups.set(k, { total: 0, calls: 0, unpriced: 0, inTok: 0, outTok: 0 });
  const g = d.groups.get(k);
  g.calls += 1;
  if (amount === null) g.unpriced += 1;
  else g.total += amount;
  g.inTok += row.cache_miss_tokens || 0;
  g.outTok += row.completion_tokens || 0;
}

let grand = 0;
let grandUnpriced = 0;

for (const [day, d] of [...byDay.entries()].sort()) {
  grand += d.total;
  grandUnpriced += d.unpriced;
  console.log(`\n${day}   ${money(d.total)}   ${d.calls} calls${d.unpriced ? `   ⚠ ${d.unpriced} UNPRICED` : ''}`);
  const rows = [...d.groups.entries()].sort((a, b) => b[1].total - a[1].total);
  for (const [k, g] of rows) {
    console.log(
      `    ${k.padEnd(34)} ${money(g.total).padStart(10)}  ${String(g.calls).padStart(4)} calls  ` +
      `in=${g.inTok.toLocaleString().padStart(9)} out=${g.outTok.toLocaleString().padStart(8)}` +
      (g.unpriced ? `  ⚠ ${g.unpriced} unpriced` : '')
    );
  }
}

console.log(`\n${'─'.repeat(72)}`);
console.log(`${days}-day total: ${money(grand)} over ${(data || []).length} calls, grouped by ${groupBy}`);
if (grandUnpriced) {
  console.log(`⚠ ${grandUnpriced} call(s) have NO recorded rate — the true total is higher than this.`);
  console.log('  Add the missing model to utils/pricing.js; the models involved:');
  const models = new Set((data || []).filter((r) => r.amount_usd === null).map((r) => r.model));
  for (const m of models) console.log(`    ${m}`);
}
console.log(`Daily budget: $${process.env.GEMINI_DAILY_BUDGET_USD || '10'} (GEMINI_DAILY_BUDGET_USD). Calls are BLOCKED once a day reaches it.`);
