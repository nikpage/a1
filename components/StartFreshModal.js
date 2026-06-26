// components/StartFreshModal.js
import React, { useState, useEffect, useRef } from 'react'
import StartFreshSelector from './StartFreshSelector'
import StartFreshDbModal from './StartFreshDbModal'
import StartFreshUploadModal from './StartFreshUploadModal'
import StartFreshHeader from './StartFreshHeader'
import JobExtractionModal from './JobExtractionModal'
import { useTranslation } from 'react-i18next'
import { uploadAndAnalyze } from '../utils/uploadAndAnalyze'
import { resolveJobText } from '../utils/resolveJobText'

export default function StartFreshModal({
  user_id,
  onSubmit,
  onStartFresh,
  onClose,
}) {
  const { t } = useTranslation('startFreshModal')
  const [step, setStep] = useState(0)
  const [cvOptions, setCvOptions] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedCvId, setSelectedCvId] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [jobExtractionData, setJobExtractionData] = useState(null)
  const [showJobExtractionModal, setShowJobExtractionModal] = useState(false)
  const jobExtractionCallbackRef = useRef(null)

  const fetchCVs = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/get-cvs?user_id=${user_id}`)
      const data = await res.json()
      if (Array.isArray(data)) {
        const sortedData = data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        const options = sortedData.map(cv => ({
          id: cv.id,
          name: cv.filename,
          uploadedAt: cv.created_at,
          created_at: cv.created_at
        }))
        setCvOptions(options)
        setSelectedCvId(options.length > 0 ? options[0].id : '')
      }
    } catch (error) {
      console.error('Failed to fetch CVs:', error)
      alert(t('fetchError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user_id) {
      fetchCVs()
    }
  }, [user_id])

  const onJobExtracted = (extraction) => {
    return new Promise((resolve, reject) => {
      setJobExtractionData(extraction)
      jobExtractionCallbackRef.current = { resolve, reject }
      setShowJobExtractionModal(true)
    })
  }

  const handleJobExtractionConfirm = (confirmed) => {
    setShowJobExtractionModal(false)
    jobExtractionCallbackRef.current?.resolve(confirmed)
    jobExtractionCallbackRef.current = null
  }

  const handleJobExtractionCancel = () => {
    setShowJobExtractionModal(false)
    const err = new Error('cancelled')
    err.cancelled = true
    jobExtractionCallbackRef.current?.reject(err)
    jobExtractionCallbackRef.current = null
  }

  const handleGenerateAnalysis = async (cvId, jobDesc) => {
    setLoading(true)
    try {
      const selectedCv = cvOptions.find(cv => cv.id === cvId)
      const rawJobText = jobDesc && jobDesc.trim() !== '' ? jobDesc.trim() : undefined
      const resolvedJobText = rawJobText ? await resolveJobText(rawJobText) : undefined
      const { analysis } = await uploadAndAnalyze({
        user_id,
        created_at: selectedCv?.created_at,
        file_name: selectedCv?.name || 'Unnamed file',
        jobText: resolvedJobText,
        onJobExtracted,
        deep: true,
      })

      window.dispatchEvent(new CustomEvent('new-analysis', {
        detail: { analysis, startFresh: true }
      }))
      onStartFresh()
      onClose()
    } catch (error) {
      if (error.cancelled) return
      console.error(t('analysisError'), error)
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {step === 0 && (
        <StartFreshHeader mode="start" onClose={() => { setStep(0); onClose() }}>
          <div className="flex space-x-4 mt-6">
            <button
              className="flex-1 bg-white border border-gray-200 px-4 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              onClick={() => setStep(1)}
            >
              {t('continueUploaded')}
            </button>
            <button
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
              onClick={() => setStep(2)}
            >
              {t('continueNew')}
            </button>
          </div>
        </StartFreshHeader>
      )}

      {step === 1 && (
        <StartFreshDbModal
          user_id={user_id}
          cvOptions={cvOptions}
          selectedCvId={selectedCvId}
          setSelectedCvId={setSelectedCvId}
          jobDescription={jobDescription}
          setJobDescription={setJobDescription}
          loading={loading}
          onSubmit={handleGenerateAnalysis}
          onStartFresh={onStartFresh}
          onBack={() => setStep(0)}
          onClose={() => { setStep(0); onClose() }}
        />
      )}

      {step === 2 && (
        <StartFreshUploadModal
          user_id={user_id}
          onBack={() => setStep(0)}
          onClose={() => { setStep(0); onClose() }}
        />
      )}

      {showJobExtractionModal && jobExtractionData && (
        <JobExtractionModal
          extraction={jobExtractionData}
          onConfirm={handleJobExtractionConfirm}
          onCancel={handleJobExtractionCancel}
        />
      )}
    </>
  )
}
