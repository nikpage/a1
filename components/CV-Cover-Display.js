// path: components/CV-Cover-Display.js

import { useState, useEffect } from 'react';
import DownloadTokenPanel from './DownloadTokenPanel';
import { supabase } from '../utils/database';  // Adjust the import if needed

export default function CV_Cover_Display({ user_id, analysis }) {
  console.log('Analysis in CV_Cover_Display:', analysis);
  const [tone, setTone] = useState('Formal');
  const [docTypes, setDocTypes] = useState({ cv: false, cover: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [docs, setDocs] = useState(null);
  const [showBuyPanel, setShowBuyPanel] = useState(false);


  useEffect(() => {
    const loadDocs = async () => {
      if (!user_id || !analysis || !tone || !analysis.analysis_id) return;

      const { source_cv_id, analysis_id } = analysis;

      const { data, error } = await supabase
        .from('gen_data')
        .select('type, content')
        .eq('user_id', user_id)
        .eq('source_cv_id', source_cv_id)
        .eq('tone', tone)
        .eq('analysis_id', analysis_id)
        .in('type', ['cv', 'cover']);

      if (error) {
        console.error('DB fetch failed:', error);
        return;
      }

      const result = { cv: null, cover: null };
      for (const row of data) {
        if (row.type === 'cv') result.cv = row.content;
        if (row.type === 'cover') result.cover = row.content;
      }

      setDocs(result);
    };

    loadDocs();
  }, [user_id, analysis, tone]);

  // path: components/CV-Cover-Display.js
  const handleDownload = async (type, content) => {
    const res = await fetch('/api/download-token-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id, type, content }),
    });

    if (res.status === 402) {
      setShowBuyPanel(true);  // Show Buy Tokens modal when tokens = 0
      return;
    }

    // Proceed with downloading after tokens check
    if (!res.ok) {
      alert('Download failed');
      return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+?)"/)?.[1] || 'download.docx';
    a.click();
    window.URL.revokeObjectURL(url);

  };


  const toggleDocType = (type) => {
    setDocTypes(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const canGenerate = docTypes.cv || docTypes.cover;

  const handleGenerate = async () => {
    if (!canGenerate || !analysis) return;
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
          type: docTypes.cv && docTypes.cover ? 'both' : docTypes.cv ? 'cv' : 'cover',
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Generation failed');
      } else {
        setDocs({ cv: data.cv, cover: data.cover });
      }
    } catch (err) {
      setError('Error: ' + err.message);
    }
    setLoading(false);
  };
  useEffect(() => {
    const search = window.location.search;
    if (search.includes('success=true')) {
      setShowBuyPanel(false);

      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  return (
    <div style={{ marginTop: 40, textAlign: 'center' }}>
      <h3 style={{ fontSize: '1.25rem' }}>🎯 Choose Tone</h3>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 20 }}>
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

      <h3 style={{ fontSize: '1.25rem' }}>📄 Select Document Type</h3>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 20 }}>
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

      <button
        onClick={handleGenerate}
        disabled={!canGenerate || loading}
        style={{
          padding: '0.75rem 2rem',
          background: canGenerate && !loading ? '#224488' : '#bbb',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontWeight: 700,
          fontSize: '1rem',
          cursor: canGenerate && !loading ? 'pointer' : 'not-allowed',
          marginTop: 20,
        }}
      >
        {loading ? 'Generating…' : 'Generate'}
      </button>

      {error && <div style={{ color: 'red', marginTop: 16 }}>{error}</div>}

      {showBuyPanel && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.4)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <DownloadTokenPanel onClose={() => setShowBuyPanel(false)} user_id={user_id} />
        </div>
      )}



      {docs && (
        <div style={{ marginTop: 32, textAlign: 'left' }}>
          {docs.cv && (
            <>
              <h3>CV</h3>
              <pre style={{ background: '#f8f8fa', padding: 12, borderRadius: 8 }}>
                {docs.cv}
              </pre>
              <button
                onClick={() => handleDownload('cv', docs.cv)}
                style={{
                  marginTop: 8,
                  padding: '6px 12px',
                  background: '#2255aa',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Download CV
              </button>
            </>
          )}
          {docs.cover && (
            <>
              <h3>Cover Letter</h3>
              <pre style={{ background: '#f8f8fa', padding: 12, borderRadius: 8 }}>
                {docs.cover}
              </pre>
              <button
                onClick={() => handleDownload('cover', docs.cover)}
                style={{
                  marginTop: 8,
                  padding: '6px 12px',
                  background: '#2255aa',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Download Cover Letter
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
