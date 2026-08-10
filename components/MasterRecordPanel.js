// components/MasterRecordPanel.js
//
// Read-only view of the per-user MASTER CV — the record every CV and cover
// letter is written from. Shared by the personal workbench (/me) and the user
// page (/[user_id]) so there is exactly ONE renderer for the master: a readable
// section view plus the raw-JSON toggle that /me used to inline.
//
// "Edit record" swaps in MasterRecordEditor, which writes the whole record back
// through /api/update-master — the direct-correction path the flag fixer
// (/api/resolve-flag) and the additive add-info panel (/api/master-add-info)
// never provided.

import { useState } from 'react';
import MasterRecordEditor from './MasterRecordEditor';

function Field({ label, children }) {
  if (!children) return null;
  return (
    <div className="mt-3">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-sm text-gray-800">{children}</div>
    </div>
  );
}

function List({ items, render }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <ul className="list-disc pl-5 text-sm text-gray-800 space-y-1">
      {items.map((item, i) => <li key={i}>{render(item)}</li>)}
    </ul>
  );
}

// A value the model may leave as "" — rendered only when it carries something.
function joinParts(parts) {
  return parts.filter((p) => p && String(p).trim()).join(' | ');
}

export default function MasterRecordPanel({ master, onUpdated }) {
  const [showJson, setShowJson] = useState(false);
  const [editing, setEditing] = useState(false);

  if (!master) return null;

  if (editing) {
    return (
      <MasterRecordEditor
        master={master}
        onCancel={() => setEditing(false)}
        onSaved={(saved, flags) => {
          setEditing(false);
          if (typeof onUpdated === 'function') onUpdated(saved, flags);
        }}
      />
    );
  }

  const identity = master.identity || {};
  const contact = identity.contact || {};
  const experience = Array.isArray(master.experience) ? master.experience : [];
  const education = Array.isArray(master.education) ? master.education : [];
  const certifications = Array.isArray(master.certifications) ? master.certifications : [];
  const parallel = Array.isArray(master.parallel_experience) ? master.parallel_experience : [];
  const notes = Array.isArray(master.transferable_notes) ? master.transferable_notes : [];
  const voice = Array.isArray(master.voice_samples) ? master.voice_samples : [];
  const languages = Array.isArray(identity.languages) ? identity.languages : [];
  const links = Array.isArray(contact.links) ? contact.links : [];

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-gray-600">
          {joinParts([identity.name, identity.country]) || 'Master record'}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={() => setEditing(true)} className="text-sm text-blue-700 underline">
            Edit record
          </button>
          <button onClick={() => setShowJson((v) => !v)} className="text-sm text-blue-700 underline">
            {showJson ? 'Hide raw record' : 'Show raw record'}
          </button>
        </div>
      </div>

      {showJson ? (
        <pre className="mt-3 max-h-96 overflow-auto rounded bg-gray-50 border border-gray-200 p-3 text-xs whitespace-pre-wrap">
          {JSON.stringify(master, null, 2)}
        </pre>
      ) : (
        <div className="mt-2 divide-y divide-gray-100">
          <div className="pb-3">
            <Field label="Contact">
              {joinParts([contact.email, contact.phone, contact.location]) || null}
            </Field>
            {links.length > 0 && (
              <Field label="Links">{links.join(', ')}</Field>
            )}
            {languages.length > 0 && (
              <Field label="Languages">
                {languages.map((l) => joinParts([l.language, l.level])).filter(Boolean).join(', ')}
              </Field>
            )}
            <Field label="Core">{master.candidate_core || null}</Field>
          </div>

          {experience.length > 0 && (
            <div className="py-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Experience</div>
              {experience.map((role, i) => (
                <div key={i} className="mt-3">
                  <div className="text-sm font-semibold text-gray-900">
                    {joinParts([role.role, role.company]) || 'Untitled role'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {joinParts([role.dates, role.location])}
                  </div>
                  <List
                    items={Array.isArray(role.achievements) ? role.achievements : []}
                    render={(a) => joinParts([a.text, a.metric])}
                  />
                </div>
              ))}
            </div>
          )}

          {education.length > 0 && (
            <div className="py-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Education</div>
              <List
                items={education}
                render={(e) => joinParts([e.qualification, e.institution, e.dates, e.notes])}
              />
            </div>
          )}

          {certifications.length > 0 && (
            <div className="py-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Certifications</div>
              <List items={certifications} render={(c) => joinParts([c.name, c.issuer, c.date])} />
            </div>
          )}

          {parallel.length > 0 && (
            <div className="py-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Alongside work</div>
              <List items={parallel} render={(p) => (typeof p === 'string' ? p : joinParts(Object.values(p || {})))} />
            </div>
          )}

          {notes.length > 0 && (
            <div className="py-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Transferable strengths</div>
              <List items={notes} render={(n) => joinParts([n.observation, n.evidence])} />
            </div>
          )}

          {voice.length > 0 && (
            <div className="py-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Your own words</div>
              <List items={voice} render={(v) => <span className="italic">“{v}”</span>} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
