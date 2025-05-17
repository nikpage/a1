import React, { useState } from 'react';
import { post } from '../services/api.js';

export default function JobInput({ onAnalyze }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const metadata = await post('/api/analyze-job', { text });
      onAnalyze(metadata);
    } catch (err) {
      setError(err.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="job-input">
      <h2>Paste Job Description</h2>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Paste the full job description here..."
        rows={10}
        style={{ width: '100%' }}
      />
      {error && <p className="error">{error}</p>}
      <button
        onClick={handleAnalyze}
        disabled={!text.trim() || loading}
        className={loading ? 'loading' : ''}
      >
        {loading ? 'Analyzing...' : 'Analyze Job'}
      </button>
    </div>
  );
}
