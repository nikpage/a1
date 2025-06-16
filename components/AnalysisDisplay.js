// components/AnalysisDisplay.js
import React from 'react'

export default function AnalysisDisplay({ analysis, error }) {
  if (error) return <div className="error">{error}</div>
  if (!analysis) return <div>No analysis to display.</div>

  // Naive but effective formatting: convert headings, --- dividers, and numbers/bullets to HTML
  let formatted = analysis
    .replace(/^###\s+\*\*(.+)\*\*/gm, '<h3>$1</h3>')
    .replace(/^####\s+\*\*(.+)\*\*/gm, '<h4>$1</h4>')
    .replace(/\*\*(.+)\*\*/g, '<b>$1</b>')
    .replace(/---/g, '<hr />')
    .replace(/\n\d+\.\s+/g, '<br />• ')
    .replace(/\n✅/g, '<br />✅')
    .replace(/\n/g, '<br />')

  return (
    <div className="analysis" dangerouslySetInnerHTML={{ __html: formatted }} />
  )
}
