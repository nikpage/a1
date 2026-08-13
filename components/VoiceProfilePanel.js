// components/VoiceProfilePanel.js
//
// The voice profile, end to end: paste samples of your own writing, label each
// one, extract the profile, then REVIEW AND EDIT it.
//
// The review screen is not optional and not collapsible past the first visit —
// it is the difference between a tool and a black box. The user deletes the
// observations that are wrong and adds their own lines, and their lines outrank
// the extracted ones everywhere downstream.
//
// Two limits stated in the UI rather than buried:
//   - the CV is not a sample (bullet fragments carry no voice);
//   - the gain is in the cover letter, not the CV, where the constraint is
//     accuracy rather than personality.

import { useState } from 'react';
import { SAMPLE_LABELS } from '../prompts/voice-profile';

const LABEL_ORDER = ['application', 'work_doc', 'public', 'personal', 'other'];

// Registers far from business prose need most of List B translated, and the
// result is thinner. Say so instead of quietly producing a weaker letter.
const FAR_LABELS = new Set(['personal']);

const emptySample = () => ({ label: 'application', text: '' });

function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

export default function VoiceProfilePanel({ profile, onUpdated }) {
  const [samples, setSamples] = useState(
    Array.isArray(profile?.samples) && profile.samples.length
      ? profile.samples.map((s) => ({ label: s.label || 'other', text: s.text || '' }))
      : [emptySample()]
  );
  const [busy, setBusy] = useState('');      // '' | 'extract' | 'save'
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [showSamples, setShowSamples] = useState(!profile);

  // The editable review state. List A and the user's own lines are plain text —
  // one observation per line — because that is the shape a person can actually
  // edit. List B keeps its trait/translation pairing so the mapping stays visible.
  const [listA, setListA] = useState((profile?.list_a || []).join('\n'));
  const [listB, setListB] = useState(profile?.list_b || []);
  const [ownLines, setOwnLines] = useState(profile?.profile_text || '');
  const [cleanup, setCleanup] = useState(profile?.options?.cleanup === true);

  function loadProfile(p) {
    setListA((p?.list_a || []).join('\n'));
    setListB(p?.list_b || []);
    setOwnLines(p?.profile_text || '');
    setCleanup(p?.options?.cleanup === true);
    if (Array.isArray(p?.samples) && p.samples.length) {
      setSamples(p.samples.map((s) => ({ label: s.label || 'other', text: s.text || '' })));
    }
  }

  async function post(body) {
    const res = await fetch('/api/voice-profile', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  }

  async function extract() {
    setBusy('extract');
    setError('');
    setSaved(false);
    try {
      const data = await post({ action: 'extract', samples: samples.filter((s) => s.text.trim()) });
      loadProfile(data.profile);
      onUpdated?.(data.profile);
      setShowSamples(false);
    } catch (err) {
      setError(err.message);
    }
    setBusy('');
  }

  async function save() {
    setBusy('save');
    setError('');
    setSaved(false);
    try {
      const data = await post({
        action: 'save',
        profile: {
          list_a: listA.split('\n').map((l) => l.trim()).filter(Boolean),
          list_b: listB,
          confidence: profile?.confidence || '',
          profile_text: ownLines,
          options: { cleanup },
        },
      });
      loadProfile(data.profile);
      onUpdated?.(data.profile);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    }
    setBusy('');
  }

  const usable = samples.filter((s) => s.text.trim().length > 0);
  const thin = usable.length === 1;
  const allFar = usable.length > 0 && usable.every((s) => FAR_LABELS.has(s.label));
  const hasProfile = Boolean(profile?.list_a?.length || profile?.list_b?.length || profile?.profile_text);

  return (
    <div className="py-3">
      <div className="flex flex-wrap items-baseline gap-3">
        <div className="text-xs uppercase tracking-wide text-gray-500">How you write</div>
        <button
          onClick={() => setShowSamples((v) => !v)}
          className="text-xs text-blue-700 underline"
        >
          {showSamples ? 'Hide samples' : hasProfile ? 'Change samples' : 'Add samples'}
        </button>
        {saved && <span className="text-xs text-green-700">saved</span>}
      </div>

      <p className="mt-1 text-xs text-gray-600">
        Used for your <strong>cover letters</strong>. The CV won&apos;t show much voice — bullets are bullets, and
        the constraint there is accuracy, not personality.
      </p>

      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

      {/* ── Samples ──────────────────────────────────────────────────── */}
      {showSamples && (
        <div className="mt-3 rounded border border-gray-200 bg-gray-50 p-3">
          <p className="text-sm text-gray-700">
            Paste two to four pieces of your own writing, ideally 300+ words each. <strong>Not your CV</strong> —
            bullet fragments carry no voice.
          </p>

          {samples.map((s, i) => (
            <div key={i} className="mt-3 rounded border border-gray-200 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-gray-700">Sample {i + 1} — what is it?</span>
                {LABEL_ORDER.map((key) => (
                  <button
                    key={key}
                    onClick={() => setSamples(samples.map((x, j) => (j === i ? { ...x, label: key } : x)))}
                    className={`px-2 py-0.5 text-xs rounded-full border ${
                      s.label === key
                        ? 'border-blue-600 bg-blue-50 text-blue-800'
                        : 'border-gray-300 text-gray-600'
                    }`}
                  >
                    {SAMPLE_LABELS[key]}
                  </button>
                ))}
                {samples.length > 1 && (
                  <button
                    onClick={() => setSamples(samples.filter((_, j) => j !== i))}
                    className="ml-auto text-xs text-gray-500 underline"
                  >
                    Remove
                  </button>
                )}
              </div>
              <textarea
                value={s.text}
                onChange={(e) => setSamples(samples.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                rows={8}
                disabled={busy === 'extract'}
                className="mt-2 w-full border border-gray-300 rounded px-3 py-2 text-sm disabled:opacity-60"
                placeholder="Paste the whole thing…"
              />
              <div className="mt-1 text-xs text-gray-500">{wordCount(s.text)} words</div>
            </div>
          ))}

          {samples.length < 4 && (
            <button
              onClick={() => setSamples([...samples, emptySample()])}
              className="mt-3 text-sm text-blue-700 underline"
            >
              Add another sample
            </button>
          )}

          {thin && (
            <p className="mt-3 text-sm text-amber-800">
              One sample is enough to start, but the profile will be weaker — a single piece only shows one register.
            </p>
          )}
          {allFar && (
            <p className="mt-2 text-sm text-amber-800">
              These are all private-register writing, so most of it has to be translated for a letter. Expect a
              thinner result than a work email or a previous application would give.
            </p>
          )}

          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={extract}
              disabled={busy === 'extract' || usable.length === 0}
              className="px-4 py-2 text-sm rounded bg-blue-600 text-white font-medium disabled:opacity-50"
            >
              {busy === 'extract' ? 'Reading your writing…' : hasProfile ? 'Rebuild the profile' : 'Build my voice profile'}
            </button>
            {hasProfile && (
              <span className="text-xs text-gray-500">Your own added lines are kept.</span>
            )}
          </div>
        </div>
      )}

      {/* ── Review and edit ──────────────────────────────────────────── */}
      {hasProfile && (
        <div className="mt-4">
          <p className="text-sm text-gray-700">
            This is what your writing looks like from the outside. Delete anything wrong and add your own lines —
            yours win.
          </p>

          {profile?.confidence && (
            <p className="mt-2 text-xs italic text-gray-600">{profile.confidence}</p>
          )}

          <label className="mt-3 block text-sm">
            <span className="font-medium text-gray-800">How you write — applied directly</span>
            <span className="block text-xs text-gray-500">One observation per line.</span>
            <textarea
              value={listA}
              onChange={(e) => setListA(e.target.value)}
              rows={12}
              className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </label>

          {listB.length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-medium text-gray-800">
                Habits that don&apos;t travel to a letter — and what they become instead
              </div>
              <p className="text-xs text-gray-500">
                The right-hand side is what actually gets used. Edit it, or delete the row.
              </p>
              <div className="mt-2 space-y-2">
                {listB.map((b, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] items-start">
                    <input
                      value={b.trait}
                      onChange={(e) => setListB(listB.map((x, j) => (j === i ? { ...x, trait: e.target.value } : x)))}
                      className="border border-gray-200 bg-gray-50 rounded px-2 py-1.5 text-sm text-gray-600"
                    />
                    <input
                      value={b.translation}
                      onChange={(e) => setListB(listB.map((x, j) => (j === i ? { ...x, translation: e.target.value } : x)))}
                      className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                    />
                    <button
                      onClick={() => setListB(listB.filter((_, j) => j !== i))}
                      className="text-xs text-gray-500 underline pt-2"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <label className="mt-4 block text-sm">
            <span className="font-medium text-gray-800">Your own rules</span>
            <span className="block text-xs text-gray-500">
              Anything the samples missed. One per line, e.g. &ldquo;I never use exclamation marks.&rdquo; These
              outrank everything above.
            </span>
            <textarea
              value={ownLines}
              onChange={(e) => setOwnLines(e.target.value)}
              rows={5}
              maxLength={4000}
              className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </label>

          <label className="mt-3 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={cleanup}
              onChange={(e) => setCleanup(e.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="font-medium text-gray-800">Clean up my writing while keeping my voice</span>
              <span className="block text-xs text-gray-500">
                Fixes grammar and tangled sentences, keeps the cadence. Off by default.
              </span>
            </span>
          </label>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={save}
              disabled={busy === 'save'}
              className="px-4 py-2 text-sm rounded bg-blue-600 text-white font-medium disabled:opacity-50"
            >
              {busy === 'save' ? 'Saving…' : 'Save profile'}
            </button>
            {saved && <span className="text-sm text-green-700">saved</span>}
          </div>
        </div>
      )}
    </div>
  );
}
