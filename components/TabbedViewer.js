// components/TabbedViewer.js
import { logGemini } from '../utils/log-gemini.js';
import { readHeadline } from '../utils/cv-headline.js';

function logBlueprint(analysisJson) {
  try {
    const parsed = typeof analysisJson === 'string' ? JSON.parse(analysisJson) : analysisJson;
    const blueprint = parsed?.generation_framework?.cv_blueprint;
    if (blueprint) {
      console.group('[Blueprint] generation_framework.cv_blueprint');
      console.log('target_length_pages:', blueprint.target_length_pages);
      console.log('section_order:', blueprint.section_order);
      console.log('job_selection:', blueprint.job_selection);
      console.log('summary_draft:', blueprint.summary_draft);
      console.log('skills_to_highlight:', blueprint.skills_to_highlight);
      console.groupEnd();
    } else {
      console.warn('[Blueprint] generation_framework.cv_blueprint is MISSING from analysis');
    }
  } catch {
    console.warn('[Blueprint] Could not parse analysis JSON');
  }
}
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
  // Output language chosen for the most recent generation — reused by regenerate.
  const [lastLanguage, setLastLanguage] = useState('auto');
  const [docs, setDocs] = useState({ cv: null, cover: null });
  const [showBuilder, setShowBuilder] = useState(false);
  const [showBuyPanel, setShowBuyPanel] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [cvVersions, setCvVersions] = useState([]);
  // Layer 6 output-validation warnings (checks 5-9) for the CV last generated —
  // hard failures never reach the browser, these are the ones the user decides about.
  const [cvWarnings, setCvWarnings] = useState([]);
  const [coverVersions, setCoverVersions] = useState([]);
  const [cvCurrentIndex, setCvCurrentIndex] = useState(0);
  const [coverCurrentIndex, setCoverCurrentIndex] = useState(0);
  const [showLoadingModal, setShowLoadingModal] = useState(false);
  const [loadingModalMessage, setLoadingModalMessage] = useState('');
  const [loadingModalTitle, setLoadingModalTitle] = useState('');
  const [panelMode, setPanelMode] = useState("tokens");
  // Download-token balance handed to TokenPurchasePanel. The panel picks its
  // content from this number, so opening the panel without it renders an empty
  // box — always open via openBuyPanel(), never by setting showBuyPanel directly.
  const [tokensRemaining, setTokensRemaining] = useState(null);
  // Tone the current pair was written in — reused by the headline controls so a
  // re-rolled headline stays in the same voice as the document around it.
  const [lastTone, setLastTone] = useState('Formal');
  // Inline headline editing on the CV tab.
  const [headlineDraft, setHeadlineDraft] = useState('');
  const [headlineBusy, setHeadlineBusy] = useState(false);
  // Hand-editing the generated document before download. `editing` is the tab
  // whose document is open in the editor ('cv' | 'cover' | null).
  const [editing, setEditing] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [editBusy, setEditBusy] = useState(false);

  // Single entry point for the buy panel: resolves the token balance first so
  // the panel always has the number it needs. `knownTokens` skips the fetch
  // when the caller has just read it.
  const openBuyPanel = async (mode, knownTokens) => {
    let tokens = knownTokens;
    if (typeof tokens !== 'number') {
      try {
        const res = await fetch(`/api/tokens?user_id=${user_id}`);
        const data = await res.json();
        tokens = res.ok && typeof data.tokens === 'number' ? data.tokens : 0;
      } catch {
        tokens = 0;
      }
    }
    setTokensRemaining(tokens);
    setPanelMode(mode);
    setShowBuyPanel(true);
  };

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
        logBlueprint(e.detail.analysis);
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
    if (analysisText) logBlueprint(analysisText);
    setAnalysisTextState(analysisText);
  }, [analysisText]);

  // Restore the last generated CV/cover from the DB on (re)load, so a refresh
  // doesn't wipe the documents the user already paid to generate. Only seeds
  // when nothing has been generated yet this session, to avoid clobbering
  // freshly-generated versions.
  useEffect(() => {
    if (!user_id) return;
    fetch('/api/get-docs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        if (data.cv) {
          setCvVersions((prev) => (prev.length === 0 ? [data.cv] : prev));
        }
        if (data.cover) {
          setCoverVersions((prev) => (prev.length === 0 ? [data.cover] : prev));
        }
      })
      .catch(() => {});
  }, [user_id]);

  const currentCv = cvVersions[cvCurrentIndex] || '';

  // An open editor belongs to one version of one document — leaving that view
  // closes it, so a save can never land on the document the user moved to.
  useEffect(() => {
    setEditing(null);
  }, [activeTab, cvCurrentIndex, coverCurrentIndex]);

  // Keep the editable headline field in step with whichever CV version is shown.
  useEffect(() => {
    setHeadlineDraft(readHeadline(currentCv));
  }, [currentCv]);

  // One entry point for all three headline actions. The route returns the full
  // updated CV (and persists it the same way a generated CV is persisted), so
  // the version on screen is replaced IN PLACE — a headline tweak is an edit of
  // this version, not a new one.
  const changeHeadline = async (action, headline = '') => {
    if (!currentCv || headlineBusy) return;
    setHeadlineBusy(true);
    try {
      const res = await fetch('/api/cv-headline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          headline,
          content: currentCv,
          analysis: analysisTextState,
          tone: lastTone,
          language: lastLanguage,
        }),
      });
      const data = await res.json();
      if (data.gemini_usage) logGemini(data.gemini_usage);
      if (!res.ok) {
        alert(data.error || t('headlineFailed'));
        return;
      }
      setCvVersions((prev) => prev.map((v, i) => (i === cvCurrentIndex ? data.cv : v)));
      setHeadlineDraft(data.headline || '');
    } catch (error) {
      console.error('Headline error:', error);
      alert(t('headlineFailed'));
    } finally {
      setHeadlineBusy(false);
    }
  };

  // Open the plain-markdown editor on whichever version is currently shown.
  const startEditing = (docType) => {
    setEditDraft(docType === 'cv' ? currentCv : coverVersions[coverCurrentIndex] || '');
    setEditing(docType);
  };

  // Save the user's edits. Like a headline change, this is an edit OF this
  // version, not a new one, so the version on screen is replaced in place.
  const saveEdit = async () => {
    const docType = editing;
    if (!docType || editBusy || !editDraft.trim()) return;
    setEditBusy(true);
    try {
      const res = await fetch('/api/save-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: docType, content: editDraft, tone: lastTone }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || t('editFailed'));
        return;
      }
      if (docType === 'cv') {
        setCvVersions((prev) => prev.map((v, i) => (i === cvCurrentIndex ? data.content : v)));
      } else {
        setCoverVersions((prev) => prev.map((v, i) => (i === coverCurrentIndex ? data.content : v)));
      }
      setEditing(null);
    } catch (error) {
      console.error('Edit save error:', error);
      alert(t('editFailed'));
    } finally {
      setEditBusy(false);
    }
  };

  const handleSubmit = async ({ tone, selected, jobText, tweak = '', language = 'auto' }) => {
    // Remember it so a regenerate stays in the language the pair was written in
    // instead of silently reverting to the master CV's language.
    setLastLanguage(language);
    setLastTone(tone);
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

      // Writing is free — block only when the free-write allowance is short,
      // never on paid tokens (those are for downloads).
      const tokensRes = await fetch(`/api/tokens?user_id=${user_id}`);
      const tokensData = await tokensRes.json();
      if (!tokensRes.ok || tokensData.generations_left < selected.length) {
        setShowModal(false);
        await openBuyPanel("generations", tokensData.tokens);
        setShowLoadingModal(false);
        return;
      }

      // SEQUENTIAL, not parallel. The route holds a per-user Redis `gen_lock`
      // (NX, 30s) to stop double-submissions, so firing CV and cover at the same
      // time meant the second request lost the race and came back 429 — the
      // cover letter silently never arrived while the CV succeeded. One at a
      // time: the lock is released before the next call asks for it.
      for (const docType of selected) {
        const res = await fetch('/api/generate-cv-cover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id, analysis: jobText || analysisTextState, tone, type: docType, tweak, language }),
        });
        const data = await res.json();
        if (data.gemini_usage) logGemini(data.gemini_usage);
        if (!res.ok) {
          if (data.detail) console.error('[Generation detail]', JSON.stringify(data.detail, null, 2));
          if (data.error === "NO_GENERATIONS_LEFT") {
            await openBuyPanel("generations");
            throw new Error("Stopped: Out of generations");
          }
          if (data.error === "NO_TOKENS_LEFT") {
            await openBuyPanel("tokens");
            throw new Error("Stopped: Out of tokens");
          }
          throw new Error(data.error || `Generation failed for ${docType}`);
        }
        if (data.cv) {
          setCvVersions(prev => {
            const newVersions = [...prev, data.cv];
            setCvCurrentIndex(newVersions.length - 1);
            return newVersions;
          });
          setCvWarnings(data.cv_warnings || []);
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
      }

      setShowModal(false);
      window.dispatchEvent(new Event('header-stats-updated'));

    } catch (error) {
      console.error("Generation error:", error);
    } finally {
      setShowLoadingModal(false);
    }
  };

  const handleRegen = async (docType, tone) => {
    setLastTone(tone);
    setShowLoadingModal(true);
    setLoadingModalTitle(docType === 'cv' ? t('regeneratingCvTitle') : t('regeneratingCoverTitle'));
    setLoadingModalMessage(t('regenMsg'));

    try {
      const res = await fetch('/api/generate-cv-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id, analysis: analysisTextState, tone, type: docType, language: lastLanguage }),
      });
      const data = await res.json();
      if (data.gemini_usage) logGemini(data.gemini_usage);
      if (!res.ok) {
        if (data.error === "NO_GENERATIONS_LEFT") {
          await openBuyPanel("generations");
          return;
        }
        if (data.error === "NO_TOKENS_LEFT") {
          await openBuyPanel("tokens");
          return;
        }
        alert(data.error || t('regenFailed'));
        return;
      }

      setLoadingModalMessage(t('addingNewVersion'));
      if (data.cv) {
        setCvVersions(prev => [...prev, data.cv]);
        setCvCurrentIndex(cvVersions.length);
        setCvWarnings(data.cv_warnings || []);
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

  // The document body: either the rendered markdown or, in edit mode, the raw
  // markdown in a textarea. Shared by the CV and cover tabs — one behaviour.
  const renderDocument = (docType, content) => (
    editing === docType ? (
      <div className="mx-auto max-w-4xl border border-accent rounded-lg p-3 sm:p-4">
        <textarea
          value={editDraft}
          disabled={editBusy}
          onChange={(e) => setEditDraft(e.target.value)}
          rows={28}
          className="w-full p-3 border border-gray-300 rounded bg-white font-mono text-sm disabled:opacity-50"
        />
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            onClick={saveEdit}
            disabled={editBusy || !editDraft.trim() || editDraft === content}
            className="action-btn px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('editSave')}
          </button>
          <button
            onClick={() => setEditing(null)}
            disabled={editBusy}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('editCancel')}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {editBusy ? t('editWorking') : t('editHint')}
        </p>
      </div>
    ) : (
      <>
        <div className="text-center mb-4">
          <button
            onClick={() => startEditing(docType)}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          >
            {t('editDocument')}
          </button>
        </div>
        <CV_Cover_Display content={content} />
      </>
    )
  );

  const tabs = [
    { id: 'analysis', label: t('analysis') },
    { id: 'cv', label: t('cv') },
    { id: 'cover', label: t('cover') },
  ];
  const startFresh = () => {};

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

                {cvWarnings.length > 0 && (
                  <div className="mb-4 sm:mb-6 mx-auto max-w-2xl rounded-lg border border-amber-300 bg-amber-50 p-3 sm:p-4">
                    <div className="text-sm font-bold text-amber-900">{t('cvWarningsTitle')}</div>
                    <ul className="mt-2 list-disc pl-5 text-sm text-amber-900">
                      {cvWarnings.map((w, i) => (
                        <li key={i}>{t(`cvWarning.${w.code}`, { ...(w.params || {}), defaultValue: w.code })}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mb-4 sm:mb-6 mx-auto max-w-2xl border border-accent rounded-lg p-3 sm:p-4">
                  <label htmlFor="cv-headline" className="block mb-2 text-sm font-bold text-gray-800">
                    {t('headlineLabel')}
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      id="cv-headline"
                      type="text"
                      value={headlineDraft}
                      disabled={headlineBusy}
                      placeholder={t('headlinePlaceholder')}
                      onChange={(e) => setHeadlineDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (headlineDraft.trim()) changeHeadline('set', headlineDraft);
                        }
                      }}
                      className="flex-1 p-2 border border-gray-300 rounded bg-white text-sm sm:text-base disabled:opacity-50"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => changeHeadline('set', headlineDraft)}
                        disabled={headlineBusy || !headlineDraft.trim() || headlineDraft.trim() === readHeadline(currentCv)}
                        className="action-btn px-3 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t('headlineSave')}
                      </button>
                      <button
                        onClick={() => changeHeadline('regenerate')}
                        disabled={headlineBusy}
                        className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t('headlineRegenerate')}
                      </button>
                      <button
                        onClick={() => changeHeadline('remove')}
                        disabled={headlineBusy || !readHeadline(currentCv)}
                        className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t('headlineRemove')}
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    {headlineBusy ? t('headlineWorking') : t('headlineHint')}
                  </p>
                </div>

                {renderDocument('cv', cvVersions[cvCurrentIndex])}

                <div className="mt-6 sm:mt-8">
                  <DocumentDownloadButtons
                    user_id={user_id}
                    cvText={cvVersions[cvCurrentIndex]}
                    coverText={coverVersions[coverCurrentIndex]}
                    activeTab={activeTab}
                    onTokenFail={() => openBuyPanel("tokens")}
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

                {renderDocument('cover', coverVersions[coverCurrentIndex])}

                <div className="mt-6 sm:mt-8">
                  <DocumentDownloadButtons
                    user_id={user_id}
                    cvText={cvVersions[cvCurrentIndex]}
                    coverText={coverVersions[coverCurrentIndex]}
                    activeTab={activeTab}
                    onTokenFail={() => openBuyPanel("tokens")}
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
            tokensRemaining={tokensRemaining ?? 0}
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
