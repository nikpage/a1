// path: pages/index.js

import { useState } from 'react'
import { useRouter } from 'next/router'
import Header from '../components/Header'

export default function IndexPage() {
  const router = useRouter()
  const [file, setFile] = useState(null)
  const [jobText, setJobText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleUploadAndAnalyze = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const uploadRes = await fetch('/api/upload-cv', {
        method: 'POST',
        body: formData,
      })
      const uploadData = await uploadRes.json()

      if (!uploadRes.ok || !uploadData.user_id) {
        setError(uploadData.error || 'Upload failed')
        setLoading(false)
        return
      }

      const analyzeRes = await fetch('/api/analyze-cv-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: uploadData.user_id,
          jobText,
        }),
      })

      const analyzeData = await analyzeRes.json()

      if (!analyzeRes.ok || analyzeData.error) {
        setError(analyzeData.error || 'Analysis failed')
        setLoading(false)
        return
      }

      router.push(`/${uploadData.user_id}`)
    } catch (err) {
      setError('Error: ' + err.message)
    }

    setLoading(false)
  }

  return (
    <>
      <Header />
      <main className="max-w-xl mx-auto px-4 py-12 text-center">
        <h1 className="text-4xl font-light mb-10 text-slate-800">The CV Pro</h1>

        <form onSubmit={handleUploadAndAnalyze} className="flex flex-col gap-6 items-center">
          <div
            onClick={() => document.getElementById('file-input').click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const droppedFile = e.dataTransfer.files[0]
              if (droppedFile) setFile(droppedFile)
            }}
            className="w-full max-w-sm border-2 border-dashed border-gray-300 rounded-lg p-6 text-gray-500 text-sm bg-white cursor-pointer"
          >
            {file ? file.name : 'Drag & drop PDF here or click to choose'}
            <input
              id="file-input"
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files[0])}
              className="hidden"
            />
          </div>

          <textarea
            placeholder="Paste job description (optional)"
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            rows={6}
            className="w-full max-w-sm border border-gray-300 rounded-lg p-3 text-sm"
          />

          <button
            type="submit"
            disabled={loading || !file}
            className="action-btn w-full max-w-sm"
          >
            {loading ? 'Uploading & Analyzing…' : 'Upload & Analyze'}
          </button>

          {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
        </form>
      </main>
    </>
  )
}
