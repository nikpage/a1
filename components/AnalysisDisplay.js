//components/AnalysisDisplay.js
import React from 'react'
import ReactMarkdown from 'react-markdown'

function cvTextToMarkdown(text) {
  if (!text) return ''
  return text
    .replace(/(Page \d+ of \d+)/g, '\n\n**$1**\n')
    .replace(/^([A-Z][A-Za-z ]{3,30}:)/gm, '\n**$1**')
    .replace(/^([A-Z][A-Za-z ]{3,30})\n/gm, '\n**$1**\n')
    .replace(/^\s*[\u2022\-\*]\s?/gm, '\n- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export default function AnalysisDisplay({ analysis, error }) {
  if (error) return <div className="text-red-500">{error}</div>
  if (!analysis) return <div>Analyzing CV...</div>
  let text = typeof analysis === 'string'
    ? analysis
    : (analysis.choices?.[0]?.message?.content || JSON.stringify(analysis))
  return (
    <div className="border rounded-xl p-3 bg-gray-100 prose prose-sm max-w-none whitespace-pre-wrap">
      <ReactMarkdown>{cvTextToMarkdown(text)}</ReactMarkdown>
    </div>
  )
}
