// components/cardJobMeta.js

import { useState } from 'react';

export default function cardJobMeta({ onExtract, userId }) {
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

    if (!userId || typeof userId !== 'string' || userId.length !== 36) {
      alert('User ID is missing or invalid.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/extract-job-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: jobText,
          userId,
        }),
      });
      const data = await response.json();

      if (!data || typeof data !== 'object') throw new Error('Empty or invalid response');

      const confidenceOrder = { high: 3, medium: 2, low: 1 };
      if (Array.isArray(data.suggestedKeywords)) {
        data.suggestedKeywords.sort(
          (a, b) => (confidenceOrder[b.confidence] ?? 0) - (confidenceOrder[a.confidence] ?? 0)
        );
      }

      const initialToggles = {
        includeCV: true,
        includeCover: true,
      };

      if (data.suggestedKeywords) {
        data.suggestedKeywords.forEach((kwObj, idx) => {
          initialToggles[`suggested_${idx}`] = kwObj.confidence === 'high';
        });
      }

      if (data.jobKeywords) {
        data.jobKeywords.forEach((_, idx) => {
          initialToggles[`job_${idx}`] = false;
        });
      }

      if (data.cvKeywords) {
        data.cvKeywords.forEach((_, idx) => {
          initialToggles[`cv_${idx}`] = false;
        });
      }

      Object.keys(data).forEach((key) => {
        if (!['suggestedKeywords', 'cvKeywords', 'jobKeywords'].includes(key)) {
          initialToggles[key] = true;
        }
      });

      setMetadata(data);
      setToggles(initialToggles);
      onExtract(data, initialToggles);

      if (!userId || typeof userId !== 'string' || userId.length !== 36) {
  console.error('❌ Invalid or missing userId in handleExtract:', userId);
  return;
}
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

  const handleKeywordChange = (type, idx, value) => {
    const updated = [...metadata[type]];
    updated[idx] = value;
    const updatedMeta = { ...metadata, [type]: updated };
    setMetadata(updatedMeta);
    onExtract(updatedMeta, toggles);
  };

  const handleSuggestedChange = (idx, value) => {
    const updated = [...metadata.suggestedKeywords];
    updated[idx].keyword = value;
    const updatedMeta = { ...metadata, suggestedKeywords: updated };
    setMetadata(updatedMeta);
    onExtract(updatedMeta, toggles);
  };

  const getConfidenceStyle = (confidence) => {
    switch (confidence) {
      case 'high':
        return { color: 'rgb(70, 198, 128)', fontWeight: 'bold' };
      case 'medium':
        return { color: 'rgb(11, 75, 127)', fontWeight: 'bold' };
      case 'low':
        return { color: '#d2b48c', fontWeight: 'bold' };
      default:
        return {};
    }
  };

  const capitalizeFirstLetter = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
  };

  return (
    <div style={{ paddingLeft: '1rem' }}>
      <textarea
        value={jobText}
        onChange={(e) => setJobText(e.target.value)}
        rows={6}
        placeholder="Paste job description here"
        style={{ width: '100%' }}
      />
      <br />

      <button onClick={handleExtract} disabled={loading}>
        {loading ? 'Extracting...' : 'Extract Metadata'}
      </button>

      {metadata && (
<>

<h3>Career Analysis</h3>
<div style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ddd' }}>

  {/* Career Distance */}
  <div style={{ marginBottom: '1rem' }}>
    <label><strong>Career Distance:</strong></label>
    <select
      value={metadata.careerAnalysis?.careerDistance || ''}
      onChange={(e) => handleFieldChange('careerAnalysis', {
        ...metadata.careerAnalysis,
        careerDistance: e.target.value
      })}
      style={{ marginLeft: '0.5rem' }}
    >
      <option value="">Select...</option>
      <option value="low">Low</option>
      <option value="medium">Medium</option>
      <option value="high">High</option>
    </select>
  </div>

  {/* Scenarios */}
  <div style={{ marginBottom: '1rem' }}>
    <label><strong>Scenarios:</strong></label>
    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
      {['pivot', 'older_applicant', 'career_returner', 'recent_grad'].map(scenario => (
        <label key={scenario} style={{ display: 'flex', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={metadata.careerAnalysis?.scenarios?.includes(scenario) || false}
            onChange={(e) => {
              const current = metadata.careerAnalysis?.scenarios || [];
              const updated = e.target.checked
                ? [...current, scenario]
                : current.filter(s => s !== scenario);
              handleFieldChange('careerAnalysis', {
                ...metadata.careerAnalysis,
                scenarios: updated
              });
            }}
            style={{ marginRight: '0.25rem' }}
          />
          {scenario.replace('_', ' ')}
        </label>
      ))}
    </div>
  </div>

  {/* Positioning Strategy */}
  <div style={{ marginBottom: '1rem' }}>
    <label><strong>Positioning Strategy:</strong></label>
    <textarea
      value={metadata.careerAnalysis?.positioningStrategy || ''}
      onChange={(e) => handleFieldChange('careerAnalysis', {
        ...metadata.careerAnalysis,
        positioningStrategy: e.target.value
      })}
      rows={3}
      style={{ width: '100%', marginTop: '0.5rem' }}
    />
  </div>

  {/* Key Narratives */}
  <div style={{ marginBottom: '1rem' }}>
    <label><strong>Key Narratives:</strong></label>
    {metadata.careerAnalysis?.keyNarratives?.map((narrative, idx) => (
      <input
        key={idx}
        type="text"
        value={narrative}
        onChange={(e) => {
          const updated = [...(metadata.careerAnalysis?.keyNarratives || [])];
          updated[idx] = e.target.value;
          handleFieldChange('careerAnalysis', {
            ...metadata.careerAnalysis,
            keyNarratives: updated
          });
        }}
        style={{ width: '100%', marginTop: '0.25rem' }}
      />
    ))}
  </div>

  {/* Potential Concerns */}
  <div style={{ marginBottom: '1rem' }}>
    <label><strong>Potential Concerns:</strong></label>
    {metadata.careerAnalysis?.potentialConcerns?.map((concern, idx) => (
      <input
        key={idx}
        type="text"
        value={concern}
        onChange={(e) => {
          const updated = [...(metadata.careerAnalysis?.potentialConcerns || [])];
          updated[idx] = e.target.value;
          handleFieldChange('careerAnalysis', {
            ...metadata.careerAnalysis,
            potentialConcerns: updated
          });
        }}
        style={{ width: '100%', marginTop: '0.25rem' }}
      />
    ))}
  </div>

</div>

{/* Extracted Job Info Section */}
   <div style={{ marginTop: '1rem', marginBottom: '1rem', padding: '1rem', border: '1px solid #ddd' }}>
       <h3>Extracted Job Info</h3>
       <div style={{ marginBottom: '0.5rem' }}>
           <strong>Job Title:</strong> {metadata.jobTitle || 'Not Found'}
       </div>
       <div style={{ marginBottom: '0.5rem' }}>
           <strong>Company:</strong> {metadata.companyName || 'Not Found'}
       </div>
       <div> {/* No bottom margin for the last item */}
           <strong>HR Contact:</strong> {metadata.hrContact || 'Not Found'}
       </div>
   </div>

        <div style={{ marginTop: '1rem' }}>
          <h3>Suggested Keywords</h3>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.5rem',
              marginBottom: '1rem',
            }}
          >
            {metadata.suggestedKeywords?.map((kwObj, idx) => (
              <div
                key={`suggested-${idx}`}
                style={{
                  padding: '0.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={toggles[`suggested_${idx}`]}
                    onChange={() => handleToggle(`suggested_${idx}`)}
                    style={{ marginRight: '0.5rem' }}
                  />
                  <input
                    type="text"
                    value={kwObj.keyword ?? ''}
                    onChange={(e) => handleSuggestedChange(idx, e.target.value)}
                    style={{ flex: 1 }}
                  />
                </div>
                {kwObj.confidence && (
                  <small style={getConfidenceStyle(kwObj.confidence)}>
                    Confidence: {capitalizeFirstLetter(kwObj.confidence)}
                  </small>
                )}
              </div>
            ))}
          </div>

          <h3>Job Keywords</h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.5rem',
              marginBottom: '1rem',
            }}
          >
            {metadata.jobKeywords?.slice(0, 30).map((kw, idx) => (
              <div
                key={`job-${idx}`}
                style={{
                  padding: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <input
                  type="checkbox"
                  checked={toggles[`job_${idx}`]}
                  onChange={() => handleToggle(`job_${idx}`)}
                  style={{ marginRight: '0.5rem' }}
                />
                <input
                  type="text"
                  value={kw}
                  onChange={(e) => handleKeywordChange('jobKeywords', idx, e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
            ))}
          </div>

          <h3>CV Keywords</h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.5rem',
              marginBottom: '1rem',
            }}
          >
            {metadata.cvKeywords?.map((kw, idx) => (
              <div
                key={`cv-${idx}`}
                style={{
                  padding: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <input
                  type="checkbox"
                  checked={toggles[`cv_${idx}`]}
                  onChange={() => handleToggle(`cv_${idx}`)}
                  style={{ marginRight: '0.5rem' }}
                />
                <input
                  type="text"
                  value={kw}
                  onChange={(e) => handleKeywordChange('cvKeywords', idx, e.target.value)}
                  style={{ flex: 1 }}
                  />
                </div>
))}
</div>
</div>
</>
)}
</div>
);
}
