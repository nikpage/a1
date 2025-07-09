// path: components/CVUploader.js

import { useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { uploadAndAnalyze } from '../utils/uploadAndAnalyze'


export default function CVUploader({ user_id, onUpload, selectedCv }) {
  const inputRef = useRef()
  const router = useRouter()
  const [file, setFile] = useState(null)
  const [fileName, setFileName] = useState('')
  const [jobText, setJobText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const handleFileChange = (f) => {
    setError('')
    if (!f || f.type !== 'application/pdf' || f.size > 200 * 1024) {
      setError('PDF only, max 200KB')
      setFile(null)
      setFileName('')
      return
    }
    setFile(f)
    setFileName(f.name)
  }



  async function handleUpload() {
    if (!file) {
      setError('No file selected')
      return
    }

    setUploading(true)
    setError('')

    try {
      const result = await uploadAndAnalyze({
        file,
        jobText,
        user_id: user_id || localStorage.getItem('user_id'),
        fallbackCvText: null,
        fallbackCreatedAt: null,
      })


      if (typeof onUpload === 'function') {
        onUpload()
      } else {
        router.push(`/${result.user_id}`)
      }

    } catch (err) {
      console.error(err)
      setError(err.message || 'Upload or analysis failed')
    }

    setUploading(false)
  }

  return (
    <form
      className="flex flex-col gap-4 w-full max-w-md mx-auto"
      onSubmit={e => {
        e.preventDefault()
        handleUpload()
      }}
    >
      <div className="flex flex-col">
        <span className="font-semibold mb-1">Select your CV (PDF, max 200KB)</span>
        <input
          type="file"
          accept="application/pdf"
          ref={inputRef}
          className="hidden real-file-input"
          onChange={e => handleFileChange(e.target.files[0])}
          disabled={uploading}
        />
        <button
          type="button"
          className="w-full py-2 mt-2 rounded-xl bg-blue-600 text-white font-bold"
          onClick={() => inputRef.current.click()}
          disabled={uploading}
        >
          Choose File
        </button>
        {fileName && <div className="text-gray-700 mt-1 text-sm">{fileName}</div>}
      </div>

      <div className="flex flex-col">
        <label className="font-semibold mb-1">Paste Job Description (optional)</label>
        <textarea
          className="w-full mt-2 p-2 rounded-xl border border-gray-300 font-normal"
          placeholder="Paste job ad here"
          value={jobText}
          onChange={e => setJobText(e.target.value)}
          disabled={uploading}
          rows={4}
        />
      </div>

      <button
        type="submit"
        className="w-full py-2 rounded-xl bg-green-600 text-white font-bold disabled:bg-gray-400"
        disabled={(!file && !selectedCv) || uploading}
      >
        {uploading ? 'Uploading...' : 'Upload'}
      </button>

      {error && <div className="text-red-500 text-center w-full">{error}</div>}

      <style jsx>{`
        .real-file-input {
          display: none !important;
          visibility: hidden !important;
          width: 0 !important;
          height: 0 !important;
          position: absolute !important;
          pointer-events: none !important;
        }
      `}</style>
    </form>
  )
}
