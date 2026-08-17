// components/MasterRecordEditor.js
//
// Direct editing of the master record — the record every CV and cover letter is
// written from. The flag fixer resolves one flagged question at a time and
// add-info only ever ADDS, so until this existed a wrong date, an unwanted role
// or clumsy achievement wording could not be fixed at all.
//
// Edits are local until Save; Save POSTs the whole record to /api/update-master,
// which normalises it onto the schema (prompts/master-cv.js, EXACT_SHAPE) and
// writes it. Every field the record holds is editable here except voice_guide,
// which has its own panel and is carried over untouched.

import { useEffect, useRef, useState } from 'react';
import { recordFingerprint, rebaseMaster } from '../utils/master-schema';

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

// A list of plain strings (skills, certifications, awards, publications, bullets).
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

function RoleEditor({ role, onChange, onRemove, nested = false }) {
  const engagements = Array.isArray(role.fractional_engagements) ? role.fractional_engagements : [];
  const set = (patch) => onChange({ ...role, ...patch });

  return (
    <div className="mt-4 rounded border border-gray-200 p-3">
      <div className="grid grid-cols-2 gap-2">
        <TextRow label="Title" value={role.title} onChange={(v) => set({ title: v })} />
        <TextRow label="Company" value={role.company} onChange={(v) => set({ company: v })} />
        <TextRow label="Start" value={role.start_date} onChange={(v) => set({ start_date: v })} placeholder="August 2016" />
        <TextRow label="End" value={role.end_date} onChange={(v) => set({ end_date: v })} placeholder="Present" />
        <TextRow label="Location" value={role.location} onChange={(v) => set({ location: v })} placeholder="Prague, CZ" />
      </div>

      <div className="mt-3">
        <StringList label="Bullets" items={role.bullets} onChange={(bullets) => set({ bullets })} />
      </div>

      {/*
        Fractional engagements — the client or advisory work that ran under this
        consultancy. Same shape as a role, so the same editor one level in:
        visible and editable here, not hidden behind a count. One level only,
        which is why a nested editor renders no engagements of its own.
      */}
      {!nested && (
        <div className="mt-3">
          <span className={labelClass}>
            Engagements under this role{engagements.length > 0 ? ` (${engagements.length})` : ''}
          </span>
          <div className="ml-3 border-l-2 border-gray-200 pl-3">
            {engagements.map((c, i) => (
              <RoleEditor
                key={i}
                role={c}
                nested
                onChange={(updated) => set({ fractional_engagements: replaceAt(engagements, i, updated) })}
                onRemove={() => set({ fractional_engagements: engagements.filter((_, j) => j !== i) })}
              />
            ))}
            <button
              type="button"
              className="mt-2 text-xs text-blue-700 underline"
              onClick={() =>
                set({
                  fractional_engagements: [
                    ...engagements,
                    { company: '', title: '', start_date: '', end_date: '', location: '', bullets: [] },
                  ],
                })
              }
            >
              + Add engagement
            </button>
          </div>
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
  // The record this draft was opened on. The questions sit on the same page and
  // answering one restructures the record underneath this form, so the form
  // follows: untouched sections take the new record, typed ones keep the typing
  // (see rebaseMaster). Without this the form kept showing the old timeline and
  // saving it put the old timeline back.
  const base = useRef(master);
  useEffect(() => {
    if (master === base.current) return;
    setDraft((current) => rebaseMaster(base.current, current, master));
    base.current = master;
  }, [master]);

  const profile = draft.profile || {};
  const contact = profile.contact || {};
  const experience = Array.isArray(draft.work_experience) ? draft.work_experience : [];
  const education = Array.isArray(draft.education) ? draft.education : [];
  const community = Array.isArray(draft.advisory_and_community) ? draft.advisory_and_community : [];
  const talks = Array.isArray(draft.speaking_and_lecturing) ? draft.speaking_and_lecturing : [];
  const languages = Array.isArray(profile.languages) ? profile.languages : [];

  const setProfile = (patch) => setDraft({ ...draft, profile: { ...profile, ...patch } });
  const setContact = (patch) => setProfile({ contact: { ...contact, ...patch } });

  // One POST. `based_on` is the structure this draft was opened on, so the
  // server can tell an up-to-date save from one taken before the record moved.
  async function post(record, basedOn) {
    const res = await fetch('/api/update-master', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ master: record, based_on: basedOn }),
    });
    return { res, data: await res.json() };
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      let { res, data } = await post(draft, recordFingerprint(base.current));
      // The record moved while this form was open — a question answered in
      // another tab, say. The server hands the current record back; the typed
      // edits move onto it and the save goes again, ONCE. The typing is never
      // dropped and the newer structure is never overwritten.
      if (res.status === 409 && data.master) {
        const rebased = rebaseMaster(base.current, draft, data.master);
        setDraft(rebased);
        base.current = data.master;
        ({ res, data } = await post(rebased, recordFingerprint(data.master)));
      }
      if (!res.ok) throw new Error(data.error || 'Could not save your record');
      base.current = data.master;
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
        <TextRow label="Name" value={profile.name} onChange={(v) => setProfile({ name: v })} />
        <TextRow label="Location" value={profile.location} onChange={(v) => setProfile({ location: v })} />
        <TextRow label="Email" value={contact.email} onChange={(v) => setContact({ email: v })} />
        <TextRow label="Phone" value={contact.phone} onChange={(v) => setContact({ phone: v })} />
        <TextRow label="LinkedIn" value={contact.linkedin} onChange={(v) => setContact({ linkedin: v })} />
        <TextRow label="Website" value={contact.website} onChange={(v) => setContact({ website: v })} />
        <TextRow label="Headline" value={profile.headline} onChange={(v) => setProfile({ headline: v })} />
      </div>

      <label className="mt-4 block">
        <span className={labelClass}>Summary (your own words)</span>
        <textarea
          className={inputClass}
          rows={3}
          value={profile.summary || ''}
          onChange={(e) => setProfile({ summary: e.target.value })}
        />
      </label>

      <div className="mt-3">
        <StringList label="Skills" items={profile.top_skills} onChange={(top_skills) => setProfile({ top_skills })} />
      </div>

      {/* Languages were previously visible only in the read-only view this form
          replaced — editable here so the field is not invisible. */}
      <div className="mt-5">
        <span className={labelClass}>Languages</span>
        {languages.map((l, i) => (
          <div key={i} className="mt-2 grid grid-cols-2 gap-2 rounded border border-gray-200 p-3">
            <TextRow label="Language" value={l.language} onChange={(v) => setProfile({ languages: replaceAt(languages, i, { ...l, language: v }) })} />
            <TextRow label="Proficiency" value={l.proficiency} onChange={(v) => setProfile({ languages: replaceAt(languages, i, { ...l, proficiency: v }) })} />
            <button type="button" className="text-xs text-red-700 justify-self-start" onClick={() => setProfile({ languages: languages.filter((_, j) => j !== i) })}>
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="mt-2 text-xs text-blue-700 underline"
          onClick={() => setProfile({ languages: [...languages, { language: '', proficiency: '' }] })}
        >
          + Add language
        </button>
      </div>

      <div className="mt-5">
        <span className={labelClass}>Experience</span>
        {experience.map((role, i) => (
          <RoleEditor
            key={i}
            role={role}
            onChange={(updated) => setDraft({ ...draft, work_experience: replaceAt(experience, i, updated) })}
            onRemove={() => setDraft({ ...draft, work_experience: experience.filter((_, j) => j !== i) })}
          />
        ))}
        <button
          type="button"
          className="mt-3 text-xs text-blue-700 underline"
          onClick={() =>
            setDraft({
              ...draft,
              work_experience: [{ company: '', title: '', start_date: '', end_date: '', location: '', bullets: [], fractional_engagements: [] }, ...experience],
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
            <TextRow label="Location" value={e.location} onChange={(v) => setDraft({ ...draft, education: replaceAt(education, i, { ...e, location: v }) })} />
            <button type="button" className="text-xs text-red-700 justify-self-start" onClick={() => setDraft({ ...draft, education: education.filter((_, j) => j !== i) })}>
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="mt-2 text-xs text-blue-700 underline"
          onClick={() => setDraft({ ...draft, education: [...education, { institution: '', qualification: '', dates: '', location: '' }] })}
        >
          + Add education
        </button>
      </div>

      <div className="mt-5">
        <StringList
          label="Certifications"
          items={profile.certifications}
          onChange={(certifications) => setProfile({ certifications })}
        />
      </div>

      <div className="mt-5">
        <StringList
          label="Honors and awards"
          items={profile.honors_and_awards}
          onChange={(honors_and_awards) => setProfile({ honors_and_awards })}
        />
      </div>

      <div className="mt-5">
        <StringList
          label="Publications and patents"
          items={draft.publications_and_patents}
          onChange={(publications_and_patents) => setDraft({ ...draft, publications_and_patents })}
        />
      </div>

      <div className="mt-5">
        <span className={labelClass}>Advisory and community</span>
        {community.map((c, i) => (
          <div key={i} className="mt-2 grid grid-cols-2 gap-2 rounded border border-gray-200 p-3">
            <TextRow label="Organization" value={c.organization} onChange={(v) => setDraft({ ...draft, advisory_and_community: replaceAt(community, i, { ...c, organization: v }) })} />
            <TextRow label="Title" value={c.title} onChange={(v) => setDraft({ ...draft, advisory_and_community: replaceAt(community, i, { ...c, title: v }) })} />
            <TextRow label="Start" value={c.start_date} onChange={(v) => setDraft({ ...draft, advisory_and_community: replaceAt(community, i, { ...c, start_date: v }) })} />
            <TextRow label="End" value={c.end_date} onChange={(v) => setDraft({ ...draft, advisory_and_community: replaceAt(community, i, { ...c, end_date: v }) })} />
            <button type="button" className="text-xs text-red-700 justify-self-start" onClick={() => setDraft({ ...draft, advisory_and_community: community.filter((_, j) => j !== i) })}>
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="mt-2 text-xs text-blue-700 underline"
          onClick={() => setDraft({ ...draft, advisory_and_community: [...community, { organization: '', title: '', start_date: '', end_date: '', location: '', bullets: [] }] })}
        >
          + Add
        </button>
      </div>

      <div className="mt-5">
        <span className={labelClass}>Speaking and lecturing</span>
        {talks.map((t, i) => (
          <div key={i} className="mt-2 grid grid-cols-2 gap-2 rounded border border-gray-200 p-3">
            <TextRow label="Event" value={t.event} onChange={(v) => setDraft({ ...draft, speaking_and_lecturing: replaceAt(talks, i, { ...t, event: v }) })} />
            <TextRow label="Topic" value={t.topic} onChange={(v) => setDraft({ ...draft, speaking_and_lecturing: replaceAt(talks, i, { ...t, topic: v }) })} />
            <TextRow label="Role" value={t.role} onChange={(v) => setDraft({ ...draft, speaking_and_lecturing: replaceAt(talks, i, { ...t, role: v }) })} />
            <TextRow label="Location" value={t.location} onChange={(v) => setDraft({ ...draft, speaking_and_lecturing: replaceAt(talks, i, { ...t, location: v }) })} />
            <TextRow label="Year" value={t.year} onChange={(v) => setDraft({ ...draft, speaking_and_lecturing: replaceAt(talks, i, { ...t, year: v }) })} />
            <button type="button" className="text-xs text-red-700 justify-self-start" onClick={() => setDraft({ ...draft, speaking_and_lecturing: talks.filter((_, j) => j !== i) })}>
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="mt-2 text-xs text-blue-700 underline"
          onClick={() => setDraft({ ...draft, speaking_and_lecturing: [...talks, { event: '', role: '', topic: '', location: '', year: '' }] })}
        >
          + Add
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
        {typeof onCancel === 'function' && (
          <button type="button" className="text-sm text-gray-600 underline" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
