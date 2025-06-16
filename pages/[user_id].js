import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import AnalysisDisplay from '../components/AnalysisDisplay'

export default function UserAnalysisPage() {
  const router = useRouter()
  const { user_id } = router.query

  const [jobText, setJobText] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user_id) return

    fetch('/api/analyze-cv-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id, jobText })
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setAnalysis(data.analysis)
      })
      .catch(err => setError('Fetch error: ' + err.message))
  }, [user_id, jobText])

  if (error) return <div>Error: {error}</div>
  if (!analysis) return <div>Loading analysis…</div>

  return (
    <div>
      <textarea
        placeholder="Paste job description here"
        value={jobText}
        onChange={e => setJobText(e.target.value)}
        rows={6}
        style={{ width: '100%', marginBottom: '1rem' }}
      />
      <AnalysisDisplay analysis={analysis} />
    </div>
  )
}
