//components/AnalysisDisplay.js

import React from 'react'
import ReactMarkdown from 'react-markdown'

export default function AnalysisDisplay({ analysis, error }) {
  if (error) return <div className="text-red-500">{error}</div>
  if (!analysis) return <div>Analyzing CV...</div>
  let text = typeof analysis === 'string'
    ? analysis
    : (analysis.choices?.[0]?.message?.content || JSON.stringify(analysis))
  return (
    <div className="border rounded-xl p-3 bg-gray-100 prose prose-sm max-w-none whitespace-pre-wrap">
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  )
}
