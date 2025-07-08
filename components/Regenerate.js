// path: components/Regenerate.js
import BaseModal from './BaseModal';
import { useState } from 'react';

export default function Regenerate({ onClose, onSubmit }) {
  const [tone, setTone] = useState('professional');
  const [selected, setSelected] = useState([]);

  const toggle = (type) => {
    setSelected(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleClick = () => {
    onSubmit({ tone, selected });
  };

  return (
    <BaseModal onClose={onClose}>
      <h2 className="text-xl font-semibold mb-4">Regenerate Documents</h2>

      <div className="flex gap-4 mb-4 justify-center">
        <button
          className={`border px-4 py-2 rounded ${tone === 'professional' ? 'bg-blue-600 text-white' : ''}`}
          onClick={() => setTone('professional')}
        >
          Professional
        </button>
        <button
          className={`border px-4 py-2 rounded ${tone === 'friendly' ? 'bg-blue-600 text-white' : ''}`}
          onClick={() => setTone('friendly')}
        >
          Friendly
        </button>
      </div>

      <div className="flex gap-4 mb-6 justify-center">
        <button
          className={`border px-4 py-2 rounded ${selected.includes('cv') ? 'bg-green-600 text-white' : ''}`}
          onClick={() => toggle('cv')}
        >
          CV
        </button>
        <button
          className={`border px-4 py-2 rounded ${selected.includes('cover') ? 'bg-green-600 text-white' : ''}`}
          onClick={() => toggle('cover')}
        >
          Cover Letter
        </button>
      </div>

      <button className="action-btn w-full" onClick={handleClick}>
        Generate
      </button>
    </BaseModal>
  );
}
