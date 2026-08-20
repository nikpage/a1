// components/AddInfoPanel.js
//
// "Anything not on your CV?" — one free-text box the user can type into in their
// own words. POST /api/master-add-info folds it into their canonical master CV,
// so it reaches every CV and cover letter generated from then on.
//
// Two outcomes:
//   - saved     → a plain-English list of what was added ("Added Acme — Contractor, 2023")
//   - questions → the AI could not place the fact; 1-2 short answer fields appear
//                 and the same text is resubmitted WITH the answers. Nothing was
//                 saved on that first round, so re-sending is not a double-write.
//
// Rendered both inside onboarding (MasterFlagFixer) and on the user page after
// onboarding, so the record can be topped up at any time.

import { useEffect, useState } from 'react';
import { logGemini } from '../utils/log-gemini.js';

// `seed` is a starting draft the page hands in — today, the capabilities the
// analysis reported as missing that the user says they DO have. It is a draft on
// purpose: the user finishes the sentence in their own words, so what reaches
// the record is the evidence, not a bare keyword the model would have to invent
// a story around.
export default function AddInfoPanel({ onUpdated, seed = '' }) {
  const [text, setText] = useState('');
  useEffect(() => { if (seed) setText(seed); }, [seed]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState([]);   // strings the AI needs answered
  const [answers, setAnswers] = useState({});       // question -> answer
  const [changes, setChanges] = useState([]);       // plain-English "what was added"

  const answered = questions.filter((q) => (answers[q] || '').trim());
  const canSubmit = text.trim().length >= 10 && (questions.length === 0 || answered.length === questions.length);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const body = {
        text: text.trim(),
        answers: questions.map((q) => ({ question: q, answer: (answers[q] || '').trim() })),
      };
      const res = await fetch('/api/master-add-info', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not add that');

      if (data._gemini_usage) logGemini(data._gemini_usage);

      if (data.ok === false && Array.isArray(data.questions) && data.questions.length) {
        // Not saved — the AI needs these answered before it can place the fact.
        setQuestions(data.questions);
        setChanges([]);
        setBusy(false);
        return;
      }

      setChanges(Array.isArray(data.changes) && data.changes.length ? data.changes : ['Added to your record.']);
      setQuestions([]);
      setAnswers({});
      setText('');
      if (onUpdated) onUpdated(data.master, data.flags);
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="font-medium text-gray-800">Anything not on your CV?</p>
      <p className="mt-1 text-sm text-gray-600">
        Contract work, a project, a course, a result you never wrote down. Type it however you
        like — we’ll file it in the right place.
      </p>

      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setChanges([]); }}
        rows={3}
        maxLength={4000}
        disabled={busy}
        className="mt-3 w-full border border-gray-300 rounded px-2 py-1.5 text-sm disabled:opacity-60"
        placeholder="e.g. I also did six months contracting at Acme in 2023, rebuilt their checkout and cut drop-off by 20%"
      />

      {questions.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
          <p className="text-sm text-gray-700">Just one thing before we file it:</p>
          <div className="mt-2 space-y-2">
            {questions.map((q) => (
              <div key={q}>
                <label className="block text-sm text-gray-800">{q}</label>
                <input
                  value={answers[q] || ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q]: e.target.value }))}
                  disabled={busy}
                  className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm disabled:opacity-60"
                  placeholder="Your answer"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center gap-3">
        <button
          disabled={busy || !canSubmit}
          onClick={submit}
          className="px-4 py-2 text-sm rounded bg-blue-600 text-white font-medium disabled:opacity-50"
        >
          {busy ? 'Adding…' : questions.length > 0 ? 'Save answers' : 'Add to my CV'}
        </button>
        {busy && <span className="text-xs text-gray-500">Filing it into your record…</span>}
      </div>

      {changes.length > 0 && (
        <ul className="mt-3 space-y-1">
          {changes.map((c, i) => (
            <li key={i} className="text-sm text-green-700 flex items-start gap-1.5">
              <span>✓</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
