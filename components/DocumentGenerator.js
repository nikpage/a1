// path: components/DocumentGenerator.js

import { useState } from 'react';
import ToneDocModal from './ToneDocModal';

export default function DocumentGenerator({ user_id, analysis }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [docs, setDocs] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const handleSubmit = async ({ tone, selected }) => {
    if (!analysis) return;
    setLoading(true);
    setError(null);
    setDocs(null);

    try {
      const res = await fetch('/api/generate-cv-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id,
          analysis,
          tone,
          types: selected,
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
    <div className="space-y-4">
      <button
        onClick={() => setShowModal(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded"
        disabled={loading}
      >
        {loading ? 'Generating…' : 'Write Now'}
      </button>

      {error && <div style={{ color: 'red' }}>{error}</div>}
      {docs && docs.map((doc, i) => (
        <div key={i} className="border p-3 rounded bg-white shadow">
          <h3 className="font-bold uppercase">{doc.type}</h3>
          <pre className="whitespace-pre-wrap mt-2">{doc.content}</pre>
        </div>
      ))}

      {showModal && (
        <ToneDocModal
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
