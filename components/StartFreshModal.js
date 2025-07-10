// path: components/StartFreshModal.js
import { useState, useEffect } from 'react'
import BaseModal from './BaseModal'
import CVUploader from './CVUploader'

export default function StartFreshModal({ user_id, onClose, onSubmit, onStartFresh }) {
  const [step, setStep] = useState(1)
  const [cvText, setCvText] = useState('')
  const [cvOptions, setCvOptions] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchCVs = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/get-cvs?user_id=${user_id}`)
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        setCvOptions(data)
        setCvText(data[0].cv_data || '')
      } else {
        setCvOptions([])
        setCvText('')
      }
    } catch {
      setCvOptions([])
      setCvText('')
    }
    setLoading(false)
  }

  useEffect(() => {
    if (step === 2) fetchCVs()
  }, [step])

  return (
    <BaseModal onClose={onClose} showCloseButton={false}>
      <div className="w-full max-w-md mx-auto">

        {step === 1 && (
          <div className="text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Start Fresh</h2>
              <p className="text-sm text-gray-600">This action cannot be undone</p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-semibold text-amber-800 mb-1">Warning</h3>
                  <p className="text-sm text-amber-700 leading-relaxed">
                    This will permanently delete your current analyses, CV, and cover letter.
                    Please cancel and download any documents you want to keep before proceeding.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="text-sm font-medium text-gray-900 mb-2">What happens when you start fresh:</h4>
              <ul className="text-sm text-gray-600 space-y-1 text-left">
                <li className="flex items-center">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
                  All current analyses will be deleted
                </li>
                <li className="flex items-center">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
                  Your CV and cover letter will be removed
                </li>
                <li className="flex items-center">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
                  You'll start with a clean slate for your new job application
                </li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                className="flex-1 bg-white border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
                onClick={() => setStep(2)}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Your CV</h2>
              <p className="text-sm text-gray-600">Choose a saved CV or upload a new one</p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-sm text-gray-600">Loading your CVs...</span>
              </div>
            ) : (
              <div className="space-y-6">
                {cvOptions.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Saved CVs
                    </label>
                    <select
                      className="w-full border border-gray-300 rounded-lg p-3 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      value={cvText}
                      onChange={(e) => setCvText(e.target.value)}
                    >
                      {cvOptions.map((cv) => (
                        <option key={cv.created_at} value={cv.cv_data || ''}>
                          Uploaded {new Date(cv.created_at).toLocaleString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }).replace(',', '')}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">or</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload New CV
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-gray-400 transition-colors">
                    <div className="text-center">
                      <CVUploader
                        user_id={user_id}
                        onUpload={(newAnalysis) => {
                          window.dispatchEvent(new CustomEvent('new-analysis', {
                            detail: { analysis: newAnalysis }
                          }));
                          localStorage.removeItem('cvVersions');
                          localStorage.removeItem('coverVersions');
                          localStorage.removeItem('analysisText');
                          localStorage.setItem('shouldFetchFromDB', 'false');
                          onStartFresh();
                          onClose();
                        }}
                        compact
                        selectedCv={cvText}
                      />
                      <p className="mt-2 text-sm text-gray-600">
                        Select your CV (PDF, max 200KB)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <button
                className="flex-1 bg-white border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                onClick={() => setStep(1)}
              >
                Back
              </button>
              {cvText && (
                <button
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
                  onClick={() => {
                    onSubmit?.(cvText);
                    onStartFresh();
                    onClose();
                  }}
                >
                  Start Fresh
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </BaseModal>
  )
}
