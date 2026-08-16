// components/MasterRecordPanel.js
//
// The ONE view of the per-user MASTER CV — the record every CV and cover letter
// is written from. Shared by the personal workbench (/me) and the user page
// (/[user_id]).
//
// It is the EDITABLE form and nothing else. The read-only section view and the
// raw-JSON toggle that used to sit behind buttons here were the same record a
// second and third time; the form already shows every field, so the other two
// only gave the user more places to read the same thing and one place to fix it.
//
// Saving writes the whole record back through /api/update-master — the
// direct-correction path the flag fixer (/api/resolve-flag) and the additive
// add-info panel (/api/master-add-info) never provided. `voice_guide` is the one
// field the form does not own: it has its own panel below, and the editor
// carries it through untouched.

import MasterRecordEditor from './MasterRecordEditor';
import VoiceGuidePanel from './VoiceGuidePanel';

export default function MasterRecordPanel({ master, onUpdated }) {
  if (!master) return null;

  return (
    <div>
      <MasterRecordEditor
        master={master}
        onSaved={(saved, flags) => onUpdated?.(saved, flags)}
      />

      {/* The only write path for voice_guide — every other path deliberately
          cannot set it, which had left it permanently empty. */}
      <VoiceGuidePanel
        voiceGuide={master.voice_guide || ''}
        onUpdated={(saved) => onUpdated?.(saved)}
      />
    </div>
  );
}
