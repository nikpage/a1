// components/StartFreshUploadModal.js
import React from 'react'
import StartFreshHeader from './StartFreshHeader'
import CVUploader from './CVUploader'
import LoadingModal from './LoadingModal'

export default function StartFreshUploadModal({
  handleCvUploadFromModal,
  jobDescription,
  setJobDescription,
  loading,
  onBack,
  onClose,
  onSubmit,
}) {

  const handleUploadAndAnalyze = async () => {
    const newCvId = await handleCvUploadFromModal();
    if (newCvId) {
      onSubmit(newCvId, jobDescription);
    }
  };

  return (
    <StartFreshHeader mode="select" onClose={onClose}>
      <div className="mb-4 text-left">
        <label className="block text-sm font-medium text-gray-700 mb-1">Upload a new CV</label>
        <CVUploader onUpload={handleCvUploadFromModal} />
      </div>

      <div className="mb-4 text-left">
        <label className="block text-sm font-medium text-gray-700 mb-1">Paste job description (optional)</label>
        <textarea
          value={jobDescription}
          onChange={e => setJobDescription(e.target.value)}
          rows={4}
          className="w-full border border-gray-300 rounded-lg p-2"
        />
      </div>

      <div className="flex space-x-4">
        <button
          className="bg-white border border-gray-200 px-4 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          onClick={onBack}
        >
          Back
        </button>
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
          onClick={handleUploadAndAnalyze}
          disabled={loading}
        >
          {loading ? 'Generating Analysis...' : 'Upload & Analyze'}
        </button>
      </div>

      {loading && <LoadingModal />}
    </StartFreshHeader>
  )
}
