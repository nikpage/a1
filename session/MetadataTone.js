import React, { useState } from 'react';

export default function MetadataTone({ initialMeta, onSubmit }) {
  const [meta, setMeta] = useState({
    title: initialMeta.title || '',
    company: initialMeta.company || '',
    hrContact: initialMeta.hrContact || '',
    keywords: initialMeta.keywords || []
  });
  const [tone, setTone] = useState('Neutral');

  const handleChange = (field) => (e) => {
    setMeta({ ...meta, [field]: e.target.value });
  };

  const handleKeywordKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      e.preventDefault();
      setMeta({ ...meta, keywords: [...meta.keywords, e.target.value.trim()] });
      e.target.value = '';
    }
  };

  const removeKeyword = (index) => {
    const newKeywords = [...meta.keywords];
    newKeywords.splice(index, 1);
    setMeta({ ...meta, keywords: newKeywords });
  };

  const handleSubmit = () => {
    onSubmit({ ...meta, tone });
  };

  return (
    <div className="metadata-tone">
      <h2>Review & Edit Job Metadata</h2>
      <label>
        Job Title
        <input type="text" value={meta.title} onChange={handleChange('title')} />
      </label>
      <label>
        Company Name
        <input type="text" value={meta.company} onChange={handleChange('company')} />
      </label>
      <label>
        HR Contact Name
        <input type="text" value={meta.hrContact} onChange={handleChange('hrContact')} />
      </label>
      <label>
        Keywords (press Enter to add)
        <div className="keywords-input">
          {meta.keywords.map((kw, i) => (
            <span key={i} className="keyword-chip">
              {kw}
              <button type="button" onClick={() => removeKeyword(i)}>×</button>
            </span>
          ))}
          <input type="text" onKeyDown={handleKeywordKeyDown} placeholder="Add keyword" />
        </div>
      </label>
      <div className="tone-buttons">
        {['Formal', 'Neutral', 'Casual', 'Cocky'].map((t) => (
          <button
            key={t}
            type="button"
            className={tone === t ? 'selected' : ''}
            onClick={() => setTone(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <button onClick={handleSubmit} className="save-continue">
        Save & Build Documents
      </button>
    </div>
  );
}
