// pages/[user_id].js
import { useState, useEffect } from 'react'
import AnalysisDisplay from '../components/AnalysisDisplay'
import JobAdInput from '../components/JobAdInput'
import DocumentGenerator from '../components/DocumentGenerator'
import CopyableText from '../components/CopyableText'

export default function SessionPage({ user_id }) {
  const [analysis, setAnalysis] = useState(null)
  const [jobText, setJobText] = useState('')
  const [docs, setDocs] = useState(null)
  const [tokens, setTokens] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/analyze-cv-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id })
    })
      .then(r => r.json())
      .then(d => d.analysis ? setAnalysis(d.analysis) : setError(d.error || ''))
    fetch(`/api/tokens?user_id=${user_id}`)
      .then(r => r.json())
      .then(d => d.tokens ? setTokens(d.tokens) : setTokens(0))
  }, [user_id])

  const handleDocs = (data) => setDocs(data)
  const handleTokens = (t) => setTokens(t)

  const handleDownload = async (text, type) => {
    if (tokens < 1) return
    const blob = new Blob([text], { type: 'text/plain' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${type.replace(/\s+/g, '_').toLowerCase()}.txt`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
    // Call API to decrement token
    const res = await fetch('/api/decrement-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id })
    })
    const data = await res.json()
    setTokens(data.tokens || 0)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center">
      <div className="w-full max-w-2xl p-6 bg-white rounded-2xl shadow-lg flex flex-col gap-6 mt-8">
        <AnalysisDisplay analysis={analysis} error={error} />
        <JobAdInput jobText={jobText} setJobText={setJobText} />
        <DocumentGenerator user_id={user_id} jobText={jobText} setDocs={handleDocs} tokens={tokens} setTokens={handleTokens} setError={setError} />
        {docs?.choices?.[0]?.message?.content && (
          <CopyableText
            text={docs.choices[0].message.content}
            label="CV"
            canDownload={tokens > 0}
            onDownload={handleDownload}
            tokens={tokens}
          />
        )}
        {docs?.choices?.[1]?.message?.content && (
          <CopyableText
            text={docs.choices[1].message.content}
            label="Cover Letter"
            canDownload={tokens > 0}
            onDownload={handleDownload}
            tokens={tokens}
          />
        )}
        {error && <div className="text-red-500 text-center">{error}</div>}
        <div className="text-right font-semibold">Tokens: <span className={tokens > 0 ? 'text-green-600' : 'text-red-600'}>{tokens}</span></div>
      </div>
    </div>
  )
}

export async function getServerSideProps({ params }) {
  return { props: { user_id: params.user_id } }
}
