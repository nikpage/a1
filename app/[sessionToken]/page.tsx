// app/[sessionToken]/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { CVAnalysis, GeneratedDocuments } from '../../types'
import JobAdInput from '../components/JobAdInput'
import AnalysisDisplay from '../components/AnalysisDisplay'
import DocumentGenerator from '../components/DocumentGenerator'
import TokenCounter from '../components/TokenCounter'

export default function SessionPage() {
  const params = useParams()
  const sessionToken = params.sessionToken as string

  const [tokens, setTokens] = useState(3)
  const [jobAd, setJobAd] = useState('')
  const [analysis, setAnalysis] = useState<CVAnalysis | null>(null)
  const [documents, setDocuments] = useState<GeneratedDocuments | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Add validation for sessionToken before making API call
    if (sessionToken && sessionToken !== 'undefined') {
      fetchSessionData()
    } else {
      setError('Invalid session token')
    }
  }, [sessionToken])

  const fetchSessionData = async () => {
    // Double-check sessionToken before API call
    if (!sessionToken || sessionToken === 'undefined') {
      setError('No valid session token found')
      return
    }

    try {
      console.log('Fetching session data for token:', sessionToken) // Debug log
      const response = await fetch(`/api/session/${sessionToken}`)
      if (!response.ok) throw new Error('Session not found')

      const data = await response.json()
      setTokens(data.tokens)
    } catch (err) {
      console.error('Error fetching session data:', err) // Debug log
      setError('Session not found or expired')
    }
  }

  const handleAnalyze = async () => {
    if (tokens <= 0) {
      setError('No tokens remaining')
      return
    }

    if (!sessionToken || sessionToken === 'undefined') {
      setError('Invalid session token')
      return
    }

    setIsAnalyzing(true)
    setError(null)

    try {
      console.log('Analyzing CV for session:', sessionToken) // Debug log
      const response = await fetch('/api/analyze-cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken,
          jobAd: jobAd.trim() || null
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Analysis API error:', response.status, errorText) // Debug log
        throw new Error('Analysis failed')
      }

      const data = await response.json()
      setAnalysis(data.analysis)
      setTokens(data.remainingTokens)
    } catch (err) {
      console.error('Analysis error:', err) // Debug log
      setError('Analysis failed. Please try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleGenerateDocuments = async () => {
    if (!analysis || tokens <= 0) return

    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch('/api/generate-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken,
          analysis,
          jobAd: jobAd.trim() || null
        })
      })

      if (!response.ok) throw new Error('Document generation failed')

      const data = await response.json()
      setDocuments(data.documents)
    } catch (err) {
      setError('Document generation failed. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  // Show loading state while sessionToken is being resolved
  if (!sessionToken) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading session...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">CV Analysis Dashboard</h1>
          <TokenCounter tokens={tokens} />
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        <div className="space-y-8">
          <JobAdInput
            value={jobAd}
            onChange={setJobAd}
            onAnalyze={handleAnalyze}
            isAnalyzing={isAnalyzing}
            disabled={tokens <= 0}
          />

          {analysis && (
            <AnalysisDisplay analysis={analysis} />
          )}

          {analysis && (
            <DocumentGenerator
              onGenerate={handleGenerateDocuments}
              isGenerating={isGenerating}
              hasDocuments={!!documents}
            />
          )}

          {documents && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-semibold mb-4">Optimized CV</h3>
                <div className="bg-gray-50 p-4 rounded border">
                  <pre className="whitespace-pre-wrap text-sm">{documents.optimized_cv}</pre>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(documents.optimized_cv)}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Copy CV
                </button>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-semibold mb-4">Cover Letter</h3>
                <div className="bg-gray-50 p-4 rounded border">
                  <pre className="whitespace-pre-wrap text-sm">{documents.cover_letter}</pre>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(documents.cover_letter)}
                  className="mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Copy Cover Letter
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
