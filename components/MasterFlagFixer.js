// components/MasterFlagFixer.js
//
// Onboarding Step 2 — Verify Master Profile. Shows the user the STRUCTURED
// SKELETON the master build extracted (a clean timeline of companies, dates and
// roles) and lets them settle any open questions the deep analysis raised.
// Resolving a flag EDITS the canonical master via POST /api/resolve-flag.
//
//   - single flag  : the AI's proposed fix → Accept / Edit / Reject
//   - clarify flag : a recruiter red flag only the candidate can explain → quick
//                    options or free text
//   - structural   : a grouping question (are these one consultancy?) → free-text
//                    confirmation of a merge
//
// Each flag's actions are attached to the experience block it concerns, so the
// user sees the question in context. When there are 3+ open questions we offer a
// quicker path: "Do all suggested" applies every confident fix at once, or
// "Review one at a time" walks them in a focused, mobile-friendly wizard. When
// EVERY open question already has a confident suggestion (nothing needs typed
// input), a single "Yes to all suggested" CTA settles the whole record in one tap.
//
// Nothing here hard-blocks the user: the Continue button is always available.
// This component never deletes or fabricates anything — it only forwards the
// user's decision to the server, which mutates the master.

import { useState } from 'react';
import MasterProgressTracker from './MasterProgressTracker';

// How many open questions render at once. As answers collapse the cascade
// (utils/master-issues), the next-ranked ones surface into this window on their
// own — no pagination UI needed.
const OPEN_QUESTION_CAP = 4;

// A flag carries a "confident suggestion" when:
//   - single     : the AI proposed a concrete value (proposed_value) the user can
//                  accept blind. Index-stable (edits a field in place, never
//                  reorders experience[]), which is what makes a sequential bulk
//                  "accept all" safe.
//   - structural : utils/master-issues textually matched the stored analysis to a
//                  clear "delivered under"/"held separately" cue and set
//                  flag.suggestion to 'merge' | 'separate'.
//   - clarify    : utils/master-issues matched the analysis text to one of the
//                  deterministic reason options verbatim and set flag.suggestion
//                  to that option string.
// clarify/structural flags with NO matched suggestion still need the user's own
// knowledge and are never auto-applied.
function hasSuggestion(flag) {
  if (flag.type === 'single') return !!(flag.proposed_value && flag.proposed_value.trim());
  if (flag.type === 'structural' || flag.type === 'clarify') {
    return !!(flag.suggestion && String(flag.suggestion).trim());
  }
  return false;
}

// The { decision, value } body /api/resolve-flag needs to silently apply a
// flag's matched suggestion — mirrors exactly what the corresponding manual
// button in FlagCard sends.
function suggestionResolution(flag) {
  if (flag.type === 'single') return { decision: 'accept' };
  if (flag.type === 'structural') return { decision: flag.suggestion }; // 'merge' | 'separate'
  if (flag.type === 'clarify') return { decision: 'option', value: flag.suggestion };
  return null;
}

// Which experience[] block (if any) a flag concerns — used to slot its action
// card under the right row of the skeleton. identity/candidate_core fixes return
// null and render in a separate "Profile details" group.
function flagExpIndex(flag) {
  if (flag.type === 'structural') {
    const idxs = flag.merge?.child_indexes;
    return Array.isArray(idxs) && idxs.length ? idxs[0] : null;
  }
  if (flag.target?.section === 'experience' && typeof flag.target.index === 'number') {
    return flag.target.index;
  }
  return null;
}

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
      onResolved(flag.id, decision, data.master, data.flags);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="border border-amber-200 bg-amber-50/60 rounded-lg p-4">
      <p className="font-medium text-gray-800">{flag.question}</p>
      {flag.context && (
        <p className="mt-1 text-xs text-gray-500 italic">{flag.context}</p>
      )}

      {flag.type === 'single' && !editing && (
        <>
          {flag.proposed_value ? (
            <p className="mt-2 text-sm text-gray-600">
              Suggested: <span className="font-mono bg-white px-1 rounded border border-gray-200">{flag.proposed_value}</span>
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => send('accept')}
              className="px-3 py-1.5 text-sm rounded bg-green-600 text-white disabled:opacity-50">
              Accept
            </button>
            <button disabled={busy} onClick={() => setEditing(true)}
              className="px-3 py-1.5 text-sm rounded border border-gray-300 bg-white disabled:opacity-50">
              Edit
            </button>
            <button disabled={busy} onClick={() => send('reject')}
              className="px-3 py-1.5 text-sm rounded border border-gray-300 bg-white text-gray-600 disabled:opacity-50">
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
              className="px-3 py-1.5 text-sm rounded border border-gray-300 bg-white">
              Cancel
            </button>
          </div>
        </div>
      )}

      {flag.type === 'clarify' && (
        <div className="mt-3">
          {Array.isArray(flag.options) && flag.options.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {flag.options.map((opt) => (
                <button
                  key={opt}
                  disabled={busy}
                  onClick={() => send('option', opt)}
                  className="px-3 py-1.5 text-sm rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
          <div className="mt-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              placeholder="Or type your own answer"
            />
            <div className="mt-2 flex gap-2">
              <button disabled={busy || !draft.trim()} onClick={() => send('option', draft.trim())}
                className="px-3 py-1.5 text-sm rounded bg-green-600 text-white disabled:opacity-50">
                Save
              </button>
              <button disabled={busy} onClick={() => send('reject')}
                className="px-3 py-1.5 text-sm rounded border border-gray-300 bg-white text-gray-600 disabled:opacity-50">
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {flag.type === 'structural' && (
        <div className="mt-3">
          <div className="flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => send('merge', draft.trim())}
              className="px-3 py-1.5 text-sm rounded bg-green-600 text-white disabled:opacity-50">
              Group them under this
            </button>
            <button disabled={busy} onClick={() => send('separate', draft.trim())}
              className="px-3 py-1.5 text-sm rounded border border-gray-300 bg-white text-gray-600">
              No — separate roles
            </button>
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            className="mt-2 w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
            placeholder="Optional: in your own words — e.g. these were contracts under my consulting business"
          />
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

// One row of the structured skeleton: a single experience block, with any flag
// cards that concern it slotted directly underneath so the question reads in
// context. A clean block shows a quiet ✓; a flagged one shows an amber chip.
function SkeletonBlock({ entry, openFlags, doneFlags, onResolved }) {
  const role = entry?.role || '—';
  const company = entry?.company || '';
  const meta = [entry?.dates, entry?.location].filter(Boolean).join(' · ');
  const flagged = openFlags.length > 0;

  return (
    <li className={`rounded-lg border p-3 ${flagged ? 'border-amber-300 bg-amber-50/30' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-gray-800 truncate">
            {role}
            {company && <span className="text-gray-500 font-normal"> · {company}</span>}
          </p>
          {meta && <p className="text-xs text-gray-500 mt-0.5">{meta}</p>}
        </div>
        {flagged ? (
          <span className="shrink-0 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
            Needs a quick check
          </span>
        ) : (
          <span className="shrink-0 text-green-600" aria-label="Looks good">✓</span>
        )}
      </div>

      {openFlags.length > 0 && (
        <div className="mt-3 space-y-3">
          {openFlags.map((f) => (
            <FlagCard key={f.id} flag={f} onResolved={onResolved} />
          ))}
        </div>
      )}

      {doneFlags.length > 0 && (
        <ul className="mt-2 space-y-1">
          {doneFlags.map((f) => (
            <li key={f.id} className="text-xs text-green-700 flex items-center gap-1.5">
              <span>✓</span>
              <span className="line-through decoration-green-300">{f.question}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function MasterFlagFixer({ flags = [], experience = [], rebuilding = false, onComplete }) {
  // The LIVE open-issue list — recomputed server-side (utils/master-issues) after
  // every resolve and swapped in wholesale here. This is what makes the cascade
  // work: answering a structural overlap removes the short-tenure/gap questions
  // it was suppressing or made moot, because the server literally stops emitting
  // them — we just need to keep displaying whatever it hands back, not a snapshot
  // frozen at page load.
  const [flagList, setFlagList] = useState(Array.isArray(flags) ? flags : []);
  // Which flag ids the user personally answered (any decision, including
  // reject/skip) — drives the "done" section. A flag that disappears from
  // flagList WITHOUT the user answering it (a child question made moot by a
  // sibling's merge) is not in here, so it's simply gone, not shown as settled.
  const [resolved, setResolved] = useState({}); // id -> decision
  // Snapshots of the flags the user actually answered, in answer order — needed
  // because a settled flag drops out of flagList (the server never re-emits an
  // answered question), so the "done" UI can't read it from there any more.
  const [history, setHistory] = useState([]);
  const [exp, setExp] = useState(Array.isArray(experience) ? experience : []);
  const [mode, setMode] = useState('list'); // 'list' | 'wizard'
  const [wizardIdx, setWizardIdx] = useState(0);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState('');

  function handleResolved(id, decision, master, newFlags) {
    setResolved((r) => ({ ...r, [id]: decision }));
    setHistory((h) => {
      if (h.some((f) => f.id === id)) return h;
      const snapshot = flagList.find((f) => f.id === id) || flags.find((f) => f.id === id);
      return snapshot ? [...h, snapshot] : h;
    });
    if (master && Array.isArray(master.experience)) setExp(master.experience);
    if (Array.isArray(newFlags)) setFlagList(newFlags);
  }

  // Every currently-open question (server truth, minus anything the user already
  // answered this session), ranked overlap-first by the server. Only the top
  // OPEN_QUESTION_CAP are actually rendered — the rest surface on their own as
  // answers collapse the ones ahead of them.
  const openAll = flagList.filter((f) => !resolved[f.id]);
  const open = openAll.slice(0, OPEN_QUESTION_CAP);
  const done = history;
  const suggestedOpen = open.filter(hasSuggestion);
  const inputOpen = open.filter((f) => !hasSuggestion(f));

  // "Yes to all suggested" — the one-tap finish. Only when EVERY open question is
  // confidently auto-suggestible (nothing needs the user to type anything).
  const allSuggested = open.length > 0 && inputOpen.length === 0;

  // Apply every confident suggestion in sequence. Sequential (not parallel)
  // because each resolve-flag call reads-modifies-writes the whole master.
  // Single fixes are index-stable (never reorder experience[]); a structural
  // merge DOES reorder it, but each iteration re-fetches flagList/exp from the
  // server's response before the next call, so later indexes are always current.
  async function applyAllSuggested() {
    setBulkBusy(true);
    setBulkError('');
    try {
      for (const f of suggestedOpen) {
        const resolution = suggestionResolution(f);
        if (!resolution) continue;
        const res = await fetch('/api/resolve-flag', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ flag: f, ...resolution }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not save');
        setResolved((r) => ({ ...r, [f.id]: resolution.decision }));
        setHistory((h) => (h.some((x) => x.id === f.id) ? h : [...h, f]));
        if (data.master && Array.isArray(data.master.experience)) setExp(data.master.experience);
        if (Array.isArray(data.flags)) setFlagList(data.flags);
      }
    } catch (e) {
      setBulkError(e.message);
    }
    setBulkBusy(false);
  }

  function openWizard() {
    setWizardIdx(0);
    setMode('wizard');
  }

  // Map experience index -> { open, done } flags concerning that block. `done`
  // draws from `history` (snapshots), `open` from the capped, live list.
  const byBlock = new Map();
  const profileFlags = { open: [], done: [] };
  for (const f of open) {
    const idx = flagExpIndex(f);
    if (idx === null || idx < 0 || idx >= exp.length) {
      profileFlags.open.push(f);
      continue;
    }
    if (!byBlock.has(idx)) byBlock.set(idx, { open: [], done: [] });
    byBlock.get(idx).open.push(f);
  }
  for (const f of done) {
    const idx = flagExpIndex(f);
    if (idx === null || idx < 0 || idx >= exp.length) {
      profileFlags.done.push(f);
      continue;
    }
    if (!byBlock.has(idx)) byBlock.set(idx, { open: [], done: [] });
    byBlock.get(idx).done.push(f);
  }

  const states = { addcv: 'done', master: 'active', job: 'locked', create: 'locked' };

  // ---- Wizard mode: one focused question at a time ---------------------------
  if (mode === 'wizard') {
    // Recomputed every render from the live `open` list — never a frozen
    // snapshot — and clamped so an answer that collapses several later
    // questions can never leave the index pointing past the end.
    const total = open.length;
    const clampedIdx = total === 0 ? 0 : Math.max(0, Math.min(wizardIdx, total - 1));
    const current = open[clampedIdx];
    const idx = current ? flagExpIndex(current) : null;
    const ctx = current && idx !== null && idx >= 0 && idx < exp.length ? exp[idx] : null;

    return (
      <div>
        <MasterProgressTracker states={states} />

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Verify your master profile</h2>
          <button onClick={() => setMode('list')} className="text-sm text-blue-600 hover:underline">
            See full list
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Question {total === 0 ? 0 : clampedIdx + 1} of {total}
        </p>

        {current ? (
          <div>
            {ctx && (
              <div className="mb-3 text-sm text-gray-600">
                <span className="font-medium text-gray-800">{ctx.role || '—'}</span>
                {ctx.company ? ` · ${ctx.company}` : ''}
                {ctx.dates ? <span className="text-gray-500"> · {ctx.dates}</span> : null}
              </div>
            )}
            {/* `current` is always drawn from the live `open` list, so it is by
                definition not yet answered — resolving it removes it from `open`
                (and any question it made moot along with it) and the next
                question in rank order slides into this same clamped index. */}
            <FlagCard key={current.id} flag={current} onResolved={handleResolved} />

            <div className="mt-6 flex items-center justify-between">
              <button
                disabled={clampedIdx === 0}
                onClick={() => setWizardIdx((i) => Math.max(0, Math.min(i, total - 1) - 1))}
                className="px-4 py-2 text-sm rounded border border-gray-300 disabled:opacity-40"
              >
                Back
              </button>
              {clampedIdx < total - 1 ? (
                <button
                  onClick={() => setWizardIdx((i) => Math.min(total - 1, Math.min(i, total - 1) + 1))}
                  className="px-4 py-2 text-sm rounded bg-blue-600 text-white"
                >
                  Skip for now
                </button>
              ) : (
                <button
                  onClick={() => setMode('list')}
                  className="px-4 py-2 text-sm rounded bg-blue-600 text-white"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-green-700">All settled. <button onClick={() => setMode('list')} className="text-blue-600 hover:underline">Back to summary</button></p>
        )}
      </div>
    );
  }

  // ---- List mode: structured skeleton + bulk controls ------------------------
  return (
    <div>
      <MasterProgressTracker states={states} />

      <div className="mb-4">
        <h2 className="text-xl font-bold">Verify your master profile</h2>
        <p className="text-sm text-gray-600 mt-1">
          This is your private career record — not a CV we send anywhere. Here’s what we read
          from your CV. Settle the few open questions and every future CV is built from solid ground.
        </p>
      </div>

      {/* An EMPTY record is not a CLEAN one. With no experience at all there is
          nothing to have come through clean — saying so hid a failed build
          behind a reassuring green line. */}
      {rebuilding ? (
        <p className="text-sm text-blue-700 mb-3">
          Reading your CV — this takes up to a minute…
        </p>
      ) : exp.length === 0 ? (
        <p className="text-sm text-amber-700 mb-3">
          We couldn’t read your career record from your CV. Add your experience in the box
          below, or upload your CV again.
        </p>
      ) : openAll.length > 0 ? (
        <p className="text-sm text-gray-500 mb-3">
          {openAll.length} open {openAll.length === 1 ? 'question' : 'questions'} — your CVs are sharper once settled.
        </p>
      ) : (
        <p className="text-sm text-green-700 mb-3">
          Your record came through clean — nothing to settle. You’re ready to generate.
        </p>
      )}

      {/* Bulk helpers. "Yes to all suggested" finishes everything in one tap when
          nothing needs typed input. Otherwise, for 3+ questions we offer the
          batch-accept plus a focused one-at-a-time wizard. */}
      {open.length > 0 && (
        <div className="mb-5">
          {allSuggested ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                disabled={bulkBusy}
                onClick={applyAllSuggested}
                className="px-4 py-2 text-sm rounded bg-green-600 text-white font-medium disabled:opacity-50"
              >
                {bulkBusy ? 'Applying…' : `Yes to all suggested (${open.length})`}
              </button>
              {open.length >= 3 && (
                <button onClick={openWizard} className="text-sm text-blue-600 hover:underline">
                  or review one at a time
                </button>
              )}
            </div>
          ) : open.length >= 3 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-sm text-gray-700 mb-2">A few to settle — make it quick:</p>
              <div className="flex flex-wrap gap-2">
                {suggestedOpen.length > 0 && (
                  <button
                    disabled={bulkBusy}
                    onClick={applyAllSuggested}
                    className="px-4 py-2 text-sm rounded bg-green-600 text-white font-medium disabled:opacity-50"
                  >
                    {bulkBusy ? 'Applying…' : `Do all suggested (${suggestedOpen.length})`}
                  </button>
                )}
                <button onClick={openWizard} className="px-4 py-2 text-sm rounded border border-gray-300 bg-white">
                  Review one at a time
                </button>
              </div>
              {suggestedOpen.length > 0 && inputOpen.length > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  “Do all suggested” settles the {suggestedOpen.length} we can fix for you; you’ll
                  still answer the {inputOpen.length} only you can.
                </p>
              )}
            </div>
          ) : null}
          {bulkError && <p className="mt-2 text-sm text-red-600">{bulkError}</p>}
        </div>
      )}

      {/* The structured skeleton: a clean timeline of companies, dates and roles
          with each open question attached to the block it concerns. */}
      {exp.length > 0 && (
        <ul className="space-y-2">
          {exp.map((entry, i) => {
            const b = byBlock.get(i) || { open: [], done: [] };
            return (
              <SkeletonBlock
                key={i}
                entry={entry}
                openFlags={b.open}
                doneFlags={b.done}
                onResolved={handleResolved}
              />
            );
          })}
        </ul>
      )}

      {/* Profile-level questions (name / country / core) not tied to a single role. */}
      {(profileFlags.open.length > 0 || profileFlags.done.length > 0) && (
        <div className="mt-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Profile details</p>
          <div className="space-y-3">
            {profileFlags.open.map((f) => (
              <FlagCard key={f.id} flag={f} onResolved={handleResolved} />
            ))}
          </div>
          {profileFlags.done.length > 0 && (
            <ul className="mt-2 space-y-1">
              {profileFlags.done.map((f) => (
                <li key={f.id} className="text-xs text-green-700 flex items-center gap-1.5">
                  <span>✓</span>
                  <span className="line-through decoration-green-300">{f.question}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}


      <div className="mt-8">
        <button
          onClick={onComplete}
          className="px-5 py-2.5 rounded bg-blue-600 text-white font-medium"
        >
          {openAll.length > 0 ? `Continue (${openAll.length} left)` : 'Continue'}
        </button>
      </div>
    </div>
  );
}
