import { useState } from 'react';

export default function DocumentGenerator({ user_id, analysis }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [docs, setDocs] = useState(null);

  const handleGenerate = async () => {
    if (!analysis) return;
    setLoading(true);
    setError(null);
    setDocs(null);
    try {
      const res = await fetch('/api/generate-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id,
          analysis,
          tone: 'Formal',
          type: 'cover',
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
    <div>


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
