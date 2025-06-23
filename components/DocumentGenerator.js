'/api/generate-cover'
// components/DocumentGenerator.js
import { useState } from 'react';

export default function DocumentGenerator({ user_id, analysis }) {
  const [tone, setTone] = useState('Formal');
  const [docTypes, setDocTypes] = useState({ cv: false, cover: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [docs, setDocs] = useState(null);

  const toggleDocType = (type) => {
    setDocTypes(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const canGenerate = tone && (docTypes.cv || docTypes.cover);

  const handleGenerate = async () => {
    if (!canGenerate || !analysis) return;
    setLoading(true);
    setError(null);
    setDocs(null);
    try {
      const res = await fetch('/api/generate-cover'
, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id,
          analysis,
          tone,
          type: docTypes.cv && docTypes.cover ? 'both' : docTypes.cv ? 'cv' : 'cover',
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Generation failed');
      } else {
        setDocs(data.docs);
      }
    } catch (err) {
      setError('Error: ' + err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ marginTop: 40 }}>
      <h3>🎯 Choose Tone</h3>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {['Formal', 'Friendly', 'Enthusiastic', 'Cocky'].map((t) => (
          <button
            key={t}
            onClick={() => setTone(t)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: t === tone ? '2px solid #224488' : '1px solid #ccc',
              background: t === tone ? '#eef2ff' : '#fff',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <h3>📄 Select Document Type</h3>
      <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
        <label>
          <input
            type="checkbox"
            checked={docTypes.cv}
            onChange={() => toggleDocType('cv')}
          />{' '}
          CV
        </label>
        <label>
          <input
            type="checkbox"
            checked={docTypes.cover}
            onChange={() => toggleDocType('cover')}
          />{' '}
          Cover Letter
        </label>
      </div>

      {canGenerate && (
        <button
          onClick={handleGenerate}
          disabled={loading}
          style={{
            padding: '0.5rem 1.5rem',
            background: '#224488',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Generating…' : 'Generate'}
        </button>
      )}

      {error && <div style={{ color: 'red', marginTop: 16 }}>{error}</div>}

      {docs && (
        <div style={{ marginTop: 32 }}>
          {docs.cv && (
            <>
              <h3>CV</h3>
              <pre style={{ background: '#f8f8fa', padding: 12, borderRadius: 8 }}>
                {docs.cv}
              </pre>
            </>
          )}
          {docs.cover && (
            <>
              <h3>Cover Letter</h3>
              <pre style={{ background: '#f8f8fa', padding: 12, borderRadius: 8 }}>
                {docs.cover}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}
