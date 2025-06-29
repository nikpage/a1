// path: components/TabbedViewer.js
import { useState, useEffect } from 'react';
import { supabase } from '../utils/database';
import CV_Cover_Display from './CV-Cover-Display';
import DocumentDownloadButtons from './DocumentDownloadButtons';
import DownloadTokenPanel from './DownloadTokenPanel';
import ThankYouModal from './ThankYouModal';

export default function TabbedViewer({ user_id, analysisText }) {
  const [activeTab, setActiveTab] = useState('analysis');
  const [docs, setDocs] = useState({ cv: null, cover: null });
  const [showBuilder, setShowBuilder] = useState(false);
  const [showBuyPanel, setShowBuyPanel] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);

  useEffect(() => {
    const fetchDocs = async () => {
      if (!user_id) return;

      const { data, error } = await supabase
        .from('gen_data')
        .select('type, content')
        .eq('user_id', user_id)
        .in('type', ['cv', 'cover'])
        .order('created_at', { ascending: false });

      if (!error && data) {
        const result = { cv: null, cover: null };
        for (const row of data) {
          if (row.type === 'cv' && !result.cv) result.cv = row.content;
          if (row.type === 'cover' && !result.cover) result.cover = row.content;
        }
        setDocs(result);
      }
    };

    fetchDocs();
  }, [user_id, activeTab]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    if (success === 'true') {
      const stored = localStorage.getItem('pendingDownload');
      if (stored) {
        const { type, content } = JSON.parse(stored);

        fetch('/api/download-token-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id, type, content }),
        })
          .then(res => {
            if (!res.ok) throw new Error('Token check failed');
            setShowThankYou(true);
            return res.blob();
          })
          .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${type}.docx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
          })
          .catch(err => console.error('Download failed:', err))
          .finally(() => {
            localStorage.removeItem('pendingDownload');
          });
      }
    }
  }, [user_id]);

  const tabs = [
    { id: 'analysis', label: 'Analysis' },
    { id: 'cv', label: 'CV' },
    { id: 'cover', label: 'Cover Letter' }
  ];

  return (
    <div style={{ marginTop: '2em' }}>
      <div style={{ display: 'flex', borderBottom: '2px solid #ddd', marginBottom: '1em' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 24px',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #224488' : '2px solid transparent',
              background: activeTab === tab.id ? '#f8f9fa' : 'transparent',
              cursor: 'pointer',
              fontWeight: activeTab === tab.id ? 'bold' : 'normal',
              color: activeTab === tab.id ? '#224488' : '#666'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'analysis' && (
          <div>
            {analysisText ? (
              <div>
                <div dangerouslySetInnerHTML={{ __html: analysisText.replace(/\n/g, '<br/>') }} />
                <DocumentDownloadButtons
                  user_id={user_id}
                  analysisText={analysisText}
                  cvText={docs.cv}
                  coverText={docs.cover}
                  onTokenFail={() => setShowBuyPanel(true)}
                  activeTab={activeTab}
                />

                {!showBuilder && (
                  <div style={{ marginTop: '2em', textAlign: 'center' }}>
                    <button
                      onClick={() => setShowBuilder(true)}
                      style={{
                        padding: '0.8rem 2.4rem',
                        fontSize: '1.1rem',
                        background: '#224488',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      Write Now!
                    </button>
                  </div>
                )}

                {showBuilder && (
                  <CV_Cover_Display user_id={user_id} analysis={analysisText} />
                )}
              </div>
            ) : (
              <p>No analysis available</p>
            )}
          </div>
        )}

        {activeTab === 'cv' && (
          <div>
            {docs.cv ? (
              <>
                <pre style={{ background: '#f8f8fa', padding: 12, borderRadius: 8 }}>{docs.cv}</pre>
                <DocumentDownloadButtons
                  user_id={user_id}
                  analysisText={analysisText}
                  cvText={docs.cv}
                  coverText={docs.cover}
                  onTokenFail={() => setShowBuyPanel(true)}
                  activeTab={activeTab}
                />
              </>
            ) : (
              <CV_Cover_Display user_id={user_id} analysis={analysisText} defaultType="cv" />
            )}
          </div>
        )}

        {activeTab === 'cover' && (
          <div>
            {docs.cover ? (
              <>
                <pre style={{ background: '#f8f8fa', padding: 12, borderRadius: 8 }}>{docs.cover}</pre>
                <DocumentDownloadButtons
                  user_id={user_id}
                  analysisText={analysisText}
                  cvText={docs.cv}
                  coverText={docs.cover}
                  onTokenFail={() => setShowBuyPanel(true)}
                  activeTab={activeTab}
                />
              </>
            ) : (
              <CV_Cover_Display user_id={user_id} analysis={analysisText} defaultType="cover" />
            )}
          </div>
        )}
      </div>

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

      {showThankYou && <ThankYouModal onClose={() => setShowThankYou(false)} />}
    </div>
  );
}
