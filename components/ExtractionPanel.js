// components/ExtractionPanel.js
import { useState } from 'react';

export default function ExtractionPanel({ onExtract }) {
  const [jobText, setJobText] = useState('');
  const [loading, setLoading] = useState(false);
  const [metadata, setMetadata] = useState(null);
  const [toggles, setToggles] = useState({});

  const handleExtract = async () => {
    if (!jobText.trim()) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/extract-job-meta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: jobText }),
      });
      const data = await response.json();
      setMetadata(data);
      const initToggles = {};
      Object.keys(data).forEach((key) => {
        initToggles[key] = true;
      });
      setToggles(initToggles);
      onExtract && onExtract(data, initToggles);
    } catch (err) {
      console.error('Extraction error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (field) => {
    setToggles((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <div>
      <h2>Extract Job Metadata</h2>
      <textarea
        rows={6}
        placeholder="Paste the job description here..."
        value={jobText}
        onChange={(e) => setJobText(e.target.value)}
      />
      <button onClick={handleExtract} disabled={loading || !jobText.trim()}>
        {loading ? 'Extracting...' : 'Extract Metadata'}
      </button>

      {metadata && (
        <div>
          <h3>Extracted Fields</h3>
          <ul>
            {Object.entries(metadata).map(([key, value]) => (
              <li key={key}>
                <input
                  type="checkbox"
                  checked={toggles[key]}
                  onChange={() => handleToggle(key)}
                />
                <strong>{key}:</strong> {value}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
