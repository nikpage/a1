// components/MergeConflictModal.js
//
// Shown when merging a new CV into the existing profile turns up facts that
// disagree (a changed date, a relabelled title). Nothing is saved until the user
// resolves each one. Default is the NEW value (newest wins); the user can switch
// any row back to the existing value. onConfirm receives the list of overrides
// (only the rows where they kept the OLD value) for add-cv-commit.

import React, { useState } from 'react';
import BaseModal from './BaseModal';
import { useTranslation } from 'react-i18next';

const conflictWhere = (c) => c.where || c.field || '';

export default function MergeConflictModal({ conflicts, onConfirm, onCancel }) {
  const { t } = useTranslation('mergeConflictModal');

  // choice per conflict: 'new' (default, newest wins) or 'old' (keep existing)
  const [choices, setChoices] = useState(() => conflicts.map(() => 'new'));

  const setChoice = (idx, val) =>
    setChoices((prev) => prev.map((c, i) => (i === idx ? val : c)));

  const handleConfirm = () => {
    const overrides = conflicts
      .map((c, i) => (choices[i] === 'old' ? { where: conflictWhere(c), value: c.old_value } : null))
      .filter(Boolean);
    onConfirm(overrides);
  };

  return (
    <BaseModal onClose={onCancel}>
      <div className="text-left max-h-[75vh] overflow-y-auto pr-1">
        <h2 className="text-lg font-bold text-gray-900 mb-1">{t('title')}</h2>
        <p className="text-sm text-gray-500 mb-4">{t('subtitle')}</p>

        {conflicts.map((c, i) => (
          <div key={i} className="mb-3 p-3 rounded-lg border border-gray-200">
            <div className="text-xs font-semibold text-gray-700 mb-2">{conflictWhere(c)}</div>

            <label className="flex items-start gap-2 mb-1.5 cursor-pointer">
              <input
                type="radio"
                name={`conflict-${i}`}
                checked={choices[i] === 'new'}
                onChange={() => setChoice(i, 'new')}
                className="mt-0.5"
              />
              <span className="text-xs text-gray-800">
                <span className="text-gray-400">{t('useNew')}: </span>{c.new_value}
              </span>
            </label>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name={`conflict-${i}`}
                checked={choices[i] === 'old'}
                onChange={() => setChoice(i, 'old')}
                className="mt-0.5"
              />
              <span className="text-xs text-gray-800">
                <span className="text-gray-400">{t('keepCurrent')}: </span>{c.old_value}
              </span>
            </label>
          </div>
        ))}

        <div className="flex gap-3 mt-5 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
          >
            {t('save')}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
