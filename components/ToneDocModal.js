// path: components/ToneDocModal.js
import BaseModal from './BaseModal';
import { useState } from 'react';

export default function ToneDocModal({ onClose, onSubmit }) {
  const [tone, setTone] = useState('formal');
  const [types, setTypes] = useState({ cv: true, cover: true });

  const handleGenerate = () => {
    const selected = Object.entries(types)
      .filter(([_, checked]) => checked)
      .map(([key]) => key);

    if (selected.length === 0) {
      alert('Select at least one document type');
      return;
    }

    onSubmit({ tone, selected });
  };

  return (
    <BaseModal onClose={onClose}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>🎯 Choose Tone</h2>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {['formal', 'friendly', 'enthusiastic', 'cocky'].map(opt => (
            <button
              key={opt}
              type="button"
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: '1px solid #ccc',
                backgroundColor: tone === opt ? '#3b82f6' : '#fff',
                color: tone === opt ? 'white' : 'black',
                cursor: 'pointer'
              }}
              onClick={() => setTone(opt)}
            >
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>📄 Select Document Type</h2>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {['cv', 'cover'].map(doc => (
            <label key={doc} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={types[doc]}
                onChange={() => setTypes(prev => ({ ...prev, [doc]: !prev[doc] }))}
              />
              {doc === 'cv' ? 'CV' : 'Cover Letter'}
            </label>
          ))}
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '1rem' }}>
        <button
          type="button"
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          onClick={handleGenerate}
        >
          Generate
        </button>
      </div>
    </BaseModal>
  );
}
