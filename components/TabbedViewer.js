// components/TabbedViewer.js
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
import TokenPurchasePanel from './TokenPurchasePanel';
import { useState, useEffect, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function TabbedViewer({ user_id, analysisText }) {
  const { t } = useTranslation('tabbedViewer');
  const [analysisTextState, setAnalysisTextState] = useState(analysisText);
  const [activeTab, setActiveTab] = useState('analysis');
  const [docs, setDocs] = useState({ cv: null, cover: null });
  const [showBuilder, setShowBuilder] = useState(false);
  const [showBuyPanel, setShowBuyPanel] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [showModal, setShowModal] = useState(true);
  const [cvVersions, setCvVersions] = useState([]);
  const [coverVersions, setCoverVersions] = useState([]);
  const [cvCurrentIndex, setCvCurrentIndex] = useState(0);
  const [coverCurrentIndex, setCoverCurrentIndex] = useState(0);
  const [showLoadingModal, setShowLoadingModal] = useState(false);
  const [loadingModalMessage, setLoadingModalMessage] = useState('');
  const [loadingModalTitle, setLoadingModalTitle] = useState('');
  const [panelMode, setPanelMode] = useState("tokens");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      setShowThankYou(true);
    }
  }, []);

  useEffect(() => {
    const clear = () => {
      setAnalysisTextState(null);
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

  useEffect(() => {
    const onNewAnalysis = (e) => {
      if (e.detail?.analysis) {
        setAnalysisTextState(e.detail.analysis);
        setCvVersions([]);
        setCoverVersions([]);
        setCvCurrentIndex(0);
        setCoverCurrentIndex(0);
        setDocs({ cv: null, cover: null });
        setShowBuilder(false);
        setActiveTab('analysis');
      }
    };
    window.addEventListener('new-analysis', onNewAnalysis);
    return () => window.removeEventListener('new-analysis', onNewAnalysis);
  }, []);

  useEffect(() => {
    setAnalysisTextState(analysisText);
  }, [analysisText]);

  const handleSubmit = async ({ tone, selected, jobText }) => {
    setShowLoadingModal(true);
    setLoadingModalTitle(t('generatingDocsTitle'));
    setLoadingModalMessage(t('generatingDocsMsg'));

    try {
      if (!selected || !Array.isArray(selected) || selected.length === 0) {
        alert(t('selectDocError'));
        setShowModal(false);
        setShowLoadingModal(false);
        return;
      }

      const tokensRes = await fetch(`/api/tokens?user_id=${user_id}`);
      const tokensData = await tokensRes.json();
      if (!tokensRes.ok || tokensData.tokens < selected.length) {
        setShowModal(false);
        setShowBuyPanel(true);
        setShowLoadingModal(false);
        return;
      }

      const generationPromises = selected.map(docType => {
        return fetch('/api/generate-cv-cover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id, analysis: jobText || analysisTextState, tone, type: docType }),
        })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) {
            if (data.error === "NO_GENERATIONS_LEFT") {
              setPanelMode("generations");
              setShowBuyPanel(true);
              throw new Error("Stopped: Out of generations");
            }
            if (data.error === "NO_TOKENS_LEFT") {
              setPanelMode("tokens");
              setShowBuyPanel(true);
              throw new Error("Stopped: Out of tokens");
            }
            throw new Error(data.error || `Generation failed for ${docType}`);
          }
          return data;
        })
        .then(data => {
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

      await Promise.all(generationPromises);
      setShowModal(false);
      window.dispatchEvent(new Event('header-stats-updated'));

    } catch (error) {
      console.error("Generation error:", error);
    } finally {
      setShowLoadingModal(false);
    }
  };

  const handleRegen = async (docType, tone) => {
    setShowLoadingModal(true);
    setLoadingModalTitle(docType === 'cv' ? t('regeneratingCvTitle') : t('regeneratingCoverTitle'));
    setLoadingModalMessage(t('regenMsg'));

    try {
      const res = await fetch('/api/generate-cv-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id, analysis: analysisTextState, tone, type: docType }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "NO_GENERATIONS_LEFT") {
          setPanelMode("generations");
          setShowBuyPanel(true);
          return;
        }
        if (data.error === "NO_TOKENS_LEFT") {
          setPanelMode("tokens");
          setShowBuyPanel(true);
          return;
        }
        alert(data.error || t('regenFailed'));
        return;
      }

      setLoadingModalMessage(t('addingNewVersion'));
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
    } finally {
      setShowLoadingModal(false);
    }
  };

  const tabs = [
    { id: 'analysis', label: t('analysis') },
    { id: 'cv', label: t('cv') },
    { id: 'cover', label: t('cover') },
  ];

  return (
    <div className="doc-viewer px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="text-center mb-6">
        <button
          onClick={() => setShowModal('startFresh')}
          className="action-btn px-4 py-2 sm:px-6 sm:py-3 text-sm sm:text-base"
        >
          {t('startFresh')}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row border-b border-accent bg-bg mb-6 sm:mb-8">
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
                alert(t('noAvailableAlert', { label: tab.label }));
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
                <option key={tab.id} value={tab.id} disabled={isDisabled}>
                  {tab.label} {isDisabled ? `(${t('tabNotAvailable')})` : ''}
                </option>
              );
            })}
          </select>
        </div>

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
                    alert(t('noAvailableAlert', { label: tab.label }));
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
                      {t('writeNow')}
                    </button>
                  </div>
                )}
                {showBuilder && (
                  <CV_Cover_Display user_id={user_id} analysis={analysisTextState} content={docs.cv} />
                )}
              </>
            ) : (
              <div className="text-center py-8 sm:py-12">
                <p className="text-gray-600 text-base sm:text-lg">{t('noAnalysis')}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'cv' && (
          <div>
            {cvVersions.length > 0 ? (
              <>
                <div className="flex flex-col items-center mb-4 sm:mb-6">
                  <div className="mb-3 text-sm font-bold text-gray-800">
                    {t('versionOf', { current: cvCurrentIndex + 1, total: cvVersions.length })}
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4">
                    <button
                      onClick={() => goToPrevVersion('cv')}
                      disabled={cvCurrentIndex === 0}
                      className="px-3 py-2 text-xl font-bold bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded"
                      aria-label={t('prevVersion')}
                    >
                      &larr;
                    </button>
                    <button
                      onClick={() => setShowModal('regenerate')}
                      className="action-btn px-4 py-2 text-sm sm:text-base"
                    >
                      {t('regenerate')}
                    </button>
                    <button
                      onClick={() => goToNextVersion('cv')}
                      disabled={cvCurrentIndex === cvVersions.length - 1}
                      className="px-3 py-2 text-xl font-bold bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded"
                      aria-label={t('nextVersion')}
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
                <div className="flex flex-col items-center mb-4 sm:mb-6">
                  <div className="mb-3 text-sm font-bold text-gray-800">
                    {t('versionOf', { current: coverCurrentIndex + 1, total: coverVersions.length })}
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4">
                    <button
                      onClick={() => goToPrevVersion('cover')}
                      disabled={coverCurrentIndex === 0}
                      className="px-3 py-2 text-xl font-bold bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded"
                      aria-label={t('prevVersion')}
                    >
                      &larr;
                    </button>
                    <button
                      onClick={() => setShowModal('regenerate')}
                      className="action-btn px-4 py-2 text-sm sm:text-base"
                    >
                      {t('regenerate')}
                    </button>
                    <button
                      onClick={() => goToNextVersion('cover')}
                      disabled={coverCurrentIndex === coverVersions.length - 1}
                      className="px-3 py-2 text-xl font-bold bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded"
                      aria-label={t('nextVersion')}
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

      {showModal === 'startFresh' && (
        <StartFreshModal
          user_id={user_id}
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
          onStartFresh={startFresh}
        />
      )}

      {(showModal === true || showModal === 'regenerate') && (
        <ToneDocModal
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
        />
      )}

      {showBuyPanel && (
        <BaseModal onClose={() => setShowBuyPanel(false)}>
          <TokenPurchasePanel
            onClose={() => setShowBuyPanel(false)}
            user_id={user_id}
            mode={panelMode}
          />
        </BaseModal>
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
