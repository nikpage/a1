// components/JobAdInput.tsx
'use client';
import { useState } from 'react';

export default function JobAdInput({
  sessionToken,
}: {
  sessionToken: string;
}) {
  const [jobAd, setJobAd] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!jobAd) return;
    setLoading(true);

    const res = await fetch('/api/analyze-cv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken, jobAd }),
    });

    const data = await res.json();
    setAnalysis(data.analysis || 'No analysis available');
    setLoading(false);
  };

  return (
    <div className="mt-6">
      <h2 className="text-lg font-semibold mb-2">Job Ad Input</h2>
      <textarea
        value={jobAd}
        onChange={(e) => setJobAd(e.target.value)}
        placeholder="Paste job description here..."
        className="w-full p-2 border rounded mb-2"
        rows={4}
      />
      <button
        onClick={handleAnalyze}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        {loading ? 'Analyzing...' : 'Analyze & Match'}
      </button>

      {analysis && (
        <div className="mt-4 p-4 bg-gray-100 rounded whitespace-pre-wrap">
          {analysis}
        </div>
      )}
    </div>
  );
}
