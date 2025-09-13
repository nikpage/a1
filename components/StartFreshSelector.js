// components/StartFreshSelector.js
import React from 'react'
import StartFreshHeader from './StartFreshHeader'
import { useTranslation } from 'react-i18next'

export default function StartFreshSelector({ onChooseDb, onChooseUpload, onClose }) {
  const { t } = useTranslation('startFreshSelector')

  return (
    <StartFreshHeader mode="select" onClose={onClose}>
      <div className="mb-6 text-left">
        <p className="font-medium mb-2">{t('whatHappens')}</p>
        <ul className="space-y-2">
          <li className="flex items-center">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
            {t('deletedAnalyses')}
          </li>
          <li className="flex items-center">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
            {t('removedDocs')}
          </li>
          <li className="flex items-center">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
            {t('cleanSlate')}
          </li>
          <li className="flex items-center">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
            <strong>{t('cvUnaffected')}</strong>
          </li>
        </ul>
      </div>
      <div className="flex space-x-4">
        <button
          className="flex-1 bg-white border border-gray-200 px-4 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          onClick={onChooseDb}
        >
          {t('continueUploaded')}
        </button>
        <button
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
          onClick={onChooseUpload}
        >
          {t('continueNew')}
        </button>
      </div>
    </StartFreshHeader>
  )
}
