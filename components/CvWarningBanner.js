// components/CvWarningBanner.js
//
// Layer 6 output-validation warnings for either document. Hard failures never
// reach the browser; these are the ones the user decides about.
//
// One banner, one translation path — warnings are always { code, params } (never
// sentences, see CLAUDE.md), and the strings live in
// locales/{en,cs,pl}/tabbedViewer.json under `cvWarning.<code>`. Shared by the
// viewer (components/TabbedViewer.js) and the workbench (pages/me.js) so a new
// warning code needs its string added in exactly one place.

import { useTranslation } from 'react-i18next';

export default function CvWarningBanner({ items, className = '' }) {
  const { t } = useTranslation('tabbedViewer');
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (list.length === 0) return null;

  return (
    <div className={`rounded-lg border border-amber-300 bg-amber-50 p-3 sm:p-4 ${className}`}>
      <div className="text-sm font-bold text-amber-900">{t('cvWarningsTitle')}</div>
      <ul className="mt-2 list-disc pl-5 text-sm text-amber-900">
        {list.map((w, i) => (
          <li key={i}>{t(`cvWarning.${w.code}`, { ...(w.params || {}), defaultValue: w.code })}</li>
        ))}
      </ul>
    </div>
  );
}
