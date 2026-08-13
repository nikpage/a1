// components/VoiceGuidePanel.js
//
// The user writes their own `voice_guide` — how THEY write — and both generators
// read it for cadence, sentence shapes and vocabulary (prompts/cover-letter.js,
// prompts/cv-rules.js Layer 2). It never licenses a fact the record lacks.
//
// This is the only place the field can be set. Everything else about it is
// deliberately read-only so no AI pass can invent or reword it, which is exactly
// why the box had to exist: without it the field stayed null and the cover letter
// fell back to voice_samples — sentences copied out of the uploaded CV, i.e.
// corporate CV prose in a letter that is supposed to sound like a person.
//
// Saves through /api/update-voice-guide and hands the caller the saved master, so
// the page's copy of the record stays in step. Empty saves are a real clear.

import { useState } from 'react';

const PLACEHOLDER = `How do you actually write? Either describe it, or paste a few paragraphs of your own writing and let it speak for itself.

e.g. Short sentences. I open on the concrete thing, not the claim. No corporate throat-clearing — never "passionate about", never "proven track record". I say "built" and "shipped", not "spearheaded". I'd rather sound blunt than polished.`;

export default function VoiceGuidePanel({ voiceGuide = '', onUpdated }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(voiceGuide || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  function startEditing() {
    setDraft(voiceGuide || '');
    setError('');
    setSaved(false);
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch('/api/update-voice-guide', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice_guide: draft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save your writing guide');
      onUpdated?.(data.master);
      setSaved(true);
      setOpen(false);
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  return (
    <div className="py-3">
      <div className="flex items-baseline gap-3">
        <div className="text-xs uppercase tracking-wide text-gray-500">How you write</div>
        {!open && (
          <button onClick={startEditing} className="text-xs text-blue-700 underline">
            {voiceGuide ? 'Edit' : 'Add'}
          </button>
        )}
        {saved && !open && <span className="text-xs text-green-700">saved</span>}
      </div>

      {open ? (
        <>
          <p className="mt-2 text-xs text-gray-600">
            Used for voice only — cadence, sentence shapes, vocabulary. It never changes a fact,
            and it cannot loosen the CV rules.
          </p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={10}
            maxLength={4000}
            disabled={saving}
            className="mt-2 w-full border border-gray-300 rounded px-3 py-2 text-sm disabled:opacity-60"
            placeholder={PLACEHOLDER}
          />
          <div className="mt-2 flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white font-medium disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => { setOpen(false); setError(''); }}
              disabled={saving}
              className="text-sm text-gray-600 underline"
            >
              Cancel
            </button>
            <span className="ml-auto text-xs text-gray-500">{draft.length}/4000</span>
          </div>
          {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
        </>
      ) : voiceGuide ? (
        <div className="mt-1 text-sm text-gray-800 whitespace-pre-wrap">{voiceGuide}</div>
      ) : (
        <p className="mt-1 text-sm text-gray-500">
          Not set — cover letters are falling back to sentences copied from your CV, which is why
          they read like a CV.
        </p>
      )}
    </div>
  );
}
