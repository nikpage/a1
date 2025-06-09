//components/cardCV_Meta.js

import React, { useEffect } from 'react';

export default function CardCVMeta({
  cvMetadata,
  setCvMetadata,
  fieldUsage,
  setFieldUsage,
  userId,
  selectedMarket,
  selectedLang,
  setFeedback,
  setActiveCard,
}) {
  // Force document_input_id once
  useEffect(() => {
    if (!cvMetadata.document_input_id) {
      const id =
        cvMetadata.document_input_id ||
        window.documentInputId ||
        sessionStorage.getItem('current_input_id') ||
        crypto.randomUUID();
      setCvMetadata(prev => ({ ...prev, document_input_id: id }));
    }
  }, [cvMetadata, setCvMetadata]);

  const handleFieldChange = (key, value, index = null) => {
    setCvMetadata(prev => {
      if (index !== null) {
        const updatedList = [...(prev[key] || [])];
        updatedList[index] = value;
        return { ...prev, [key]: updatedList };
      }
      return { ...prev, [key]: value };
    });
  };

  const handleToggleUse = (key, index = null) => {
    const toggleKey = index !== null ? `${key}_${index}` : key;
    setFieldUsage(prev => ({ ...prev, [toggleKey]: !prev[toggleKey] }));
  };

  const autoExpand = e => {
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  // ---- FORM SUBMIT HANDLER ----
  const handleSubmit = async e => {
    e.preventDefault();

    console.log('Current cvMetadata.document_input_id:', cvMetadata.document_input_id);

    // First save the CV metadata
    const payload = {
      userId,
      cvData: cvMetadata,
      displayName: cvMetadata.display_name,
      documentInputId: cvMetadata.document_input_id,
    };

    try {
      // Get CV text with fallbacks
      const cvText = sessionStorage.getItem('cvText') ||
                    localStorage.getItem('cvText') ||
                    cvMetadata.rawText ||
                    "No CV text available";

      // Make API call for feedback
      const feedbackRes = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata: cvMetadata,
          cvBody: cvText,
          userId: userId
        }),
      });

      const feedbackData = await feedbackRes.json();

      if (feedbackData.feedback) {
        setFeedback(feedbackData.feedback);
        setActiveCard('feedback');
      } else {
        console.error('Failed to generate feedback:', feedbackData.error);
        // Handle error appropriately
      }
    } catch (error) {
      console.error('Error generating feedback:', error);
      // Handle error appropriately
    }
  };


  return (
    <div style={{ margin: '0', paddingTop: '0', marginTop: '0', position: 'relative', top: '-20px' }}>
      <h2 style={{ marginBottom: '0.25rem', fontSize: '2.25rem', fontWeight: 'bold', color: '#1e5a96', marginTop: '0', paddingTop: '0' }}>
        {cvMetadata.display_name || 'Uploaded CV 1'}
      </h2>
      <p style={{ marginBottom: '1.5rem', color: '#1e5a96', fontSize: '0.9rem', marginTop: '5px' }}>Extracted by AI</p>

      <div style={{ fontWeight: 'bold' }}>Name:</div>
      <input
        type="text"
        value={cvMetadata.name || ""}
        onChange={e => handleFieldChange('name', e.target.value)}
        style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', width: '100%' }}
        placeholder="Enter name"
        autoComplete="off"
      />

      <div style={{ fontWeight: 'bold' }}>Phone:</div>
      <input
        type="text"
        value={cvMetadata.phone || ""}
        onChange={e => handleFieldChange('phone', e.target.value)}
        style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', width: '100%' }}
        placeholder="Enter phone"
        autoComplete="off"
      />

      <div style={{ fontWeight: 'bold' }}>Email:</div>
      <input
        type="text"
        value={cvMetadata.email || ""}
        onChange={e => handleFieldChange('email', e.target.value)}
        style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', width: '100%' }}
        placeholder="Enter email"
        autoComplete="off"
      />

      <div style={{ fontWeight: 'bold' }}>Current Role:</div>
      <input
        type="text"
        value={cvMetadata.current_role || ""}
        onChange={e => handleFieldChange('current_role', e.target.value)}
        style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', width: '100%' }}
        placeholder="e.g. UX Lead"
        autoComplete="off"
      />

      <div style={{ fontWeight: 'bold' }}>Seniority:</div>
      <input
        type="text"
        value={cvMetadata.seniority || ""}
        onChange={e => handleFieldChange('seniority', e.target.value)}
        style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', width: '100%' }}
        placeholder="e.g. Senior"
        autoComplete="off"
      />

      <div style={{ fontWeight: 'bold' }}>Most recent company:</div>
      <input
        type="text"
        value={cvMetadata.primary_company || ""}
        onChange={e => handleFieldChange('primary_company', e.target.value)}
        style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', width: '100%' }}
        placeholder="Enter company name"
        autoComplete="off"
      />

      <div style={{ fontWeight: 'bold' }}>Career arcs summary:</div>
      <textarea
        value={cvMetadata.career_arcs_summary || ""}
        onChange={e => handleFieldChange('career_arcs_summary', e.target.value)}
        onInput={autoExpand}
        style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', width: '100%', minHeight: '60px' }}
        placeholder="Summary of career progression"
        autoComplete="off"
      />

      <div style={{ fontWeight: 'bold' }}>Parallel experiences summary:</div>
      <textarea
        value={cvMetadata.parallel_experiences_summary || ""}
        onChange={e => handleFieldChange('parallel_experiences_summary', e.target.value)}
        onInput={autoExpand}
        style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', width: '100%', minHeight: '60px' }}
        placeholder="Summary of parallel experiences"
        autoComplete="off"
      />

      <div style={{ fontWeight: 'bold' }}>Years of experience:</div>
      <input
        type="text"
        value={cvMetadata.years_experience || ""}
        onChange={e => handleFieldChange('years_experience', e.target.value)}
        style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', width: '100%' }}
        placeholder="e.g. 5"
        autoComplete="off"
      />

      <div style={{ fontWeight: 'bold' }}>Industries:</div>
      <input
        type="text"
        value={Array.isArray(cvMetadata.industries) ? cvMetadata.industries.join(', ') : (cvMetadata.industries || "")}
        onChange={e => handleFieldChange('industries', e.target.value.split(',').map(v => v.trim()))}
        style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', width: '100%' }}
        placeholder="Tech, Finance, etc."
        autoComplete="off"
      />

      <div style={{ fontWeight: 'bold' }}>Education:</div>
      <textarea
        value={cvMetadata.education || ""}
        onChange={e => handleFieldChange('education', e.target.value)}
        onInput={autoExpand}
        style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', width: '100%', minHeight: '60px' }}
        placeholder="Educational background"
        autoComplete="off"
      />

      <div style={{ fontWeight: 'bold' }}>Languages:</div>
      <input
        type="text"
        value={Array.isArray(cvMetadata.languages) ? cvMetadata.languages.join(', ') : (cvMetadata.languages || "")}
        onChange={e => handleFieldChange('languages', e.target.value.split(',').map(v => v.trim()))}
        style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', width: '100%' }}
        placeholder="English, Czech, etc."
        autoComplete="off"
      />

      <div style={{ fontWeight: 'bold' }}>Key achievements:</div>
      <textarea
        value={cvMetadata.key_achievements || ""}
        onChange={e => handleFieldChange('key_achievements', e.target.value)}
        onInput={autoExpand}
        style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', width: '100%', minHeight: '60px' }}
        placeholder="Notable professional achievements"
        autoComplete="off"
      />

      <div style={{ marginBottom: '1rem' }}>
        <h3>Skills/Keywords</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={fieldUsage[`skills_${i}`] ?? false}
                onChange={() => handleToggleUse('skills', i)}
              />
              <input
                type="text"
                value={cvMetadata.skills?.[i] || ''}
                onChange={e => handleFieldChange('skills', e.target.value, i)}
                style={{
                  flex: 1,
                  padding: '0.3rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <form
        onSubmit={e => {
          e.preventDefault();
          handleSubmit(e); // save CV metadata
          setActiveCard('feedback'); // go to feedback card
        }}
      >
        <button
          type="submit"
          style={{
            marginTop: '1rem',
            backgroundColor: '#1e5a96',
            color: 'white',
            padding: '0.5rem 1rem',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          Generate CV Feedback
        </button>
      </form>

    </div>
  );
}
