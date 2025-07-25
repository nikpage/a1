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

  // Clear analysis event listener
  useEffect(() => {
    const clear = () => {
      setAnalysisTextState(null);
      // Also clear all document data when clearing analysis
      setCvVersions([]);
      setCoverVersions([]);
      setCvCurrentIndex(0);
      setCoverCurrentIndex(0);
      setDocs({ cv: null, cover: null });
      setActiveTab('analysis');
    };
    window.addEventListener('clear-analysis', clear);
    return () => window.removeEventListener('clear-analysis', clear);
  }, []);

  // New analysis event listener - properly update state and clear old data
  useEffect(() => {
    const onNewAnalysis = (e) => {
      if (e.detail?.analysis) {
        // Update analysis text state
        setAnalysisTextState(e.detail.analysis);

        // Clear all old document data
        setCvVersions([]);
        setCoverVersions([]);
        setCvCurrentIndex(0);
        setCoverCurrentIndex(0);
        setDocs({ cv: null, cover: null });

        // Reset UI state
        setShowBuilder(false);
        setActiveTab('analysis');
      }
    };
    window.addEventListener('new-analysis', onNewAnalysis);
    return () => window.removeEventListener('new-analysis', onNewAnalysis);
  }, []);

  // Update analysisTextState when prop changes
  useEffect(() => {
    setAnalysisTextState(analysisText);
  }, [analysisText]);

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
          setShowLoadingModal(false);
          return;
        }

        const tokensRes = await fetch(`/api/tokens?user_id=${user_id}`);
        const tokensData = await tokensRes.json();
        if (!tokensRes.ok || tokensData.tokens < selected.length) {
          setShowBuyPanel(true);
          setShowLoadingModal(false);
          return;
        }

        // Create and immediately handle each request individually
        const generationPromises = selected.map(docType => {
          return fetch('/api/generate-cv-cover', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id, analysis: jobText || analysisTextState, tone, type: docType }),
          })
          .then(async (res) => {
            const data = await res.json();
            if (!res.ok) {
              throw new Error(data.error || `Generation failed for ${docType}`);
            }
            return data;
          })
          .then(data => {
            // This is the key change: update the UI as soon as data arrives
            if (data.cv) {
              setCvVersions(prev => {
                const newVersions = [...prev, data.cv];
                setCvCurrentIndex(newVersions.length - 1);
                return newVersions;
              });
              setActiveTab('cv');
            }
            if (data.cover) {
              setCoverVersions(prev => {
                const newCovers = [...prev, data.cover];
                setCoverCurrentIndex(newCovers.length - 1);
                return newCovers;
              });
              setActiveTab('cover');
            }
          });
        });

        // Wait for all requests to finish before closing the modals
        await Promise.all(generationPromises);
        setShowModal(false);
        window.dispatchEvent(new Event('header-stats-updated'));

      } catch (error) {
        console.error("Generation error:", error);
        alert(error.message || "An error occurred during document generation.");
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
        body: JSON.stringify({ user_id, analysis: analysisTextState, tone, type: docType }),
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

  useEffect(() => {
    if (window.location.search.includes('success=true')) {
      setShowBuyPanel(true); // show the modal once after Stripe redirect
    }
  }, []);

  useLayoutEffect(() => {
    const prevScroll = window.scrollY;
    setTimeout(() => {
      window.scrollTo(0, prevScroll);
    }, 1);
  }, [activeTab]);

  return (
    <div className="doc-viewer px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Start Fresh Button */}
      <div className="text-center mb-6">
        <button
          onClick={() => setShowModal('startFresh')}
          className="action-btn px-4 py-2 sm:px-6 sm:py-3 text-sm sm:text-base"
        >
          Start Fresh
        </button>
      </div>

      {/* Responsive Tab Navigation */}
      <div className="flex flex-col sm:flex-row border-b border-accent bg-bg mb-6 sm:mb-8">
        {/* Mobile: Dropdown-style tabs */}
        <div className="sm:hidden">
          <select
            value={activeTab}
            onChange={(e) => {
              const tabId = e.target.value;
              const tab = tabs.find(t => t.id === tabId);
              const isDisabled =
                (tab.id === 'cv' && cvVersions.length === 0) ||
                (tab.id === 'cover' && coverVersions.length === 0);

              if (isDisabled) {
                alert(`No ${tab.label} available`);
              } else {
                setActiveTab(tabId);
              }
            }}
            className="w-full p-3 border border-gray-300 rounded-lg bg-white text-base"
          >
            {tabs.map(tab => {
              const isDisabled =
                (tab.id === 'cv' && cvVersions.length === 0) ||
                (tab.id === 'cover' && coverVersions.length === 0);

              return (
                <option
                  key={tab.id}
                  value={tab.id}
                  disabled={isDisabled}
                >
                  {tab.label} {isDisabled ? '(Not Available)' : ''}
                </option>
              );
            })}
          </select>
        </div>

        {/* Desktop: Horizontal tabs */}
        <div className="hidden sm:flex sm:gap-6 lg:gap-12">
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
                className={`tab-btn text-sm sm:text-base px-2 py-3 sm:px-4 ${
                  activeTab === tab.id ? 'active' : ''
                } ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'analysis' && (
          <div>
            {analysisTextState ? (
              <>
                <AnalysisDisplay analysis={analysisTextState} />
                {!showBuilder && (
                  <div className="text-center mt-6 sm:mt-8">
                    <button
                      onClick={() => setShowModal(true)}
                      className="action-btn px-4 py-2 sm:px-6 sm:py-3 text-sm sm:text-base"
                    >
                      Write Now!
                    </button>
                  </div>
                )}
                {showBuilder && (
                  <CV_Cover_Display user_id={user_id} analysis={analysisTextState} content={docs.cv} />
                )}
              </>
            ) : (
              <div className="text-center py-8 sm:py-12">
                <p className="text-gray-600 text-base sm:text-lg">No analysis available</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'cv' && (
          <div>
            {cvVersions.length > 0 ? (
              <>
                {/* Version Controls */}
                <div className="flex flex-col items-center mb-4 sm:mb-6">
                  <div className="mb-3 text-sm font-bold text-gray-800">
                    Version {cvCurrentIndex + 1} of {cvVersions.length}
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4">
                    <button
                      onClick={() => goToPrevVersion('cv')}
                      disabled={cvCurrentIndex === 0}
                      className="px-3 py-2 text-xl font-bold bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded"
                      aria-label="Previous Version"
                    >
                      &larr;
                    </button>
                    <button
                      onClick={() => setShowModal('regenerate')}
                      className="action-btn px-4 py-2 text-sm sm:text-base"
                    >
                      Regenerate
                    </button>
                    <button
                      onClick={() => goToNextVersion('cv')}
                      disabled={cvCurrentIndex === cvVersions.length - 1}
                      className="px-3 py-2 text-xl font-bold bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded"
                      aria-label="Next Version"
                    >
                      &rarr;
                    </button>
                  </div>
                </div>

                <CV_Cover_Display content={cvVersions[cvCurrentIndex]} />

                <div className="mt-6 sm:mt-8">
                  <DocumentDownloadButtons
                    user_id={user_id}
                    cvText={cvVersions[cvCurrentIndex]}
                    coverText={coverVersions[coverCurrentIndex]}
                    activeTab={activeTab}
                    onTokenFail={() => setShowBuyPanel(true)}
                  />
                </div>
              </>
            ) : (
              <CV_Cover_Display user_id={user_id} analysis={analysisTextState} content={null} />
            )}
          </div>
        )}

        {activeTab === 'cover' && (
          <div>
            {coverVersions.length > 0 ? (
              <>
                {/* Version Controls */}
                <div className="flex flex-col items-center mb-4 sm:mb-6">
                  <div className="mb-3 text-sm font-bold text-gray-800">
                    Version {coverCurrentIndex + 1} of {coverVersions.length}
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4">
                    <button
                      onClick={() => goToPrevVersion('cover')}
                      disabled={coverCurrentIndex === 0}
                      className="px-3 py-2 text-xl font-bold bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded"
                      aria-label="Previous Version"
                    >
                      &larr;
                    </button>
                    <button
                      onClick={() => setShowModal('regenerate')}
                      className="action-btn px-4 py-2 text-sm sm:text-base"
                    >
                      Regenerate
                    </button>
                    <button
                      onClick={() => goToNextVersion('cover')}
                      disabled={coverCurrentIndex === coverVersions.length - 1}
                      className="px-3 py-2 text-xl font-bold bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded"
                      aria-label="Next Version"
                    >
                      &rarr;
                    </button>
                  </div>
                </div>

                <CV_Cover_Display content={coverVersions[coverCurrentIndex]} />

                <div className="mt-6 sm:mt-8">
                  <DocumentDownloadButtons
                    user_id={user_id}
                    cvText={cvVersions[cvCurrentIndex]}
                    coverText={coverVersions[coverCurrentIndex]}
                    activeTab={activeTab}
                    onTokenFail={() => setShowBuyPanel(true)}
                  />
                </div>
              </>
            ) : (
              <CV_Cover_Display user_id={user_id} analysis={analysisTextState} content={null} />
            )}
          </div>
        )}
      </div>

      {/* Modals */}
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl">
            <DownloadTokenPanel
              onClose={() => setShowBuyPanel(false)}
              user_id={user_id}
              forceShowBuy={!window.location.search.includes('success=true')}
            />
          </div>
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
