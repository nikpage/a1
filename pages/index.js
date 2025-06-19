// pages/index.js

import { useState } from 'react'
import { useRouter } from 'next/router'

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

    console.log('Making upload request...'); // Debug log
    const uploadRes = await fetch('/api/upload-cv', { method: 'POST', body: formData })
    const uploadData = await uploadRes.json()

    console.log('Upload response:', uploadRes.status, uploadData); // Debug log

    if (!uploadRes.ok || !uploadData.user_id) {
      setError(uploadData.error || 'Upload failed')
      setLoading(false)
      return
    }

    console.log('Making analysis request with user_id:', uploadData.user_id); // Debug log
    console.log('Calling analyze-cv-job with:', uploadData.user_id, jobText)
const analyzeRes = await fetch('/api/analyze-cv-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: uploadData.user_id,
        jobText,
      }),
    })

    console.log('Analysis response status:', analyzeRes.status); // Debug log
    const analyzeData = await analyzeRes.json()
    console.log('Analysis response data:', analyzeData); // Debug log

    if (!analyzeRes.ok || analyzeData.error) {
      setError(analyzeData.error || 'Analysis failed')
      setLoading(false)
      return
    }

    router.push(`/${uploadData.user_id}`)
  } catch (err) {
    console.error('Caught error:', err); // Debug log
    setError('Error: ' + err.message)
  }
  setLoading(false)
}
  return (
    <main style={{ maxWidth: 600, margin: '2rem auto', textAlign: 'center' }}>
      <h1>The CV Pro</h1>
      <form onSubmit={handleUploadAndAnalyze}>
        <input type="file" accept="application/pdf" onChange={e => setFile(e.target.files[0])} />
        <textarea
          placeholder="Paste job description (optional)"
          value={jobText}
          onChange={e => setJobText(e.target.value)}
          rows={6}
          style={{ width: '100%' }}
        />
        <button type="submit" disabled={loading || !file}>
          {loading ? 'Uploading & Analyzing…' : 'Upload & Analyze'}
        </button>
      </form>
      {error && <div style={{ color: 'red', marginTop: 16 }}>{error}</div>}
    </main>
  )
}
