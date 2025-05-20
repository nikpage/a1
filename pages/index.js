// pages/index.js
import { useState } from 'react';

export default function Home() {
  const [file, setFile] = useState(null);
  const [text, setText] = useState('');
  const [metadata, setMetadata] = useState(null);

  // Read file as text (for PDF/DOCX you might integrate PDF.js/Mammoth later)
  const handleFileChange = async (e) => {
    const picked = e.target.files[0];
    setFile(picked);
    const reader = new FileReader();
    reader.onload = () => setText(reader.result);
    reader.readAsText(picked);
  };

  const extract = async () => {
    const res = await fetch('/api/cv-metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, userId: null }),
    });
    const data = await res.json();
    setMetadata(data);
  };

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">CV AI MVP</h1>
      <input
        type="file"
        accept=".txt,.pdf,.doc,.docx"
        onChange={handleFileChange}
        className="block mb-4"
      />
      <button
        onClick={extract}
        disabled={!text}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        Extract Metadata
      </button>
      {metadata && (
        <pre className="mt-4 bg-gray-100 p-4 rounded">
          {JSON.stringify(metadata, null, 2)}
        </pre>
      )}
    </div>
  );
}
