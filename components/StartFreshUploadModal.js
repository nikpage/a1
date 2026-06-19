// components/StartFreshUploadModal.js
import React from 'react'
import StartFreshHeader from './StartFreshHeader'
import CVUploader from './CVUploader'
import { useTranslation } from 'react-i18next'

export default function StartFreshUploadModal({ user_id, onBack, onClose }) {
  const { t } = useTranslation('startFreshUploadModal')

  return (
    <StartFreshHeader mode="select" onClose={onClose}>
      <div className="mb-4 text-left">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('uploadLabel')}
        </label>
        {/* CVUploader owns the whole flow: file + job description + upload +
            analysis. On success we reload so /[user_id] picks up the freshly
            saved analysis. */}
        <CVUploader
          user_id={user_id}
          onUpload={() => { if (typeof window !== 'undefined') window.location.reload(); }}
        />
      </div>

      <div className="flex justify-center space-x-6 mt-4">
        <button className="text-gray-600 hover:underline" onClick={onBack}>
          {t('back')}
        </button>
        <button className="text-gray-600 hover:underline" onClick={onClose}>
          {t('close')}
        </button>
      </div>
    </StartFreshHeader>
  )
}
