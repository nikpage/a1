// components/CollapsibleSection.js
//
// One collapsible block, shared so every "open when you need it" panel on the
// page looks and behaves the same. The chrome matches the header
// VoiceProfilePanel already used (label, hint, badge, Open/Close), so nothing on
// the page has two different ways to expand.
//
// Children are rendered ONLY while open. That is deliberate: a panel that
// fetches on mount (the AI cost ledger) then costs nothing until it is asked
// for, and a closed section cannot occupy the screen with work nobody is doing.

import { useEffect, useState } from 'react';

export default function CollapsibleSection({
  id,
  label,
  hint,
  badge,
  defaultOpen = false,
  // A counter the page bumps to open this section from somewhere else — the
  // missing-keyword chips in the analysis send the user here, and a panel they
  // then have to find and expand themselves is a dead end.
  openSignal = 0,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { if (openSignal) setOpen(true); }, [openSignal]);

  return (
    <div id={id} className="border border-gray-200 rounded-lg bg-white shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-baseline gap-3 px-4 py-3 text-left"
      >
        <span className="text-xs uppercase tracking-wide text-gray-500">{label}</span>
        {hint && <span className="text-xs text-gray-500">{hint}</span>}
        {badge && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            {badge}
          </span>
        )}
        <span className="ml-auto text-xs text-blue-700 underline">{open ? 'Close' : 'Open'}</span>
      </button>

      {open && <div className="border-t border-gray-200 px-4 py-4">{children}</div>}
    </div>
  );
}
