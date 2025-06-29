// components/TabbedViewer.js
import { useState, useEffect } from 'react';
import { supabase } from '../utils/database';
import CV_Cover_Display from './CV-Cover-Display';

export default function TabbedViewer({ user_id, analysisText }) {
  const [activeTab, setActiveTab] = useState('analysis');
  const [docs, setDocs] = useState({ cv: null, cover: null });
  const [showBuilder, setShowBuilder] = useState(false);

  // Fetch existing CV and cover letter from DB
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
  }, [user_id, activeTab]); // Refetch when tab changes

  const tabs = [
    { id: 'analysis', label: 'Analysis' },
    { id: 'cv', label: 'CV' },
    { id: 'cover', label: 'Cover Letter' }
  ];

  return (
    <div style={{ marginTop: '2em' }}>
      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        borderBottom: '2px solid #ddd',
        marginBottom: '1em'
      }}>
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

      {/* Tab Content */}
      <div>
        {activeTab === 'analysis' && (
          <div>
            {analysisText ? (
              <div>
                <div dangerouslySetInnerHTML={{ __html: analysisText.replace(/\n/g, '<br/>') }} />

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
              <pre style={{ background: '#f8f8fa', padding: 12, borderRadius: 8 }}>
                {docs.cv}
              </pre>
            ) : (
              <CV_Cover_Display user_id={user_id} analysis={analysisText} defaultType="cv" />
            )}
          </div>
        )}

        {activeTab === 'cover' && (
          <div>
            {docs.cover ? (
              <pre style={{ background: '#f8f8fa', padding: 12, borderRadius: 8 }}>
                {docs.cover}
              </pre>
            ) : (
              <CV_Cover_Display user_id={user_id} analysis={analysisText} defaultType="cover" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
