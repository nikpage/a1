// Tests for utils/ai-cost-report.js — the aggregation behind the /me cost panel.
//
// These assert on real money arithmetic over real row shapes: grouping a run's
// calls into one task, UTC day and calendar-month boundaries, and the two ways
// spend hides — a call with no rate (must never count as zero) and a call made
// outside a user run (a script, an experiment, a discarded retry).

import { describe, it, expect } from 'vitest';
import { buildCostReport, tasksFrom, dailyFrom, periodsFrom, reportSince } from '../utils/ai-cost-report.js';

const row = (created_at, amount_usd, extra = {}) => ({
  created_at,
  user_id: 'u1',
  source_gen_id: null,
  model: 'gemini-3.6-flash',
  amount_usd,
  cache_miss_tokens: 100,
  completion_tokens: 50,
  thinking_tokens: 10,
  detail: { context: 'generation', step: 'generate CV' },
  ...extra,
});

const NOW = new Date('2026-08-16T09:30:00.000Z');

describe('tasksFrom', () => {
  it('groups every call of one run into a single task and totals it', () => {
    const rows = [
      row('2026-08-16T08:00:00.000Z', '0.010000', { source_gen_id: 'gen-1', detail: { context: 'generation', type: 'both', step: 'generate CV' } }),
      row('2026-08-16T08:00:30.000Z', '0.020000', { source_gen_id: 'gen-1', detail: { context: 'generation', type: 'both', step: 'verify CV' } }),
      row('2026-08-16T08:01:00.000Z', '0.005000', { source_gen_id: 'gen-1', detail: { context: 'generation', type: 'both', step: 'generate CV (validation retry)' } }),
    ];
    const [task] = tasksFrom(rows);
    expect(task.run_id).toBe('gen-1');
    expect(task.calls).toBe(3);
    expect(task.cost).toBeCloseTo(0.035, 10);
    expect(task.type).toBe('both');
    expect(task.started_at).toBe('2026-08-16T08:00:00.000Z');
    expect(task.ended_at).toBe('2026-08-16T08:01:00.000Z');
    // The discarded retry is money spent and is listed, not swallowed.
    expect(task.steps.map(s => s.step)).toContain('generate CV (validation retry)');
  });

  it('keeps script and experiment calls as their own visible tasks', () => {
    const rows = [
      row('2026-08-16T07:00:00.000Z', '0.040000', { source_gen_id: null, detail: { context: 'script:test-generate', step: 'generate cover' } }),
      row('2026-08-16T07:05:00.000Z', '0.060000', { source_gen_id: null, detail: { context: 'script:minimal-cover', step: 'generate cover' } }),
    ];
    const tasks = tasksFrom(rows);
    expect(tasks).toHaveLength(2);
    expect(tasks.map(t => t.context)).toEqual(['script:minimal-cover', 'script:test-generate']);
    expect(tasks[0].cost).toBeCloseTo(0.06, 10);
  });

  it('returns the ten most recent tasks, newest first', () => {
    const rows = Array.from({ length: 14 }, (_, i) =>
      row(`2026-08-16T0${Math.floor(i / 10)}:${String(i % 10).padStart(2, '0')}:00.000Z`, '0.001000', { source_gen_id: `gen-${i}` })
    );
    const tasks = tasksFrom(rows, 10);
    expect(tasks).toHaveLength(10);
    expect(tasks[0].run_id).toBe('gen-13');
    expect(tasks[9].run_id).toBe('gen-4');
  });

  it('counts an unpriced call separately instead of totalling it as zero', () => {
    const rows = [
      row('2026-08-16T08:00:00.000Z', '0.010000', { source_gen_id: 'gen-1' }),
      row('2026-08-16T08:00:10.000Z', null, { source_gen_id: 'gen-1', model: 'gemini-9.9-unknown' }),
    ];
    const [task] = tasksFrom(rows);
    expect(task.cost).toBeCloseTo(0.01, 10);
    expect(task.unpriced).toBe(1);
    expect(task.calls).toBe(2);
  });
});

describe('dailyFrom', () => {
  it('buckets by UTC day, not local day', () => {
    const rows = [
      row('2026-08-15T23:59:59.000Z', '0.100000'),
      row('2026-08-16T00:00:01.000Z', '0.200000'),
    ];
    const daily = dailyFrom(rows, NOW, 7);
    expect(daily[0].day).toBe('2026-08-16');
    expect(daily[0].cost).toBeCloseTo(0.2, 10);
    expect(daily[1].day).toBe('2026-08-15');
    expect(daily[1].cost).toBeCloseTo(0.1, 10);
  });

  it('reports seven consecutive days, including ones with no spend', () => {
    const daily = dailyFrom([], NOW, 7);
    expect(daily.map(d => d.day)).toEqual([
      '2026-08-16', '2026-08-15', '2026-08-14', '2026-08-13', '2026-08-12', '2026-08-11', '2026-08-10',
    ]);
    expect(daily.every(d => d.cost === 0 && d.calls === 0)).toBe(true);
  });
});

describe('periodsFrom', () => {
  it('totals the current calendar month and the three before it', () => {
    const rows = [
      row('2026-08-01T00:00:00.000Z', '1.000000'),
      row('2026-08-16T09:00:00.000Z', '2.000000'),
      row('2026-07-31T23:59:59.000Z', '4.000000'),
      row('2026-05-02T00:00:00.000Z', '8.000000'),
      row('2026-04-30T00:00:00.000Z', '16.000000'), // outside the window
    ];
    const periods = periodsFrom(rows, NOW, 4);
    expect(periods.map(p => p.period)).toEqual(['2026-08', '2026-07', '2026-06', '2026-05']);
    expect(periods[0]).toMatchObject({ current: true, calls: 2 });
    expect(periods[0].cost).toBeCloseTo(3, 10);
    expect(periods[1].cost).toBeCloseTo(4, 10);
    expect(periods[2].cost).toBe(0);
    expect(periods[3].cost).toBeCloseTo(8, 10);
  });
});

describe('reportSince', () => {
  it('reaches back to the start of the oldest billing period shown', () => {
    expect(reportSince(NOW)).toBe('2026-05-01T00:00:00.000Z');
  });

  it('crosses a year boundary correctly', () => {
    expect(reportSince(new Date('2026-02-10T12:00:00.000Z'))).toBe('2025-11-01T00:00:00.000Z');
  });
});

describe('buildCostReport', () => {
  it('names today and yesterday and includes every context in the totals', () => {
    const rows = [
      row('2026-08-16T08:00:00.000Z', '0.010000', { source_gen_id: 'gen-1' }),
      row('2026-08-16T08:30:00.000Z', '0.030000', { detail: { context: 'script:test-generate', step: 'generate cover' } }),
      row('2026-08-15T10:00:00.000Z', '0.500000', { detail: { context: 'analyse-background', step: 'teaser' } }),
    ];
    const report = buildCostReport(rows, NOW);
    expect(report.today.day).toBe('2026-08-16');
    expect(report.today.cost).toBeCloseTo(0.04, 10);   // the script run is counted
    expect(report.today.calls).toBe(2);
    expect(report.yesterday.day).toBe('2026-08-15');
    expect(report.yesterday.cost).toBeCloseTo(0.5, 10);
    expect(report.tasks).toHaveLength(3);
    expect(report.periods[0].cost).toBeCloseTo(0.54, 10);
  });
});
