// path: components/DocumentDownloadButtons.js

import { useState } from 'react';

export default function DocumentDownloadButtons({ user_id, analysisText, cvText, coverText, onTokenFail, activeTab }) {
  const [loading, setLoading] = useState('');

  const handleDownload = async (type, content) => {
    setLoading(type);
    try {
      const res = await fetch('/api/download-token-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id, type, content }),
      });

      if (res.status === 402) {
        onTokenFail();
        setLoading('');
        return;
      }

      if (!res.ok) throw new Error('Download failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert('Error downloading file.');
    }
    setLoading('');
  };

  const available = [
    ...(analysisText ? [{ label: 'Analysis', type: 'analysis', content: analysisText }] : []),
    ...(cvText ? [{ label: 'CV', type: 'cv', content: cvText }] : []),
    ...(coverText ? [{ label: 'Cover Letter', type: 'coverletter', content: coverText }] : [])
  ];

  const tooltip = `Download: ${available.map(a => a.label).join(', ')}`;

  return (
    <div className="flex flex-col gap-4 mt-4 items-center">
      {available.length > 0 && (
        <button
          onClick={() => available.forEach(doc => handleDownload(doc.type, doc.content))}
          disabled={loading === 'all'}
          title={tooltip}
          className="bg-black text-white py-2 px-4 rounded"
        >
          {loading === 'all' ? 'Downloading All...' : 'Download All'}
        </button>
      )}

      {activeTab === 'analysis' && analysisText && (
        <button
          onClick={() => handleDownload('analysis', analysisText)}
          disabled={loading === 'analysis'}
          className="bg-blue-600 text-white py-2 px-4 rounded"
        >
          {loading === 'analysis' ? 'Downloading...' : 'Download Analysis'}
        </button>
      )}

      {activeTab === 'cv' && cvText && (
        <button
          onClick={() => handleDownload('cv', cvText)}
          disabled={loading === 'cv'}
          className="bg-green-600 text-white py-2 px-4 rounded"
        >
          {loading === 'cv' ? 'Downloading...' : 'Download CV'}
        </button>
      )}

      {activeTab === 'cover' && coverText && (
        <button
          onClick={() => handleDownload('coverletter', coverText)}
          disabled={loading === 'coverletter'}
          className="bg-purple-600 text-white py-2 px-4 rounded"
        >
          {loading === 'coverletter' ? 'Downloading...' : 'Download CoverLetter'}
        </button>
      )}
    </div>
  );
}
