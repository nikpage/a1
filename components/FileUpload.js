// components/FileUpload.js
import { useState } from 'react';

export default function FileUpload({ userId, onUpload }) {
  const [file, setFile] = useState(null);

  const handleChange = (e) => setFile(e.target.files[0]);

  const handleUpload = async () => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          file: { content: base64, name: file.name, type: file.type },
        }),
      });
      const { fileUrl } = await res.json();
      if (onUpload) onUpload();
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="mb-4">
      <input type="file" onChange={handleChange} className="block mb-2" />
      <button
        onClick={handleUpload}
        disabled={!file}
        className="px-3 py-1 bg-green-600 text-white rounded disabled:opacity-50"
      >
        Upload CV
      </button>
    </div>
  );
}
