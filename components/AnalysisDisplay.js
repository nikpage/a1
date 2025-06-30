// path: components/AnalysisDisplay.js

import React from 'react';

export default function AnalysisDisplay({ analysis }) {
  if (!analysis) return null;

  // Remove CV and Cover sections if present
  const cleanAnalysis = analysis
    .replace(/--- Generated CV ---[\s\S]*?(?=---|$)/g, '')
    .replace(/--- Cover Letter ---[\s\S]*?(?=---|$)/g, '');

  return (
    <div className="bg-white p-4 rounded shadow whitespace-pre-wrap">
      {cleanAnalysis.trim()}
    </div>
  );
}
