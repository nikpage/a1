// path: components/StartFreshModal.js
import { useState, useEffect } from 'react'
import BaseModal from './BaseModal'
import CVUploader from './CVUploader'

export default function StartFreshModal({ user_id, onClose, onSubmit }) {
  const [step, setStep] = useState(1)
  const [jobText, setJobText] = useState('')
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

  const handleGenerate = async () => {
    const selectedCv = cvOptions.find(cv => cv.cv_data === cvText)
    if (!selectedCv) return alert('No CV selected')

    setLoading(true)
    try {
      await uploadAndAnalyze({
        file: null,
        jobText,
        user_id,
        fallbackCvText: selectedCv.cv_data,
        fallbackCreatedAt: selectedCv.created_at,
      })
      onClose()
    } catch (err) {
      alert(err.message || 'Analysis failed')
    }
    setLoading(false)
  }


  return (
    <BaseModal onClose={onClose} showCloseButton={false}>

      <h2 className="text-xl font-semibold mb-4">Start Fresh</h2>

      {step === 1 && (
    <>
      <p className="text-sm mb-6 leading-relaxed text-gray-700">
        <span className="font-semibold text-yellow-600">⚠️ WARNING:</span><br />
        This will delete your current Analyses and CV & Cover Letter. Please Cancel and download any documents you want to keep.
        <br /><br />
        Start Fresh when you want to apply for a different job with a new CV and/or Cover Letter.
      </p>

      <div className="flex justify-center gap-4 mt-6">

        <button className="border border-gray-300 px-4 py-2 rounded text-sm" onClick={onClose}>Cancel</button>
        <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm" onClick={() => setStep(2)}>Start Fresh</button>
      </div>
    </>
  )}



  {step === 2 && (
  <>
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold">Saved CVs</h3>
        <span className="text-sm text-gray-600">Uploaded</span>
      </div>

      <select
        className="w-full border border-gray-300 rounded-lg p-2 text-sm mb-4"
        value={cvText}
        onChange={(e) => setCvText(e.target.value)}
      >
        {cvOptions.map((cv) => (
          <option key={cv.created_at} value={cv.cv_data || ''}>
            {new Date(cv.created_at).toLocaleString('en-GB', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }).replace(',', '')}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-4 mb-6">
      <CVUploader user_id={user_id} onUpload={fetchCVs} compact selectedCv={cvText} />
        <span className="text-sm text-gray-700 whitespace-nowrap">Select your CV (PDF, max 200KB)</span>
      </div>


    </div>
  </>
)}



    </BaseModal>
  )
}
