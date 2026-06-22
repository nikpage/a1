// components/JobExtractionModal.js
import React, { useState, useRef } from 'react';
import BaseModal from './BaseModal';
import { useTranslation } from 'react-i18next';

const TEXT_FIELDS = [
  'position_title',
  'company',
  'hr_contact',
  'location',
  'seniority',
  'employment_type',
  'salary',
];

const CHIP_FIELDS = [
  'required_skills',
  'desired_skills',
  'must_have_requirements',
  'nice_to_have',
  'responsibilities',
  'keywords_for_ats',
  'language_requirements',
];

function ChipEditor({ label, items, onChange, placeholder }) {
  const [draft, setDraft] = useState('');

  const addChip = () => {
    const trimmed = draft.trim();
    if (trimmed && !items.includes(trimmed)) {
      onChange([...items, trimmed]);
    }
    setDraft('');
  };

  const removeChip = (idx) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  return (
    <div className="mb-3">
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <div className="flex flex-wrap gap-1 mb-1 min-h-[28px]">
        {items.map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-800 text-xs px-2 py-0.5 rounded-full"
          >
            {item}
            <button
              type="button"
              onClick={() => removeChip(i)}
              className="text-blue-400 hover:text-blue-700 leading-none"
              aria-label={`Remove ${item}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); addChip(); }
          }}
          placeholder={placeholder}
          className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs text-gray-800 placeholder-gray-400"
        />
        <button
          type="button"
          onClick={addChip}
          className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium hover:bg-blue-200"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function JobExtractionModal({ extraction, onConfirm, onCancel }) {
  const { t } = useTranslation('jobExtractionModal');

  const [fields, setFields] = useState(() => {
    const ex = extraction || {};
    const init = {};
    TEXT_FIELDS.forEach((f) => { init[f] = ex[f] || ''; });
    CHIP_FIELDS.forEach((f) => { init[f] = Array.isArray(ex[f]) ? [...ex[f]] : []; });
    return init;
  });

  const setField = (key, value) => setFields((prev) => ({ ...prev, [key]: value }));

  const handleConfirm = () => {
    onConfirm({ ...fields });
  };

  const missingTitle = !fields.position_title.trim();
  const missingCompany = !fields.company.trim();

  return (
    <BaseModal onClose={onCancel}>
      <div className="text-left max-h-[75vh] overflow-y-auto pr-1">
        <h2 className="text-lg font-bold text-gray-900 mb-1">{t('title')}</h2>
        <p className="text-sm text-gray-500 mb-4">{t('subtitle')}</p>

        {TEXT_FIELDS.map((field) => {
          const isEmpty = !fields[field].trim();
          const isImportant = field === 'position_title' || field === 'company';
          return (
            <div key={field} className="mb-3">
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                {t(`fields.${field}`)}
                {isImportant && isEmpty && (
                  <span className="ml-2 text-amber-500 font-normal text-xs">({t('emptyWarning')})</span>
                )}
              </label>
              <input
                type="text"
                value={fields[field]}
                onChange={(e) => setField(field, e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-gray-800"
                placeholder={isEmpty ? t('emptyWarning') : ''}
              />
            </div>
          );
        })}

        {CHIP_FIELDS.map((field) => (
          <ChipEditor
            key={field}
            label={t(`fields.${field}`)}
            items={fields[field]}
            onChange={(val) => setField(field, val)}
            placeholder={t('addPlaceholder')}
          />
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
            {t('confirm')}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
