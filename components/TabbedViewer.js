// path: components/TabbedViewer.js

import { supabase } from '../utils/database';
import CV_Cover_Display from './CV-Cover-Display';
import DocumentDownloadButtons from './DocumentDownloadButtons';
import DownloadTokenPanel from './DownloadTokenPanel';
import BaseModal from './BaseModal';
import ThankYouModal from './ThankYouModal';
import ToneDocModal from './ToneDocModal';
import AnalysisDisplay from './AnalysisDisplay';
import Regenerate from './Regenerate';
import StartFreshModal from './StartFreshModal';
import LoadingModal from './LoadingModal';
import { useState, useEffect, useLayoutEffect } from 'react';




export default function TabbedViewer({ user_id, analysisText }) {
  const [analysisTextState, setAnalysisTextState] = useState(analysisText);
  useEffect(() => {
  const clear = () => setAnalysisTextState(null);
  window.addEventListener('clear-analysis', clear);
  return () => window.removeEventListener('clear-analysis', clear);
}, []);

  // Removed setInterval polling as per your request
  // useEffect(() => {
  //   if (!user_id) return;

  //   const interval = setInterval(async () => {
  //     const { data, error } = await supabase
  //       .from('gen_data')
  //       .select('type, content')
  //       .eq('user_id', user_id)
  //       .eq('type', 'analysis')
  //       .order('created_at', { ascending: false })
  //       .limit(1)
  //       .single();

  //     if (!error && data?.content && data.content !== analysisTextState) {
  //       setAnalysisTextState(data.content);
  //       setActiveTab('analysis');
  //     }
  //   }, 3000);

  //   return () => clearInterval(interval);
  // }, [user_id, analysisTextState]);

  const [activeTab, setActiveTab] = useState('analysis');
  const [docs, setDocs] = useState({ cv: null, cover: null });
  const [showBuilder, setShowBuilder] = useState(false);
  const [showBuyPanel, setShowBuyPanel] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [cvVersions, setCvVersions] = useState([]);
  const [coverVersions, setCoverVersions] = useState([]);
  const [cvCurrentIndex, setCvCurrentIndex] = useState(0);
  const [coverCurrentIndex, setCoverCurrentIndex] = useState(0);
  const [showLoadingModal, setShowLoadingModal] = useState(false);
  const [loadingModalMessage, setLoadingModalMessage] = useState('');
  const [loadingModalTitle, setLoadingModalTitle] = useState('');


  const handleSubmit = async ({ tone, selected, jobText }) => {
    setShowLoadingModal(true);
    setLoadingModalTitle('Generating Documents');
    setLoadingModalMessage('Preparing your tailored documents...');

    try {
      if (!selected || !Array.isArray(selected) || selected.length === 0) {
        alert('Please select at least one document type.');
        return;
      }

      const tokensRes = await fetch(`/api/tokens?user_id=${user_id}`);
      const tokensData = await tokensRes.json();
      if (!tokensRes.ok || tokensData.tokens < 1) {
        setShowBuyPanel(true);
        return;
      }

      setLoadingModalMessage('Sending request for generation...');
      const type = selected.length === 2 ? 'both' : selected[0];
      const res = await fetch('/api/generate-cv-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id, analysis: jobText || analysisText, tone, type }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Generation failed');
        return;
      }

      if (data.analysis) {
        location.reload();
        return;
      }

      setLoadingModalMessage('Updating document versions...');
      if (data.cv) {
        setCvVersions(prev => [...prev, data.cv]);
        setCvCurrentIndex(prev => prev);
        setActiveTab('cv');
      }
      if (data.cover) {
        setCoverVersions(prev => [...prev, data.cover]);
        setCoverCurrentIndex(prev => prev);
        if (!data.cv) setActiveTab('cover');
      }
      setShowModal(false);
    } catch (error) {
      console.error("Generation error:", error);
      alert("An error occurred during document generation.");
    } finally {
      setShowLoadingModal(false);
    }
  };

  const handleRegen = async (docType, tone) => {
    setShowLoadingModal(true);
    setLoadingModalTitle(`Regenerating ${docType === 'cv' ? 'CV' : 'Cover Letter'}`);
    setLoadingModalMessage('Requesting a new version...');

    try {
      const res = await fetch('/api/generate-cv-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id, analysis: analysisText, tone, type: docType }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Regeneration failed');
        return;
      }

      setLoadingModalMessage('Adding new version...');
      if (data.cv) {
        setCvVersions(prev => [...prev, data.cv]);
        setCvCurrentIndex(cvVersions.length);
      }
      if (data.cover) {
        setCoverVersions(prev => [...prev, data.cover]);
        setCoverCurrentIndex(coverVersions.length);
      }
    } catch (error) {
      console.error("Regeneration error:", error);
      alert("An error occurred during document regeneration.");
    } finally {
      setShowLoadingModal(false);
    }
  };

  const goToPrevVersion = (type) => {
    if (type === 'cv') setCvCurrentIndex(Math.max(0, cvCurrentIndex - 1));
    if (type === 'cover') setCoverCurrentIndex(Math.max(0, coverCurrentIndex - 1));
  };

  const goToNextVersion = (type) => {
    if (type === 'cv') setCvCurrentIndex(Math.min(cvVersions.length - 1, cvCurrentIndex + 1));
    if (type === 'cover') setCoverCurrentIndex(Math.min(coverVersions.length - 1, coverCurrentIndex + 1));
  };

  const startFresh = () => {
    setCvVersions([]);
    setCoverVersions([]);
    setCvCurrentIndex(0);
    setCoverCurrentIndex(0);
    setDocs({ cv: null, cover: null });
    setActiveTab('analysis');
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
        for (const row of data) {
          if (row.type === 'cv' && cvVersions.length === 0) {
            setCvVersions([row.content]);
            setCvCurrentIndex(0);
          }
          if (row.type === 'cover' && coverVersions.length === 0) {
            setCoverVersions([row.content]);
            setCoverCurrentIndex(0);
          }
        }
        if (cvVersions.length === 0 && coverVersions.length === 0) setActiveTab('analysis');
        else if (cvVersions.length > 0) setActiveTab('cv');
        else if (coverVersions.length > 0) setActiveTab('cover');
      }
    };
    fetchDocs();
  }, [user_id]);

  const tabs = [
    { id: 'analysis', label: 'Analysis' },
    { id: 'cv', label: 'CV' },
    { id: 'cover', label: 'Cover Letter' },
  ];

  useEffect(() => {
    if (!docs.cv && !docs.cover) return;
    if (activeTab !== 'cv' && docs.cv) setActiveTab('cv');
    else if (activeTab !== 'cover' && docs.cover && !docs.cv) setActiveTab('cover');
  }, [docs]);

  useLayoutEffect(() => {
    const prevScroll = window.scrollY;
    setTimeout(() => {
      window.scrollTo(0, prevScroll);
    }, 1);
  }, [activeTab]);


  return (
    <div className="doc-viewer">
      <div className="text-center mb-4">
        <button onClick={() => setShowModal('startFresh')} className="action-btn">
          Start Fresh
        </button>

      </div>

      <div className="flex border-b border-accent bg-bg mb-8 gap-12">
        {tabs.map(tab => {
          const isDisabled =
            (tab.id === 'cv' && cvVersions.length === 0) ||
            (tab.id === 'cover' && coverVersions.length === 0);

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
          {analysisTextState ? (            <>
              <AnalysisDisplay analysis={analysisText} />
              {!showBuilder && (
                <div className="text-center mt-8">
                  <button onClick={() => setShowModal(true)} className="action-btn">
                    Write Now!
                  </button>
                </div>
              )}
              {showBuilder && (
                <CV_Cover_Display user_id={user_id} analysis={analysisText} content={docs.cv} />
              )}
            </>
          ) : (
            <p>No analysis available</p>
          )}
        </div>
      )}

      {activeTab === 'cv' && (
        <div>
          {cvVersions.length > 0 ? (
            <>
              <div className="flex flex-col items-center mb-4">
                <div className="mb-2 text-sm font-bold text-gray-800">
                  Version {cvCurrentIndex + 1} of {cvVersions.length}
                </div>
                <div className="flex flex-row gap-4">
                  <button onClick={() => goToPrevVersion('cv')} disabled={cvCurrentIndex === 0}>
                    &lt; Prev
                  </button>
                  <button onClick={() => setShowModal('regenerate')} className="action-btn">
                    Regenerate
                  </button>
                  <button onClick={() => goToNextVersion('cv')} disabled={cvCurrentIndex === cvVersions.length - 1}>
                    Next &gt;
                  </button>
                </div>
              </div>
              <CV_Cover_Display content={cvVersions[cvCurrentIndex]} />
              <DocumentDownloadButtons
                user_id={user_id}
                cvText={cvVersions[cvCurrentIndex]}
                coverText={coverVersions[coverCurrentIndex]}
                activeTab={activeTab}
                onTokenFail={() => setShowBuyPanel(true)}
              />
            </>
          ) : (
            <CV_Cover_Display user_id={user_id} analysis={analysisText} content={null} />
          )}
        </div>
      )}


      {activeTab === 'cover' && (
        <div>
          {coverVersions.length > 0 ? (
            <>
              <div className="flex flex-col items-center mb-4">
                <div className="mb-2 text-sm font-bold text-gray-800">
                  Version {coverCurrentIndex + 1} of {coverVersions.length}
                </div>
                <div className="flex flex-row gap-4">
                  <button onClick={() => goToPrevVersion('cover')} disabled={coverCurrentIndex === 0}>
                    &lt; Prev
                  </button>
                  <button onClick={() => setShowModal('regenerate')} className="action-btn">
                    Regenerate
                  </button>
                  <button onClick={() => goToNextVersion('cover')} disabled={coverCurrentIndex === coverVersions.length - 1}>
                    Next &gt;
                  </button>
                </div>
              </div>
              <CV_Cover_Display content={coverVersions[coverCurrentIndex]} />
              <DocumentDownloadButtons
                user_id={user_id}
                cvText={cvVersions[cvCurrentIndex]}
                coverText={coverVersions[coverCurrentIndex]}
                activeTab={activeTab}
                onTokenFail={() => setShowBuyPanel(true)}
              />
            </>
          ) : (
            <CV_Cover_Display user_id={user_id} analysis={analysisText} content={null} />
          )}
        </div>
      )}

      {showModal === 'startFresh' && (
      <StartFreshModal
        user_id={user_id}
        onClose={() => setShowModal(false)}
        onSubmit={handleSubmit}
        onStartFresh={startFresh}
      />
    )}



      {showModal === 'regenerate' && (
        <ToneDocModal
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
        />
      )}


      {showModal === true && (
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

      {showLoadingModal && (
        <LoadingModal
          title={loadingModalTitle}
          message={loadingModalMessage}
          onClose={() => setShowLoadingModal(false)}
        />
      )}
    </div>
  );
}
