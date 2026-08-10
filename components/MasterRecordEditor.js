// components/MasterRecordEditor.js
//
// Direct editing of the master record — the record every CV and cover letter is
// written from. The flag fixer resolves one flagged question at a time and
// add-info only ever ADDS, so until this existed a wrong date, an unwanted role
// or clumsy achievement wording could not be fixed at all.
//
// Edits are local until Save; Save POSTs the whole record to /api/update-master,
// which normalises it onto the schema and writes it. voice_samples and conflicts
// are not editable here — the first are code-grounded verbatim quotes, the
// second belong to the flag fixer — and the route carries both over untouched.

import { useState } from 'react';

const inputClass = 'w-full rounded border border-gray-300 px-2 py-1 text-sm';
const labelClass = 'text-xs uppercase tracking-wide text-gray-500';

// Replace one item of an array without mutating it.
function replaceAt(list, index, value) {
  return list.map((item, i) => (i === index ? value : item));
}

function TextRow({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <input
        className={inputClass}
        value={value || ''}
        placeholder={placeholder || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

// A list of plain strings (parallel_experience, gaps, links, tags, skills).
function StringList({ label, items, onChange }) {
  const list = Array.isArray(items) ? items : [];
  return (
    <div>
      <span className={labelClass}>{label}</span>
      {list.map((value, i) => (
        <div key={i} className="mt-1 flex gap-2">
          <input
            className={inputClass}
            value={value}
            onChange={(e) => onChange(replaceAt(list, i, e.target.value))}
          />
          <button
            type="button"
            className="text-xs text-red-700 shrink-0"
            onClick={() => onChange(list.filter((_, j) => j !== i))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="mt-1 text-xs text-blue-700 underline"
        onClick={() => onChange([...list, ''])}
      >
        + Add
      </button>
    </div>
  );
}

function RoleEditor({ role, onChange, onRemove }) {
  const achievements = Array.isArray(role.achievements) ? role.achievements : [];
  const set = (patch) => onChange({ ...role, ...patch });

  return (
    <div className="mt-4 rounded border border-gray-200 p-3">
      <div className="grid grid-cols-2 gap-2">
        <TextRow label="Role" value={role.role} onChange={(v) => set({ role: v })} />
        <TextRow label="Company" value={role.company} onChange={(v) => set({ company: v })} />
        <TextRow label="Dates" value={role.dates} onChange={(v) => set({ dates: v })} placeholder="2018 - Present" />
        <TextRow label="Location" value={role.location} onChange={(v) => set({ location: v })} placeholder="Prague, Czech Republic" />
      </div>

      <div className="mt-3">
        <span className={labelClass}>Achievements</span>
        {achievements.map((a, i) => (
          <div key={i} className="mt-2 flex gap-2">
            <div className="flex-1 space-y-1">
              <textarea
                className={inputClass}
                rows={2}
                value={a.text || ''}
                onChange={(e) => set({ achievements: replaceAt(achievements, i, { ...a, text: e.target.value }) })}
              />
              <input
                className={inputClass}
                value={a.metric || ''}
                placeholder="Metric, only if it's real (e.g. cut drop-off 20%)"
                onChange={(e) => set({ achievements: replaceAt(achievements, i, { ...a, metric: e.target.value }) })}
              />
            </div>
            <button
              type="button"
              className="text-xs text-red-700 shrink-0"
              onClick={() => set({ achievements: achievements.filter((_, j) => j !== i) })}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="mt-2 text-xs text-blue-700 underline"
          onClick={() => set({ achievements: [...achievements, { text: '', metric: '', skills_utilized: [] }] })}
        >
          + Add achievement
        </button>
      </div>

      {Array.isArray(role.contracts) && role.contracts.length > 0 && (
        // Nested engagements of a merged role: shown so the user can see what is
        // under it, edited through the flag fixer that created the merge.
        <div className="mt-3 text-xs text-gray-500">
          Contains {role.contracts.length} nested engagement{role.contracts.length === 1 ? '' : 's'} (edit via the questions panel).
        </div>
      )}

      <button type="button" className="mt-3 text-xs text-red-700" onClick={onRemove}>
        Remove this role
      </button>
    </div>
  );
}

export default function MasterRecordEditor({ master, onSaved, onCancel }) {
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(master)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const identity = draft.identity || {};
  const contact = identity.contact || {};
  const experience = Array.isArray(draft.experience) ? draft.experience : [];
  const education = Array.isArray(draft.education) ? draft.education : [];
  const certifications = Array.isArray(draft.certifications) ? draft.certifications : [];
  const notes = Array.isArray(draft.transferable_notes) ? draft.transferable_notes : [];

  const setIdentity = (patch) => setDraft({ ...draft, identity: { ...identity, ...patch } });
  const setContact = (patch) => setIdentity({ contact: { ...contact, ...patch } });

  async function save() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/update-master', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ master: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save your record');
      if (typeof onSaved === 'function') onSaved(data.master, data.flags);
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  return (
    <div>
      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <TextRow label="Name" value={identity.name} onChange={(v) => setIdentity({ name: v })} />
        <TextRow label="Country" value={identity.country} onChange={(v) => setIdentity({ country: v })} />
        <TextRow label="Email" value={contact.email} onChange={(v) => setContact({ email: v })} />
        <TextRow label="Phone" value={contact.phone} onChange={(v) => setContact({ phone: v })} />
        <TextRow label="Location" value={contact.location} onChange={(v) => setContact({ location: v })} />
      </div>

      <div className="mt-3">
        <StringList label="Links" items={contact.links} onChange={(links) => setContact({ links })} />
      </div>

      <label className="mt-4 block">
        <span className={labelClass}>Core (the durable through-line)</span>
        <textarea
          className={inputClass}
          rows={3}
          value={draft.candidate_core || ''}
          onChange={(e) => setDraft({ ...draft, candidate_core: e.target.value })}
        />
      </label>

      <div className="mt-5">
        <span className={labelClass}>Experience</span>
        {experience.map((role, i) => (
          <RoleEditor
            key={i}
            role={role}
            onChange={(updated) => setDraft({ ...draft, experience: replaceAt(experience, i, updated) })}
            onRemove={() => setDraft({ ...draft, experience: experience.filter((_, j) => j !== i) })}
          />
        ))}
        <button
          type="button"
          className="mt-3 text-xs text-blue-700 underline"
          onClick={() =>
            setDraft({
              ...draft,
              experience: [{ company: '', role: '', dates: '', location: '', core_tags: [], achievements: [] }, ...experience],
            })
          }
        >
          + Add a role
        </button>
      </div>

      <div className="mt-5">
        <span className={labelClass}>Education</span>
        {education.map((e, i) => (
          <div key={i} className="mt-2 grid grid-cols-2 gap-2 rounded border border-gray-200 p-3">
            <TextRow label="Qualification" value={e.qualification} onChange={(v) => setDraft({ ...draft, education: replaceAt(education, i, { ...e, qualification: v }) })} />
            <TextRow label="Institution" value={e.institution} onChange={(v) => setDraft({ ...draft, education: replaceAt(education, i, { ...e, institution: v }) })} />
            <TextRow label="Dates" value={e.dates} onChange={(v) => setDraft({ ...draft, education: replaceAt(education, i, { ...e, dates: v }) })} />
            <TextRow label="Notes" value={e.notes} onChange={(v) => setDraft({ ...draft, education: replaceAt(education, i, { ...e, notes: v }) })} />
            <button type="button" className="text-xs text-red-700 justify-self-start" onClick={() => setDraft({ ...draft, education: education.filter((_, j) => j !== i) })}>
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="mt-2 text-xs text-blue-700 underline"
          onClick={() => setDraft({ ...draft, education: [...education, { institution: '', qualification: '', dates: '', notes: '' }] })}
        >
          + Add education
        </button>
      </div>

      <div className="mt-5">
        <span className={labelClass}>Certifications</span>
        {certifications.map((c, i) => (
          <div key={i} className="mt-2 grid grid-cols-3 gap-2 rounded border border-gray-200 p-3">
            <TextRow label="Name" value={c.name} onChange={(v) => setDraft({ ...draft, certifications: replaceAt(certifications, i, { ...c, name: v }) })} />
            <TextRow label="Issuer" value={c.issuer} onChange={(v) => setDraft({ ...draft, certifications: replaceAt(certifications, i, { ...c, issuer: v }) })} />
            <TextRow label="Date" value={c.date} onChange={(v) => setDraft({ ...draft, certifications: replaceAt(certifications, i, { ...c, date: v }) })} />
            <button type="button" className="text-xs text-red-700 justify-self-start" onClick={() => setDraft({ ...draft, certifications: certifications.filter((_, j) => j !== i) })}>
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="mt-2 text-xs text-blue-700 underline"
          onClick={() => setDraft({ ...draft, certifications: [...certifications, { name: '', issuer: '', date: '' }] })}
        >
          + Add certification
        </button>
      </div>

      <div className="mt-5">
        <StringList
          label="Alongside work (side projects, teaching, volunteering)"
          items={draft.parallel_experience}
          onChange={(parallel_experience) => setDraft({ ...draft, parallel_experience })}
        />
      </div>

      <div className="mt-5">
        <span className={labelClass}>Transferable strengths</span>
        {notes.map((n, i) => (
          <div key={i} className="mt-2 grid grid-cols-2 gap-2 rounded border border-gray-200 p-3">
            <TextRow label="Observation" value={n.observation} onChange={(v) => setDraft({ ...draft, transferable_notes: replaceAt(notes, i, { ...n, observation: v }) })} />
            <TextRow label="Evidence" value={n.evidence} onChange={(v) => setDraft({ ...draft, transferable_notes: replaceAt(notes, i, { ...n, evidence: v }) })} />
            <button type="button" className="text-xs text-red-700 justify-self-start" onClick={() => setDraft({ ...draft, transferable_notes: notes.filter((_, j) => j !== i) })}>
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="mt-2 text-xs text-blue-700 underline"
          onClick={() => setDraft({ ...draft, transferable_notes: [...notes, { observation: '', evidence: '', useful_for: [] }] })}
        >
          + Add strength
        </button>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="px-4 py-2 text-sm rounded bg-gray-800 text-white font-medium disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save record'}
        </button>
        <button type="button" className="text-sm text-gray-600 underline" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </div>
  );
}
