// path: components/ToneDocModal.js

import BaseModal from './BaseModal';
import { useState } from 'react';

export default function ToneDocModal({ onClose, onSubmit }) {
  const [tone, setTone] = useState('formal');
  const [types, setTypes] = useState({ cv: false, cover: false });

  const handleGenerate = () => {
    const selected = Object.entries(types)
      .filter(([_, checked]) => checked)
      .map(([key]) => key);
    if (selected.length === 0) return alert('Select at least one document type');
    onSubmit({ tone, selected });
    onClose();
  };

  return (
    <BaseModal onClose={onClose}>
      <div className="space-y-6">
        <h2 className="text-xl font-bold">🎯 Choose Tone</h2>
        <div className="flex gap-4">
          {['formal', 'friendly', 'enthusiastic', 'cocky'].map(opt => (
            <button
              key={opt}
              className={`px-3 py-1 rounded border ${tone === opt ? 'bg-blue-600 text-white' : 'bg-white text-black'}`}
              onClick={() => setTone(opt)}
            >
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </button>
          ))}
        </div>

        <h2 className="text-xl font-bold">📄 Select Document Type</h2>
        <div className="flex gap-4">
          {['cv', 'cover'].map(doc => (
            <label key={doc} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={types[doc]}
                onChange={() => setTypes(prev => ({ ...prev, [doc]: !prev[doc] }))}
              />
              {doc === 'cv' ? 'CV' : 'Cover Letter'}
            </label>
          ))}
        </div>

        <div className="text-center">
          <button
            className="mt-4 px-6 py-2 bg-black text-white rounded"
            onClick={handleGenerate}
          >
            Generate
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
