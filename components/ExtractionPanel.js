import { useState } from 'react';

export default function ExtractionPanel({ onExtract }) {
  const [jobText, setJobText] = useState('');
  const [loading, setLoading] = useState(false);
  const [metadata, setMetadata] = useState(null);
  const [toggles, setToggles] = useState({
    includeCV: true,
    includeCover: true,
  });

  const handleExtract = async () => {
    if (!jobText.trim()) {
      alert('Please paste the job description first.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/extract-job-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: jobText }),
      });
      const data = await response.json();
      if (!data || typeof data !== 'object') throw new Error('Empty or invalid response');

      const initialToggles = {
        includeCV: true,
        includeCover: true,
      };

      Object.keys(data).forEach((key) => {
        if (key === 'keywords' && Array.isArray(data.keywords)) {
          data.keywords.forEach((_, idx) => {
            initialToggles[`keywords_${idx}`] = true;
          });
        } else {
          initialToggles[key] = true;
        }
      });

      setMetadata(data);
      setToggles(initialToggles);
      onExtract(data, initialToggles);
    } catch (err) {
      console.error('Extraction error:', err);
      alert('Failed to extract metadata');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (field) => {
    const updated = { ...toggles, [field]: !toggles[field] };
    setToggles(updated);
    onExtract(metadata, updated);
  };

  const handleFieldChange = (field, value) => {
    const updatedMeta = { ...metadata, [field]: value };
    setMetadata(updatedMeta);
    onExtract(updatedMeta, toggles);
  };

  return (
    <div style={{ paddingLeft: '1rem' }}>
      <textarea
        value={jobText}
        onChange={(e) => setJobText(e.target.value)}
        rows={6}
        placeholder="Paste job description here"
      />
      <br />

      <button onClick={handleExtract} disabled={loading}>
        {loading ? 'Extracting...' : 'Extract Metadata'}
      </button>

      {metadata && (
        <div>
          <h3>Extracted Metadata</h3>
          <div>
            {Object.entries(metadata).map(([key, value]) => {
              if (key === 'keywords' && Array.isArray(value)) {
                return value.map((kw, idx) => (
                  <div key={`keyword-${idx}`}>
                    <label>
                      <strong>Keyword:</strong>
                      <input
                        type="checkbox"
                        checked={toggles[`keywords_${idx}`]}
                        onChange={() => handleToggle(`keywords_${idx}`)}
                      />
                      <input
                        type="text"
                        value={kw ?? ''}
                        onChange={(e) => {
                          const newKeywords = [...value];
                          newKeywords[idx] = e.target.value;
                          const updated = { ...metadata, keywords: newKeywords };
                          setMetadata(updated);
                          onExtract(updated, toggles);
                        }}
                      />
                    </label>
                  </div>
                ));
              }

              const labelMap = {
                jobTitle: 'Job Title:',
                company: 'Company:',
                hrContact: 'HR Contact:',
              };

              const label = labelMap[key] || key;

              return (
                <div key={key}>
                  <label>
                    <strong>{label}</strong>
                    <input
                      type="checkbox"
                      checked={toggles[key]}
                      onChange={() => handleToggle(key)}
                    />
                    <input
                      type="text"
                      value={value ?? ''}
                      onChange={(e) => handleFieldChange(key, e.target.value)}
                    />
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
