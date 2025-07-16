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

        <div className="flex justify-center mt-6">
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-lg font-medium transition-colors"
            onClick={handleUploadAndAnalyze}
          >
            Generate Analysis
          </button>
        </div>

        <div className="flex justify-center space-x-6 mt-4">
          <button
            className="text-gray-600 hover:underline"
            onClick={onBack}
          >
            Back
          </button>
          <button
            className="text-gray-600 hover:underline"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {loading && <LoadingModal />}
      </StartFreshHeader>
    )
  }
