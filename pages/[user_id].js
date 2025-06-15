
// pages/[user_id].js

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

export default function UserAnalysisPage() {
  const router = useRouter()
  const { user_id } = router.query
  const [analysis, setAnalysis] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user_id) return // Wait for router to be ready
    fetch('/api/analyze-cv-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id, skipAnalysis: false })
    })
      .then(res => res.json())
      .then(data => {
        console.log('API response:', data)
        if (data.error) setError(data.error)
        else setAnalysis(data.analysis)
      })
      .catch((err) => {
        console.error('Fetch error:', err)
        setError('Failed to fetch analysis')
      })
  }, [user_id])

  if (error) return <div>Error: {error}</div>
  if (!analysis) return <div>Loading analysis…</div>

  return (
    <div>
      <h2>CV Analysis</h2>
      <div>{analysis}</div>
    </div>
  )
}
