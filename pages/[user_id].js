//pages/[user_id].js

import { useEffect, useState } from 'react'

export default function SessionPage({ user_id }) {
  const [analysis, setAnalysis] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/analyze-cv-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id, skipAnalysis: false })
    })
      .then(r => r.json())
      .then(d => d.analysis ? setAnalysis(d.analysis) : setError(d.error || 'Analysis failed'))
  }, [user_id])

  if (error) return <div className="text-red-500">{error}</div>
  if (!analysis) return <div>Loading…</div>
  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="font-bold text-xl mb-2">Your CV Analysis</h2>
      <pre className="bg-gray-100 rounded p-3 whitespace-pre-wrap">{analysis}</pre>
    </div>
  )
}

SessionPage.getInitialProps = async ({ query }) => {
  return { user_id: query.user_id }
}
