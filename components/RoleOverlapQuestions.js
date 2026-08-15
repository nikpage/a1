// components/RoleOverlapQuestions.js
//
// The master build never nests. Where a role's dates fall inside the span of
// the person's own consultancy it reports the pair in `role_overlaps`, and this
// panel asks the one question the dates cannot answer: was that client work
// delivered under the practice, or a separate job held at the same time?
//
// The answer is applied by applyOverlapAnswer() (pure, in utils/master-schema)
// and written through the existing /api/update-master route — the same whole-
// record write path the editor uses, so there is no second way to save a master.

import { useState } from 'react';
import { applyOverlapAnswer } from '../utils/master-schema';
import { dateRange } from '../utils/master-read';

function describe(role) {
  const parts = [role?.title, role?.company].filter(Boolean).join(' at ');
  const dates = dateRange(role);
  return dates ? `${parts || 'this role'} (${dates})` : parts || 'this role';
}

export default function RoleOverlapQuestions({ master, onUpdated }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const experience = Array.isArray(master?.work_experience) ? master.work_experience : [];
  const overlaps = Array.isArray(master?.role_overlaps) ? master.role_overlaps : [];
  // Only unanswered questions whose indexes still point at real roles.
  const open = overlaps
    .map((o, i) => ({ ...o, i }))
    .filter((o) => !o.answer && experience[o.role_index] && experience[o.umbrella_index]);

  if (open.length === 0) return null;

  async function answer(questionIndex, value) {
    setSaving(true);
    setError('');
    try {
      const updated = applyOverlapAnswer(master, questionIndex, value);
      const res = await fetch('/api/update-master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ master: updated }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Could not save your answer');
      if (typeof onUpdated === 'function') onUpdated(data.master, data.flags);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="py-3">
      <div className="text-xs uppercase tracking-wide text-gray-500">Questions about your timeline</div>
      {open.map((o) => {
        const role = experience[o.role_index];
        const umbrella = experience[o.umbrella_index];
        return (
          <div key={o.i} className="mt-3 rounded border border-amber-200 bg-amber-50 p-3">
            <div className="text-sm text-gray-800">
              {describe(role)} ran while {umbrella.company || 'your own practice'} was active. Was it client
              work delivered under {umbrella.company || 'your own practice'}, or a separate job?
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => answer(o.i, 'nested')}
                className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50"
              >
                Client work under {umbrella.company || 'my practice'}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => answer(o.i, 'separate')}
                className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-800 disabled:opacity-50"
              >
                A separate job
              </button>
            </div>
          </div>
        );
      })}
      {error && <div className="mt-2 text-sm text-red-700">{error}</div>}
    </div>
  );
}
