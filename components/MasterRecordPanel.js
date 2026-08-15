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
import VoiceGuidePanel from './VoiceGuidePanel';
import { roles, advisory, speaking, education as educationOf, profile as profileOf } from '../utils/master-read';

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

// One role as the record holds it. `via` is set on an engagement that ran under
// an umbrella consultancy — shown so a client engagement is never mistaken for
// direct employment.
function Role({ role }) {
  return (
    <div className={role.via ? 'mt-3 border-l-2 border-gray-200 pl-3' : 'mt-3'}>
      <div className="text-sm font-semibold text-gray-900">
        {joinParts([role.role, role.company]) || 'Untitled role'}
      </div>
      <div className="text-xs text-gray-500">{joinParts([role.dates, role.location])}</div>
      {role.via && <div className="text-xs text-gray-500">via {role.via}</div>}
      <List items={role.bullets} render={(b) => b} />
    </div>
  );
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

  const profile = profileOf(master);
  const contact = profile.contact;
  const experience = roles(master);
  const education = educationOf(master);
  const community = advisory(master);
  const talks = speaking(master);
  const publications = Array.isArray(master.publications_and_patents) ? master.publications_and_patents : [];
  // Everything the record holds is shown. A field rendered nowhere is a field
  // the user cannot see is wrong — and this panel is the only view of the
  // record the CV and cover letter are written from.
  const languages = profile.languages;
  const links = [contact.linkedin, contact.website].filter(Boolean);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-gray-600">
          {joinParts([profile.name, profile.location]) || 'Master record'}
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
              {joinParts([contact.email, contact.phone, profile.location]) || null}
            </Field>
            {links.length > 0 && (
              <Field label="Links">{links.join(', ')}</Field>
            )}
            {languages.length > 0 && (
              <Field label="Languages">
                {languages.map((l) => joinParts([l.language, l.proficiency])).filter(Boolean).join(', ')}
              </Field>
            )}
            <Field label="Headline">{profile.headline || null}</Field>
            <Field label="Summary">{profile.summary || null}</Field>
            {profile.top_skills.length > 0 && (
              <Field label="Skills">{profile.top_skills.join(', ')}</Field>
            )}
          </div>

          {experience.length > 0 && (
            <div className="py-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Experience</div>
              {experience.map((role, i) => <Role key={i} role={role} />)}
            </div>
          )}

          {education.length > 0 && (
            <div className="py-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Education</div>
              <List
                items={education}
                render={(e) => joinParts([e.qualification, e.institution, e.dates, e.location])}
              />
            </div>
          )}

          {community.length > 0 && (
            <div className="py-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Advisory and community</div>
              {community.map((role, i) => <Role key={i} role={role} />)}
            </div>
          )}

          {talks.length > 0 && (
            <div className="py-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Speaking and lecturing</div>
              <List items={talks} render={(t) => joinParts([t.event, t.topic || t.role, t.location, t.year])} />
            </div>
          )}

          {publications.length > 0 && (
            <div className="py-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Publications and patents</div>
              <List items={publications} render={(w) => (typeof w === 'string' ? w : joinParts(Object.values(w || {})))} />
            </div>
          )}

          {profile.certifications.length > 0 && (
            <div className="py-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Certifications</div>
              <List items={profile.certifications} render={(c) => c} />
            </div>
          )}

          {profile.honors_and_awards.length > 0 && (
            <div className="py-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Honors and awards</div>
              <List items={profile.honors_and_awards} render={(h) => h} />
            </div>
          )}

          {/* The only write path for voice_guide — every other path deliberately
              cannot set it, which had left it permanently empty. */}
          <VoiceGuidePanel
            voiceGuide={master.voice_guide || ''}
            onUpdated={(saved) => onUpdated?.(saved)}
          />

        </div>
      )}
    </div>
  );
}
