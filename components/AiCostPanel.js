// components/AiCostPanel.js
//
// What Gemini is actually costing, read straight off the `transactions` ledger
// through /api/ai-costs.
//
// It shows ALL AI expense, not this session's: script runs, model bake-offs,
// chat-driven experiments, and retries that were billed and then discarded. A
// cost panel that showed only the tidy user-facing runs would repeat the exact
// blindness that let a day's bill run to five times what the app could account
// for.
//
// Days and billing periods are UTC, matching how Google bills the Gemini API, so
// a figure here can be checked against the invoice without adjusting anything.

import { useCallback, useEffect, useState } from 'react';

const usd = (n) => `$${Number(n || 0).toFixed(4)}`;

const timeOf = (iso) => (iso ? new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '');

// A task's label: the surface that spent the money, plus what it produced.
function taskLabel(task) {
  const bits = [task.context];
  if (task.type) bits.push(task.type);
  return bits.join(' · ');
}

function Unpriced({ count }) {
  if (!count) return null;
  return (
    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
      {count} unpriced
    </span>
  );
}

export default function AiCostPanel() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [openTask, setOpenTask] = useState(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/ai-costs', { method: 'GET', credentials: 'include' });
      if (!res.ok) throw new Error('Could not read AI costs');
      setReport(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // A generation run publishes this event when it finishes, so the newest task's
  // cost appears as soon as it is done rather than on the next page load.
  useEffect(() => {
    const onDone = () => load();
    window.addEventListener('ai-costs-updated', onDone);
    return () => window.removeEventListener('ai-costs-updated', onDone);
  }, [load]);

  const tasks = report?.tasks || [];
  const latest = tasks[0];

  return (
    <div className="py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">AI costs</h2>
        <button
          type="button"
          onClick={load}
          disabled={busy}
          className="text-xs text-gray-500 underline hover:text-gray-800 disabled:opacity-50"
        >
          {busy ? 'Reading ledger…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {report && (
        <>
          {/* Latest task, then today and yesterday. Yesterday is the last day
              Google has fully billed, which is why it is named outright. */}
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded border border-gray-200 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-gray-500">Latest task</div>
              <div className="text-lg font-semibold text-gray-900">{latest ? usd(latest.cost) : '—'}</div>
              <div className="text-xs text-gray-600">
                {latest ? `${taskLabel(latest)} · ${latest.calls} calls` : 'No AI calls recorded yet'}
                <Unpriced count={latest?.unpriced} />
              </div>
            </div>
            <div className="rounded border border-gray-200 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-gray-500">Today (UTC)</div>
              <div className="text-lg font-semibold text-gray-900">{usd(report.today.cost)}</div>
              <div className="text-xs text-gray-600">
                {report.today.calls} calls<Unpriced count={report.today.unpriced} />
              </div>
            </div>
            <div className="rounded border border-gray-200 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-gray-500">Yesterday ({report.yesterday.day})</div>
              <div className="text-lg font-semibold text-gray-900">{usd(report.yesterday.cost)}</div>
              <div className="text-xs text-gray-600">
                {report.yesterday.calls} calls<Unpriced count={report.yesterday.unpriced} />
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-5 lg:grid-cols-2">
            {/* Last 10 tasks */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Last 10 tasks</h3>
              <ul className="mt-2 divide-y divide-gray-100 border-t border-gray-100">
                {tasks.map((task) => (
                  <li key={task.id} className="py-1.5">
                    <button
                      type="button"
                      onClick={() => setOpenTask(openTask === task.id ? null : task.id)}
                      className="flex w-full items-baseline justify-between gap-3 text-left"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm text-gray-800">
                        {taskLabel(task)}
                        <span className="ml-2 text-xs text-gray-500">{timeOf(task.ended_at)}</span>
                      </span>
                      <span className="whitespace-nowrap text-sm font-medium text-gray-900">
                        {usd(task.cost)}
                        <span className="ml-1 text-xs font-normal text-gray-500">({task.calls})</span>
                        <Unpriced count={task.unpriced} />
                      </span>
                    </button>
                    {openTask === task.id && (
                      <ul className="mt-1 space-y-0.5 pl-3 text-xs text-gray-600">
                        {task.steps.map((s, i) => (
                          <li key={i} className="flex justify-between gap-3">
                            <span className="truncate">{s.step || '—'} · {s.model}</span>
                            <span className="whitespace-nowrap">{s.unpriced ? 'unpriced' : usd(s.cost)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
                {!tasks.length && <li className="py-2 text-sm text-gray-500">Nothing recorded yet.</li>}
              </ul>
            </div>

            {/* Days and billing periods */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Last 7 days (UTC)</h3>
              <ul className="mt-2 divide-y divide-gray-100 border-t border-gray-100">
                {report.daily.map((d) => (
                  <li key={d.day} className="flex items-baseline justify-between py-1.5 text-sm">
                    <span className="text-gray-800">{d.day}</span>
                    <span className="font-medium text-gray-900">
                      {usd(d.cost)}
                      <span className="ml-1 text-xs font-normal text-gray-500">({d.calls})</span>
                      <Unpriced count={d.unpriced} />
                    </span>
                  </li>
                ))}
              </ul>

              <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">Billing periods</h3>
              <ul className="mt-2 divide-y divide-gray-100 border-t border-gray-100">
                {report.periods.map((p) => (
                  <li key={p.period} className="flex items-baseline justify-between py-1.5 text-sm">
                    <span className="text-gray-800">
                      {p.period}{p.current && <span className="ml-2 text-xs text-gray-500">current</span>}
                    </span>
                    <span className="font-medium text-gray-900">
                      {usd(p.cost)}
                      <span className="ml-1 text-xs font-normal text-gray-500">({p.calls})</span>
                      <Unpriced count={p.unpriced} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-3 text-[11px] text-gray-500">
            Every metered Gemini call, app-wide — user runs, scripts, experiments and discarded retries.
            Priced from utils/pricing.js; “unpriced” marks calls whose model has no rate and whose real cost is not in these totals.
          </p>
        </>
      )}
    </div>
  );
}
