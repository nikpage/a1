// path: components/TabbedViewer.js

import { useState, useEffect } from 'react';
import { supabase } from '../utils/database';
import ReactMarkdown from 'react-markdown';
import CV_Cover_Display from './CV-Cover-Display';
import DocumentDownloadButtons from './DocumentDownloadButtons';
import DownloadTokenPanel from './DownloadTokenPanel';
import BaseModal from './BaseModal';
import ThankYouModal from './ThankYouModal';
import ToneDocModal from './ToneDocModal';
import AnalysisDisplay from './AnalysisDisplay';


export default function TabbedViewer({ user_id, analysisText }) {
  const [activeTab, setActiveTab] = useState('analysis');
  const [docs, setDocs] = useState({ cv: null, cover: null });
  const [showBuilder, setShowBuilder] = useState(false);
  const [showBuyPanel, setShowBuyPanel] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleSubmit = async ({ tone, selected }) => {
    const tokensRes = await fetch(`/api/tokens?user_id=${user_id}`);
    const tokensData = await tokensRes.json();
    if (!tokensRes.ok || tokensData.tokens < 1) {
      setShowBuyPanel(true);
      return;
    }
    const type = selected.length === 2 ? 'both' : selected[0];
    const res = await fetch('/api/generate-cv-cover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id, analysis: analysisText, tone, type }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Generation failed');
      return;
    }
    const newDocs = {};
    if (data.cv) newDocs.cv = data.cv;
    if (data.cover) newDocs.cover = data.cover;
    setDocs(prev => ({ ...prev, ...newDocs }));
    setShowModal(false);
    if (selected.length > 0) setActiveTab(selected[0]);
  };

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

  const tabs = [
    { id: 'analysis', label: 'Analysis' },
    { id: 'cv', label: 'CV' },
    { id: 'cover', label: 'Cover Letter' }
  ];

  return (
    <div className="doc-viewer">
      <div className="flex border-b border-accent bg-bg mb-8 gap-12">
        {tabs.map(tab => {
          const isDisabled =
            (tab.id === 'cv' && !docs.cv) ||
            (tab.id === 'cover' && !docs.cover);


    return (
      <button
        key={tab.id}
        onClick={() => {
          if (isDisabled) {
            alert(`No ${tab.label} available`);
          } else {
            setActiveTab(tab.id);
          }
        }}
        className={`tab-btn ${activeTab === tab.id ? 'active' : ''} ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
      >
        {tab.label}
      </button>
    );
  })}


      </div>

      {activeTab === 'analysis' && (
        <div>
          {analysisText ? (
            <>
              <AnalysisDisplay analysis={analysisText} />


              {!showBuilder && (
                <div className="text-center mt-8">
                  <button onClick={() => setShowModal(true)} className="action-btn">
                    Write Now!
                  </button>
                </div>
              )}
              {showBuilder && (
                <CV_Cover_Display user_id={user_id} analysis={analysisText} />
              )}
            </>
          ) : (
            <p>No analysis available</p>
          )}
        </div>
      )}

      {activeTab === 'cv' && (
        <div>
          {docs.cv ? (
            <>
              <div className="doc-viewer whitespace-pre-wrap">
                <ReactMarkdown>{docs.cv}</ReactMarkdown>
              </div>
              <DocumentDownloadButtons
                user_id={user_id}
                cvText={docs.cv}
                coverText={docs.cover}
                activeTab={activeTab}
                onTokenFail={() => setShowBuyPanel(true)}
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
              <div className="doc-viewer whitespace-pre-wrap">
                <ReactMarkdown>{docs.cover}</ReactMarkdown>
              </div>
              <DocumentDownloadButtons
                user_id={user_id}
                cvText={docs.cv}
                coverText={docs.cover}
                activeTab={activeTab}
                onTokenFail={() => setShowBuyPanel(true)}
              />
            </>
          ) : (
            <CV_Cover_Display user_id={user_id} analysis={analysisText} defaultType="cover" />
          )}
        </div>
      )}

      {showModal && (
        <ToneDocModal onClose={() => setShowModal(false)} onSubmit={handleSubmit} />
      )}

      {showBuyPanel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <DownloadTokenPanel onClose={() => setShowBuyPanel(false)} user_id={user_id} />
        </div>
      )}

      {showThankYou && (
        <BaseModal onClose={() => setShowThankYou(false)}>
          <ThankYouModal onClose={() => setShowThankYou(false)} />
        </BaseModal>
      )}
    </div>
  )
}
