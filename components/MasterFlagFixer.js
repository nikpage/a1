// components/MasterFlagFixer.js
//
// Onboarding Step 3 — the Flag Fixer. Renders the master_flags the deep analysis
// produced and lets the user settle each one. Resolving a flag EDITS the canonical
// master via POST /api/resolve-flag.
//
//   - single flag  : shows the AI's proposed fix → Accept / Reject / Edit
//   - structural   : states the question → free-text answer (confirms a merge)
//
// Nothing here hard-blocks the user: open flags show as a count, and the "Build
// my master" button is always available. Resolved flags collapse into a green
// checklist. This component does NOT delete or fabricate anything — it only
// forwards the user's decision to the server, which mutates the master.

import { useState } from 'react';
import MasterProgressTracker from './MasterProgressTracker';

function FlagCard({ flag, onResolved }) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(
    flag.type === 'single' ? (flag.proposed_value || '') : ''
  );
  const [error, setError] = useState('');

  async function send(decision, value) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/resolve-flag', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flag, decision, value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save');
      onResolved(flag.id, decision, data.master);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <p className="font-medium text-gray-800">{flag.question}</p>

      {flag.type === 'single' && !editing && (
        <>
          {flag.proposed_value ? (
            <p className="mt-2 text-sm text-gray-600">
              Suggested: <span className="font-mono bg-gray-50 px-1 rounded">{flag.proposed_value}</span>
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => send('accept')}
              className="px-3 py-1.5 text-sm rounded bg-green-600 text-white disabled:opacity-50">
              Accept
            </button>
            <button disabled={busy} onClick={() => setEditing(true)}
              className="px-3 py-1.5 text-sm rounded border border-gray-300 disabled:opacity-50">
              Edit
            </button>
            <button disabled={busy} onClick={() => send('reject')}
              className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-600 disabled:opacity-50">
              Reject (keep as is)
            </button>
          </div>
        </>
      )}

      {flag.type === 'single' && editing && (
        <div className="mt-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
            placeholder="Your correction"
          />
          <div className="mt-2 flex gap-2">
            <button disabled={busy || !draft.trim()} onClick={() => send('edit', draft.trim())}
              className="px-3 py-1.5 text-sm rounded bg-green-600 text-white disabled:opacity-50">
              Save
            </button>
            <button disabled={busy} onClick={() => setEditing(false)}
              className="px-3 py-1.5 text-sm rounded border border-gray-300">
              Cancel
            </button>
          </div>
        </div>
      )}

      {flag.type === 'structural' && (
        <div className="mt-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
            placeholder="In your own words — e.g. these were both contracts under my consulting business"
          />
          <div className="mt-2 flex gap-2">
            <button disabled={busy || !draft.trim()} onClick={() => send('merge', draft.trim())}
              className="px-3 py-1.5 text-sm rounded bg-green-600 text-white disabled:opacity-50">
              Apply
            </button>
            <button disabled={busy} onClick={() => send('reject')}
              className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-600">
              Leave as separate
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

export default function MasterFlagFixer({ flags = [], onComplete }) {
  const [resolved, setResolved] = useState({}); // id -> decision

  function handleResolved(id, decision) {
    setResolved((r) => ({ ...r, [id]: decision }));
  }

  const open = flags.filter((f) => !resolved[f.id]);
  const done = flags.filter((f) => resolved[f.id]);

  const states = {
    scan: 'done',
    standardize: 'done',
    flags: 'active',
    generate: 'locked',
  };

  return (
    <div>
      <MasterProgressTracker states={states} />

      <div className="mb-4">
        <h2 className="text-xl font-bold">Let’s make your record true and tight</h2>
        <p className="text-sm text-gray-600 mt-1">
          This is your private career record — not a CV we send anywhere. Settle these and every
          future CV is built from solid ground.
        </p>
      </div>

      {open.length > 0 ? (
        <p className="text-sm text-gray-500 mb-3">
          {open.length} open {open.length === 1 ? 'question' : 'questions'} — your CVs are sharper once settled.
        </p>
      ) : (
        <p className="text-sm text-green-700 mb-3">
          Your record came through clean — nothing to settle. You’re ready to generate.
        </p>
      )}

      <div className="space-y-3">
        {open.map((f) => (
          <FlagCard key={f.id} flag={f} onResolved={handleResolved} />
        ))}
      </div>

      {done.length > 0 && (
        <ul className="mt-5 space-y-1">
          {done.map((f) => (
            <li key={f.id} className="text-sm text-green-700 flex items-center gap-2">
              <span>✓</span>
              <span className="line-through decoration-green-300">{f.question}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8">
        <button
          onClick={onComplete}
          className="px-5 py-2.5 rounded bg-blue-600 text-white font-medium"
        >
          {open.length > 0 ? `Continue (${open.length} left)` : 'Continue'}
        </button>
      </div>
    </div>
  );
}
