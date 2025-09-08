// path: components/StartFreshDbModal.js
import React, { useEffect } from 'react';
import StartFreshHeader from './StartFreshHeader';
import LoadingModal from './LoadingModal';

export default function StartFreshDbModal({
  user_id,
  cvOptions,
  selectedCvId,
  setSelectedCvId,
  jobDescription,
  setJobDescription,
  loading,
  onSubmit,
  onBack,
  onClose,
  generationsRemaining,
  onShowPurchaseModal,
}) {
  useEffect(() => {
    if (Array.isArray(cvOptions) && cvOptions.length > 0 && !selectedCvId) {
      setSelectedCvId(cvOptions[0].id)
    }
  }, [cvOptions, selectedCvId, setSelectedCvId]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleGenerateClick = () => {
    if (generationsRemaining <= 0) {
      onShowPurchaseModal();
    } else {
      const id = selectedCvId || cvOptions[0]?.id;
      onSubmit(id, jobDescription);
    }
  };

  const isButtonDisabled = loading || !cvOptions || cvOptions.length === 0;

  return (
    <StartFreshHeader mode="select" onClose={onClose}>
      <>
        <div className="mb-4 text-left">
          <label className="block text-sm font-medium text-gray-700 mb-1">Select a saved CV</label>
          <select
            value={selectedCvId || ''}
            onChange={e => setSelectedCvId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-2"
            disabled={loading}
          >
            {cvOptions && cvOptions.length > 0 ? (
              cvOptions.map((cv, index) => (
                <option key={cv.id || index} value={cv.id}>
                  {cv.name?.replace(/Untitled/gi, '').trim()} {cv.uploadedAt && formatDate(cv.uploadedAt)}
                </option>
              ))
            ) : (
              <option value="">No CVs available</option>
            )}
          </select>
        </div>

        <div className="mb-4 text-left">
          <label className="block text-sm font-medium text-gray-700 mb-1">Paste job description (optional)</label>
          <textarea
            value={jobDescription || ''}
            onChange={e => setJobDescription(e.target.value)}
            rows={4}
            className="w-full border border-gray-300 rounded-lg p-2"
            placeholder="Paste the job description here to get a more targeted analysis..."
            disabled={loading}
          />
        </div>

        <div className="flex space-x-4">
          <button
            className="bg-white border border-gray-200 px-4 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={onBack}
            disabled={loading}
          >
            Back
          </button>
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
            onClick={handleGenerateClick}
            disabled={isButtonDisabled}
          >
            {loading ? 'Generating...' :
              generationsRemaining <= 0 ? 'Purchase to Generate' : 'Generate Analysis'
            }
          </button>
        </div>
      </>
      {loading && <LoadingModal onClose={onClose} />}
    </StartFreshHeader>
  );
}
