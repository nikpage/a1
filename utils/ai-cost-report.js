// utils/ai-cost-report.js — turns the raw `transactions` AI-cost rows into the
// figures the /me cost panel shows. Pure functions over rows: no DB, no clock
// of its own (the caller passes `now`), so it is testable to the cent.
//
// Everything in the ledger is counted. A model bake-off run from a script, a
// chat-driven experiment, a validation retry whose output was thrown away and a
// call whose model had no rate are all AI expense, and a report that quietly
// drops any of them is the same blindness that hid four fifths of a day's bill.
//
// Boundaries are UTC. Google bills the Gemini API on calendar days and calendar
// months in UTC, so a report drawn on local days would not line up with the
// invoice it is meant to be checked against.

const DAY_MS = 86_400_000;

const iso = (d) => d.toISOString();
export const dayKey = (d) => new Date(d).toISOString().slice(0, 10);
export const monthKey = (d) => new Date(d).toISOString().slice(0, 7);

export function startOfDayUtc(d) {
  const t = new Date(d);
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
}

export function startOfMonthUtc(d, monthsBack = 0) {
  const t = new Date(d);
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - monthsBack, 1));
}

// The earliest row the report needs: the start of the billing period three
// periods before the current one.
export function reportSince(now) {
  return iso(startOfMonthUtc(now, 3));
}

// A bucket is { cost, calls, unpriced }. `unpriced` counts rows whose model had
// no rate — real money of an unknown size, reported separately and NEVER folded
// into the total as zero.
function emptyBucket(extra = {}) {
  return { cost: 0, calls: 0, unpriced: 0, ...extra };
}

function addRow(bucket, row) {
  bucket.calls += 1;
  if (row.amount_usd === null || row.amount_usd === undefined) bucket.unpriced += 1;
  else bucket.cost += Number(row.amount_usd);
  return bucket;
}

const rowCost = (row) => (row.amount_usd == null ? 0 : Number(row.amount_usd));

// What a row belongs to. A generation or analysis run stamps every call it makes
// with `source_gen_id`, so those group into one task. A row without one (an API
// route, a script, an experiment) is its own task — it was its own piece of
// spend and hiding it inside a synthetic group would misstate what a task costs.
function taskKey(row) {
  return row.source_gen_id || `single:${row.created_at}:${row.detail?.step || row.model}`;
}

// The most recent `limit` tasks, newest first, each totalled across its calls.
export function tasksFrom(rows, limit = 10) {
  const byKey = new Map();
  for (const row of rows) {
    const key = taskKey(row);
    if (!byKey.has(key)) {
      byKey.set(key, emptyBucket({
        id: key,
        run_id: row.source_gen_id || null,
        context: row.detail?.context || 'unattributed',
        type: row.detail?.type || null,
        user_id: row.user_id || null,
        started_at: row.created_at,
        ended_at: row.created_at,
        steps: [],
        models: [],
      }));
    }
    const task = byKey.get(key);
    addRow(task, row);
    if (row.created_at < task.started_at) task.started_at = row.created_at;
    if (row.created_at > task.ended_at) task.ended_at = row.created_at;
    task.steps.push({
      step: row.detail?.step || null,
      model: row.model,
      cost: rowCost(row),
      unpriced: row.amount_usd == null,
      at: row.created_at,
    });
    if (!task.models.includes(row.model)) task.models.push(row.model);
  }

  return [...byKey.values()]
    .sort((a, b) => (a.ended_at < b.ended_at ? 1 : -1))
    .slice(0, limit);
}

// Per-UTC-day totals for the `days` days ENDING YESTERDAY, plus today and
// yesterday named outright — yesterday is the last day Google has fully billed.
export function dailyFrom(rows, now, days = 7) {
  const buckets = new Map();
  const today = startOfDayUtc(now);
  for (let i = 0; i < days; i++) {
    buckets.set(dayKey(new Date(today.getTime() - i * DAY_MS)), emptyBucket());
  }
  for (const row of rows) {
    const bucket = buckets.get(dayKey(row.created_at));
    if (bucket) addRow(bucket, row);
  }
  return [...buckets.entries()].map(([day, b]) => ({ day, ...b }));
}

// The current calendar-month billing period plus the previous three.
export function periodsFrom(rows, now, count = 4) {
  const buckets = new Map();
  for (let i = 0; i < count; i++) {
    const start = startOfMonthUtc(now, i);
    buckets.set(monthKey(start), emptyBucket({ start: iso(start), current: i === 0 }));
  }
  for (const row of rows) {
    const bucket = buckets.get(monthKey(row.created_at));
    if (bucket) addRow(bucket, row);
  }
  return [...buckets.entries()].map(([period, b]) => ({ period, ...b }));
}

export function buildCostReport(rows, now = new Date()) {
  const daily = dailyFrom(rows, now, 7);
  const todayKey = dayKey(startOfDayUtc(now));
  const yesterdayKey = dayKey(new Date(startOfDayUtc(now).getTime() - DAY_MS));
  return {
    generated_at: iso(new Date(now)),
    tasks: tasksFrom(rows, 10),
    today: daily.find(d => d.day === todayKey) || { day: todayKey, ...emptyBucket() },
    yesterday: daily.find(d => d.day === yesterdayKey) || { day: yesterdayKey, ...emptyBucket() },
    daily,
    periods: periodsFrom(rows, now, 4),
  };
}
