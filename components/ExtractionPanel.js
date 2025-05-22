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
      if (data.keywords && Array.isArray(data.keywords)) {
        data.keywords.forEach((_, idx) => {
          initToggles[`keywords_${idx}`] = true;
        });
      }
      Object.keys(data).forEach((key) => {
        if (key !== 'keywords') initToggles[key] = true;
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

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '1rem' }}>
        <textarea
          rows={6}
          style={{ flex: 1 }}
          value={jobText}
          onChange={(e) => setJobText(e.target.value)}
        />
        <button onClick={handleExtract} disabled={loading || !jobText.trim()}>
          {loading ? 'Extracting...' : 'Extract Metadata'}
        </button>
      </div>

      {metadata && (
        <div>
          <h3>Extracted Fields</h3>
          <ul>
            {Object.entries(metadata).map(([key, value]) => {
              if (key === 'keywords' && Array.isArray(value)) {
                return (
                  <li key={key}>
                    <strong>{key}:</strong>
                    <ul>
                      {value.map((kw, idx) => (
                        <li key={idx}>
                          <input
                            type="checkbox"
                            checked={toggles[`keywords_${idx}`]}
                            onChange={() => handleToggle(`keywords_${idx}`)}
                          />
                          <input
                            type="text"
                            value={kw}
                            onChange={(e) => {
                              const newKeywords = [...value];
                              newKeywords[idx] = e.target.value;
                              const newMetadata = { ...metadata, keywords: newKeywords };
                              setMetadata(newMetadata);
                              onExtract && onExtract(newMetadata, toggles);
                            }}
                          />
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              }

              return (
                <li key={key}>
                  <input
                    type="checkbox"
                    checked={toggles[key]}
                    onChange={() => handleToggle(key)}
                  />
                  <strong>{key}:</strong>{' '}
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => {
                      const newMetadata = { ...metadata, [key]: e.target.value };
                      setMetadata(newMetadata);
                      onExtract && onExtract(newMetadata, toggles);
                    }}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
