import React from 'react';

export default function CardCVMeta({
  cvMetadata,
  setCvMetadata,
  fieldUsage,
  setFieldUsage,
  userId,
  selectedMarket,
  selectedLang,
  setFeedback,
}) {
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

  return (
    <div style={{ margin: '2rem 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', rowGap: '0.75rem', alignItems: 'start' }}>
        {/* Basic Info Fields */}
        <div style={{ fontWeight: 'bold' }}>Name:</div>
        <input
          type="text"
          value={cvMetadata.user_name || ""}
          onChange={e => handleFieldChange('user_name', e.target.value)}
          style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', width: '100%' }}
          placeholder="Enter name"
          autoComplete="off"
        />

        <div style={{ fontWeight: 'bold' }}>Contact Info:</div>
        <input
          type="text"
          value={cvMetadata.contact_info || ""}
          onChange={e => handleFieldChange('contact_info', e.target.value)}
          style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', width: '100%' }}
          placeholder="Enter contact info"
          autoComplete="off"
        />

        {/* Professional Fields */}
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
      </div>

      {/* Skills section */}
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

      <form onSubmit={async e => {
        e.preventDefault();
        const res = await fetch('/api/review-cv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, tone: 'neutral', targetIndustry: selectedMarket, country: selectedLang, metadata: cvMetadata }),
        });
        const { feedback: fb } = await res.json();
        const text = typeof fb === 'string' ? fb : fb.choices?.[0]?.message?.content || JSON.stringify(fb);
        setFeedback(text);
        await fetch('/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, data: cvMetadata, feedback: text }),
        });
      }}>
        <button type="submit">Review CV</button>
      </form>
    </div>
  );
}
