import BaseModal from './BaseModal';
import { useState } from 'react';

export default function ToneDocModal({ onClose, onSubmit }) {
  const [tone, setTone] = useState('formal');
  const [types, setTypes] = useState({ cv: false, cover: false });

  const handleGenerate = () => {
    console.log('Button clicked!'); // Debug line
    const selected = Object.entries(types)
      .filter(([_, checked]) => checked)
      .map(([key]) => key);

    console.log('Selected types:', selected); // Debug line

    if (selected.length === 0) return alert('Select at least one document type');

    console.log('Calling onSubmit with:', { tone, selected }); // Debug line
    onSubmit({ tone, selected });
    onClose();
  };

  return (
    <BaseModal onClose={onClose} showCloseButton={false}>
      <div className="modal-container">
        <div className="modal-content">
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
                    backgroundColor: tone === opt ? '#2563eb' : '#fff',
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

          <div style={{ textAlign: 'center' }}>
            <button
              type="button"
              style={{
                marginTop: '1rem',
                padding: '0.75rem 1.5rem',
                backgroundColor: 'black',
                color: 'white',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
              onClick={handleGenerate}
            >
              Generate
            </button>
          </div>
        </div>
      </div>
    </BaseModal>
  );
}
