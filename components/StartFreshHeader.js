// components/StartFreshHeader.js
import React from 'react'
import BaseModal from './BaseModal'
import { useTranslation } from 'react-i18next'

export default function StartFreshHeader({ mode, onClose, children }) {
  const { t } = useTranslation('startFreshHeader')

  return (
    <BaseModal onClose={onClose}>
      {mode === 'start' && (
        <>
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('startFreshTitle')}</h2>
            <p className="text-sm text-gray-600">{t('cannotUndo')}</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M12 7a5 5 0 010 10" />
                </svg>
              </div>
              <div className="ml-3 text-amber-700">
                <p>{t('warning')}</p>
              </div>
            </div>
          </div>
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
        </>
      )}

      {mode === 'select' && (
        <>
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">{t('selectCvTitle')}</h2>
          <p className="text-sm text-gray-600 text-center">{t('selectCvSubtitle')}</p>
        </>
      )}

      {children}
    </BaseModal>
  )
}
