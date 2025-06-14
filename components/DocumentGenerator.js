import { useState } from 'react'

export default function DocumentGenerator({ user_id, jobText, setDocs, tokens, setTokens, setError }) {
  const [loading, setLoading] = useState(false)
  return (
    <div>
      <button
        className="py-2 px-4 rounded-xl bg-green-600 text-white font-bold w-full"
        disabled={loading || tokens < 1 || !jobText}
        onClick={async () => {
          setError('')
          setLoading(true)
          const res = await fetch('/api/generate-cv-cover', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id, jobText })
          })
          const data = await res.json()
          setLoading(false)
          if (data.docs) {
            setDocs(data.docs)
            setTokens(tokens - 1)
          } else setError(data.error || 'Generation failed')
        }}
      >
        {loading ? 'Generating...' : 'Generate Optimized CV & Cover Letter'}
      </button>
    </div>
  )
}
