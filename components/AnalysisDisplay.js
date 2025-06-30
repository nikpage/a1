// path: components/AnalysisDisplay.js
import React from 'react';

export default function AnalysisDisplay({ analysis }) {
  if (!analysis) return null;

  const cleanAnalysis = analysis
    .replace(/--- Generated CV ---[\s\S]*?(?=---|$)/g, '')
    .replace(/--- Cover Letter ---[\s\S]*?(?=---|$)/g, '')
    .replace(/^#+\s*Extracted CV Metadata\s*/gim, '')
    .replace(/^#+\s*Extracted Job Metadata\s*/gim, '')
    .replace(/^#+\s*Step\s*\d+:\s*.*$/gim, '')
    .replace(/^---+$/gm, '')
    .replace(/\*\*/g, '') // remove bold markers
    .replace(/:\s*\n+/g, ': ') // join label and value
    .replace(/\n{3,}/g, '\n\n'); // max 1 empty line

    return (
      <div
        className="doc-viewer"
        style={{
          lineHeight: '1.6',
          fontSize: '0.95rem',
          whiteSpace: 'pre-wrap',
        }}
        dangerouslySetInnerHTML={{
          __html: cleanAnalysis
            .replace(/^### (.+)$/gm, '<h2 style="margin-top:1.5rem; font-size:1.1rem;">$1</h2>')
            .replace(/^- ([^:]+):/gm, '<div style="margin-left:1rem;"><strong>$1:</strong>')
            .replace(/^(?!<h2|<div)([^:\n]+):/gm, '<div style="margin-top:0.4rem;"><strong>$1:</strong>')
            .replace(/\n/g, '</div>')
        }}
      />
    );

}
