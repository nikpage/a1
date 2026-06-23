// components/AddCvChoiceModal.js
//
// Shown when a user who ALREADY has a career profile uploads another CV. Makes it
// explicit what will happen: add this CV to their existing profile (merge) or
// start fresh (treat it as a brand-new, separate profile). No silent behaviour.

import React from 'react';
import BaseModal from './BaseModal';
import { useTranslation } from 'react-i18next';

export default function AddCvChoiceModal({ onMerge, onFresh, onCancel }) {
  const { t } = useTranslation('addCvChoiceModal');

  return (
    <BaseModal onClose={onCancel}>
      <div className="text-left">
        <h2 className="text-lg font-bold text-gray-900 mb-1">{t('title')}</h2>
        <p className="text-sm text-gray-500 mb-5">{t('subtitle')}</p>

        <button
          type="button"
          onClick={onMerge}
          className="w-full text-left mb-3 p-4 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors"
        >
          <div className="text-sm font-semibold text-blue-900">{t('merge.title')}</div>
          <div className="text-xs text-blue-700 mt-0.5">{t('merge.desc')}</div>
        </button>

        <button
          type="button"
          onClick={onFresh}
          className="w-full text-left p-4 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
        >
          <div className="text-sm font-semibold text-gray-900">{t('fresh.title')}</div>
          <div className="text-xs text-gray-500 mt-0.5">{t('fresh.desc')}</div>
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="mt-5 w-full py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
        >
          {t('cancel')}
        </button>
      </div>
    </BaseModal>
  );
}
