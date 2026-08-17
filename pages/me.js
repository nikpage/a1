// pages/me.js
//
// Personal workbench — one page, the whole loop, no funnel.
//
// The page is ordered by how often each thing is actually done:
//
//   The record   collapsed to one line. It is built once and topped up rarely,
//                so it sits in a bar at the top and only opens when asked (or
//                when there is no master yet, or open questions to settle).
//                Inside, its three jobs — open questions, edit, add — are three
//                separate collapsed sections; open questions is the only one
//                that starts open, and only when there are any.
//   Job → Fit    paste the ad, run the analysis, and READ IT. The analysis is
//                rendered through the same AnalysisDisplay the viewer uses —
//                never reduced to a "ready" tick, which told me nothing.
//   Steer → Write  the steering sits BESIDE the documents, so the CV can be
//                read while the instructions that produced it are adjusted.
//   Send         the documents are editable in place; the download buttons take
//                the edited text, so a last-minute fix ships.
//   Set up once  the voice profile and the AI ledger. Below everything, closed,
//                and not mounted until opened.
//
// The two steps done for every application are numbered (1 The job, 2 Write) and
// always open; everything else is behind a collapsed section. Nothing was
// removed — only re-tiered by how often it is used.
//
// Every call goes through the existing shared paths (uploadAndAnalyze,
// /api/master-add-info, /api/resolve-flag, generate-background) — this page adds
// UI, live phase text and the steering composition, nothing else. The session
// cookie decides whose record this is, so /me is always the signed-in user's own.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { roles } from '../utils/master-read';
import Head from 'next/head';
import Header from '../components/Header';
import MasterFlagFixer from '../components/MasterFlagFixer';
import AddInfoPanel from '../components/AddInfoPanel';
import MasterRecordPanel from '../components/MasterRecordPanel';
import AnalysisDisplay from '../components/AnalysisDisplay';
import DocumentDownloadButtons from '../components/DocumentDownloadButtons';
import CvWarningBanner from '../components/CvWarningBanner';
import VoiceProfilePanel from '../components/VoiceProfilePanel';
import AiCostPanel from '../components/AiCostPanel';
import CollapsibleSection from '../components/CollapsibleSection';
import { uploadAndAnalyze } from '../utils/uploadAndAnalyze';
import { logGemini } from '../utils/log-gemini.js';
import { generateDocuments } from '../utils/generateDocuments';
import { composeTweak } from '../utils/steering';
import { verifyToken, getTokenFromReq } from '../lib/auth';
import { getUserStats } from '../utils/database';
import { GENERATION_LANGUAGES } from '../prompts/language';
import { OFFERED_TONES as TONES } from '../prompts/tone';



// The analysis arrives as the stored gen_data payload — a JSON string. Parsed
// here only to label the fit header (position / company / score); the readout
// itself is AnalysisDisplay's job and it parses defensively on its own.
function analysisHeadline(analysis) {
  if (!analysis) return null;
  let data;
  try {
    const raw = typeof analysis === 'string'
      ? analysis.trim().replace(/^```json/, '').replace(/```$/, '').trim()
      : analysis;
    data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  // The "0-10" sentinel is the schema's own placeholder for a score that was
  // never produced (see utils/formatAnalysis.js), so it counts as absent.
  const real = (v) => {
    const s = String(v ?? '').trim();
    return s && !['n/a', 'na', 'none', 'null', 'undefined', '0-10'].includes(s.toLowerCase()) ? s : null;
  };
  const position = real(data?.job_data?.Position);
  const company = real(data?.job_data?.Company);
  return {
    title: position ? [position, company].filter(Boolean).join(' · ') : 'Standalone CV review',
    overall: real(data?.analysis?.overall_score),
    ats: real(data?.analysis?.ats_score),
  };
}

export default function MePage({ user_id, generationsRemaining, docDownloadsRemaining }) {
  const [analysis, setAnalysis] = useState('');
  const [flags, setFlags] = useState([]);
  const [experience, setExperience] = useState([]);
  const [master, setMaster] = useState(null);
  const [voiceProfile, setVoiceProfile] = useState(null);
  const [loadingRecord, setLoadingRecord] = useState(true);

  const [masterOpen, setMasterOpen] = useState(false);
  const [jobText, setJobText] = useState('');
  const [phase, setPhase] = useState('');          // live status of whatever is running
  const [busy, setBusy] = useState('');            // '' | 'upload' | 'analyse' | 'generate'

  const [tone, setTone] = useState('Formal');
  const [language, setLanguage] = useState('auto');
  const [emphasise, setEmphasise] = useState('');
  const [playDown, setPlayDown] = useState('');
  const [freeform, setFreeform] = useState('');

  const [cv, setCv] = useState('');
  const [cover, setCover] = useState('');
  const [warnings, setWarnings] = useState([]);
  // The letter's own Layer 6 warnings (checks 19-22). run-generation returns them
  // alongside cv_warnings; showing only the CV's meant a letter's findings were
  // computed on every run and seen by nobody.
  const [coverWarnings, setCoverWarnings] = useState([]);
  const [activeTab, setActiveTab] = useState('cv');
  const [error, setError] = useState('');

  const loadRecord = useCallback(async () => {
    try {
      const res = await fetch('/api/get-analysis', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id }),
      });
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data.analysis || '');
        setFlags(Array.isArray(data.flags) ? data.flags : []);
        setExperience(Array.isArray(data.experience) ? data.experience : []);
        setMaster(data.master || null);
        setVoiceProfile(data.voice_profile || null);
      }
    } catch {
      /* an empty record simply renders the upload box */
    }
    setLoadingRecord(false);
  }, [user_id]);

  useEffect(() => { loadRecord(); }, [loadRecord]);

  // No master yet, or questions left open on it — the record is the only thing
  // worth doing, so open it rather than making me hunt for the toggle.
  useEffect(() => {
    if (!loadingRecord && (!master || flags.length > 0)) setMasterOpen(true);
  }, [loadingRecord, master, flags.length]);

  const headline = useMemo(() => analysisHeadline(analysis), [analysis]);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setBusy('upload');
    setPhase('Reading the file…');
    try {
      await uploadAndAnalyze({
        file,
        user_id,
        onPing: () => setPhase('Building the master record…'),
      });
      await loadRecord();
    } catch (err) {
      setError(err.message);
    }
    setBusy('');
    setPhase('');
  }

  async function runAnalysis() {
    if (!jobText.trim()) return;
    setError('');
    setBusy('analyse');
    setPhase('Reading the ad…');
    try {
      await uploadAndAnalyze({
        user_id,
        jobText,
        // The confirmation modal exists to protect strangers from paying for a
        // misread ad. On my own workbench the extraction is accepted as-is.
        onJobExtracted: (extraction) => extraction,
        onPing: () => setPhase('Analysing the ad against my record…'),
      });
      await loadRecord();
    } catch (err) {
      setError(err.message);
    }
    setBusy('');
    setPhase('');
  }

  // ONE DOCUMENT PER CALL, one button each. The CV and the cover letter are
  // different documents with different rules: writing one never touches the
  // other, a failure loses only what was asked for, and the letter can be
  // rewritten against fresh steering while a CV that was already right stays on
  // screen untouched. `type` doubles as the busy flag, so only the button that
  // was pressed reads "Writing…".
  //
  // Both buttons are disabled while either runs — the run holds a per-user
  // Redis `gen_lock`, so a second request fired during the first loses the race
  // and comes back 429.
  async function generate(type) {
    if (!analysis) return;
    setError('');
    setBusy(type);
    setPhase(type === 'cv'
      ? 'Writing the CV, checking every fact against the record…'
      : 'Writing the cover letter, checking every fact against the record…');
    try {
      const data = await generateDocuments({
        analysis,
        tone,
        type,
        language,
        tweak: composeTweak({ emphasise, playDown, freeform }),
      });
      if (!data.ok) throw new Error(data.error || 'Generation failed');
      (data.gemini_usage || []).forEach(logGemini);
      if (type === 'cv') {
        setCv(data.cv || '');
        setWarnings(Array.isArray(data.cv_warnings) ? data.cv_warnings : []);
      } else {
        setCover(data.cover || '');
        setCoverWarnings(Array.isArray(data.cover_warnings) ? data.cover_warnings : []);
      }
      setActiveTab(type);
      window.dispatchEvent(new Event('header-stats-updated'));
      // The run is finished and its rows are in the ledger, so the cost panel
      // can show what this task cost without waiting for a page load.
      window.dispatchEvent(new Event('ai-costs-updated'));
    } catch (err) {
      setError(err.message);
    }
    setBusy('');
    setPhase('');
  }

  const running = Boolean(busy);
  const docs = Boolean(cv || cover);

  return (
    <>
      <Head>
        <title>My workbench</title>
        <link rel="icon" href="/favicon-32x32.png" />
      </Head>
      <Header
        user_id={user_id}
        generationsRemaining={generationsRemaining}
        docDownloadsRemaining={docDownloadsRemaining}
      />
      <main className="max-w-6xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
        )}

        {/* ── The record: one bar, opened on demand ─────────────────────── */}
        <div className="mb-6 border border-gray-200 rounded-lg bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            <button
              onClick={() => setMasterOpen((v) => !v)}
              className="text-sm font-medium text-gray-900 hover:text-blue-700"
            >
              {masterOpen ? '▾' : '▸'} My master record
            </button>
            <span className="text-sm text-gray-600">
              {loadingRecord
                ? 'loading…'
                : master
                  ? `${experience.length} role${experience.length === 1 ? '' : 's'} on file`
                  : 'no record yet — upload a CV to build it'}
            </span>
            {flags.length > 0 && (
              <span className="text-xs font-medium rounded-full bg-amber-100 text-amber-800 px-2 py-0.5">
                {flags.length} open question{flags.length === 1 ? '' : 's'}
              </span>
            )}
            <label className="ml-auto px-3 py-1.5 text-sm rounded bg-gray-800 text-white font-medium cursor-pointer">
              {busy === 'upload' ? 'Building…' : master ? 'Replace base CV' : 'Upload base CV'}
              <input type="file" accept=".pdf,.doc,.docx" className="hidden" disabled={running} onChange={handleUpload} />
            </label>
          </div>

          {/* The drawer holds three separate jobs — settle the open questions,
              edit the record, add something new. Stacked open they were one
              endless column and the questions (the only urgent one) sat under
              a 380-line form. Each is its own section now, and only the
              questions start open. */}
          {masterOpen && (
            <div className="border-t border-gray-200 px-4 py-4 space-y-3">
              {!loadingRecord && (experience.length > 0 || flags.length > 0) && (
                <CollapsibleSection
                  label="Open questions"
                  hint={flags.length > 0 ? 'answer these and the record is settled' : 'nothing outstanding'}
                  badge={flags.length > 0 ? `${flags.length} to answer` : null}
                  defaultOpen={flags.length > 0}
                >
                  <MasterFlagFixer
                    flags={flags}
                    experience={experience}
                    rebuilding={false}
                    onRecord={(saved, newFlags) => {
                      if (saved) {
                        setMaster(saved);
                        setExperience(roles(saved));
                      }
                      if (Array.isArray(newFlags)) setFlags(newFlags);
                    }}
                    onComplete={loadRecord}
                  />
                </CollapsibleSection>
              )}

              {master && (
                <CollapsibleSection
                  label="Edit the record"
                  hint="every role, date and fact — and how you write"
                >
                  <MasterRecordPanel
                    master={master}
                    onUpdated={(saved, newFlags) => {
                      setMaster(saved);
                      if (saved) setExperience(roles(saved));
                      if (Array.isArray(newFlags)) setFlags(newFlags);
                    }}
                  />
                </CollapsibleSection>
              )}

              <CollapsibleSection
                label="Add information"
                hint="something the CV never mentioned"
              >
                <AddInfoPanel onUpdated={(updated, newFlags) => {
                  if (updated) {
                    setMaster(updated);
                    if (updated) setExperience(roles(updated));
                  }
                  if (Array.isArray(newFlags)) setFlags(newFlags);
                }} />
              </CollapsibleSection>
            </div>
          )}
        </div>

        {/* ── The job and the fit ───────────────────────────────────────── */}
        <section className="border border-gray-200 rounded-lg shadow-sm bg-white p-5 mb-6">
          <h2 className="text-base font-semibold text-gray-900">
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">1</span>
            The job
          </h2>
          <div className="mt-3 grid gap-5 lg:grid-cols-2">
            <div>
              <textarea
                value={jobText}
                onChange={(e) => setJobText(e.target.value)}
                rows={14}
                disabled={running}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono disabled:opacity-60"
                placeholder="Paste the whole job ad here…"
              />
              <div className="mt-2 flex items-center gap-3">
                <button
                  onClick={runAnalysis}
                  disabled={running || !jobText.trim()}
                  className="px-4 py-2 text-sm rounded bg-blue-600 text-white font-medium disabled:opacity-50"
                >
                  {busy === 'analyse' ? 'Analysing…' : 'Analyse against my record'}
                </button>
                {busy === 'analyse' && <span className="text-sm text-gray-600">{phase}</span>}
              </div>
            </div>

            <div className="lg:border-l lg:border-gray-200 lg:pl-5">
              {analysis ? (
                <>
                  {headline && (
                    <div className="mb-3 flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-gray-900">{headline.title}</span>
                      {headline.overall && (
                        <span className="text-sm text-gray-600">overall {headline.overall}</span>
                      )}
                      {headline.ats && (
                        <span className="text-sm text-gray-600">ATS {headline.ats}</span>
                      )}
                    </div>
                  )}
                  <div className="max-h-[28rem] overflow-y-auto pr-2 text-sm leading-relaxed text-gray-800">
                    <AnalysisDisplay analysis={analysis} />
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500">
                  {busy === 'analyse' ? phase : 'The read-out of my record against this ad appears here.'}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── Steering beside the documents ─────────────────────────────── */}
        <section className="border border-gray-200 rounded-lg shadow-sm bg-white p-5">
          <h2 className="text-base font-semibold text-gray-900">
            <span className={`mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold text-white ${analysis ? 'bg-blue-600' : 'bg-gray-300'}`}>2</span>
            Write
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Steering is the highest-priority instruction to the writer. It reframes, reorders and cuts —
            it will never invent a fact to satisfy it.
          </p>

          <div className="mt-4 grid gap-5 lg:grid-cols-[20rem_1fr]">
            {/* steering column */}
            <div>
              <div className="grid gap-3 grid-cols-2">
                <label className="text-sm">
                  <span className="font-medium text-gray-800">Tone</span>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  >
                    {TONES.map((tn) => <option key={tn} value={tn}>{tn}</option>)}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="font-medium text-gray-800">Language</span>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  >
                    {Object.entries(GENERATION_LANGUAGES).map(([k, label]) => (
                      <option key={k} value={k}>{label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="mt-3 block text-sm">
                <span className="font-medium text-gray-800">Emphasise</span>
                <textarea
                  value={emphasise}
                  onChange={(e) => setEmphasise(e.target.value)}
                  rows={2}
                  className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  placeholder="e.g. the AI/automation work, anything hands-on with product"
                />
              </label>
              <label className="mt-3 block text-sm">
                <span className="font-medium text-gray-800">Play down</span>
                <textarea
                  value={playDown}
                  onChange={(e) => setPlayDown(e.target.value)}
                  rows={2}
                  className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  placeholder="e.g. the early sales roles, the agency years"
                />
              </label>
              <label className="mt-3 block text-sm">
                <span className="font-medium text-gray-800">Anything else</span>
                <textarea
                  value={freeform}
                  onChange={(e) => setFreeform(e.target.value)}
                  rows={4}
                  className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  placeholder="e.g. frame this as a deliberate pivot into X — the through-line is Y. One page."
                />
              </label>

              {/* One button per document. Each writes ONLY that document, in its
                  own run, with whatever steering is in the boxes right now — so
                  the letter can be rewritten against new instructions without
                  reprinting a CV that was already right. */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => generate('cv')}
                  disabled={running || !analysis}
                  className="px-4 py-2 text-sm rounded bg-blue-600 text-white font-medium disabled:opacity-50"
                >
                  {busy === 'cv' ? 'Writing…' : cv ? 'Rewrite CV' : 'Write CV'}
                </button>
                <button
                  onClick={() => generate('cover')}
                  disabled={running || !analysis}
                  className="px-4 py-2 text-sm rounded bg-blue-600 text-white font-medium disabled:opacity-50"
                >
                  {busy === 'cover' ? 'Writing…' : cover ? 'Rewrite cover letter' : 'Write cover letter'}
                </button>
              </div>
              {!analysis && <p className="mt-2 text-sm text-gray-500">Analyse a job ad first.</p>}
              {(busy === 'cv' || busy === 'cover') && <p className="mt-2 text-sm text-gray-600">{phase}</p>}
            </div>

            {/* documents column — editable, and the edits are what download */}
            <div>
              {docs ? (
                <>
                  <div className="flex items-center gap-2 border-b border-gray-200">
                    {['cv', 'cover'].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 text-sm font-medium ${activeTab === tab ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500'}`}
                      >
                        {tab === 'cv' ? 'CV' : 'Cover letter'}
                      </button>
                    ))}
                    <span className="ml-auto text-xs text-gray-500">editable — downloads use what is shown</span>
                  </div>

                  <CvWarningBanner items={activeTab === 'cv' ? warnings : coverWarnings} className="mt-3" />

                  <textarea
                    value={activeTab === 'cv' ? cv : cover}
                    onChange={(e) => (activeTab === 'cv' ? setCv(e.target.value) : setCover(e.target.value))}
                    rows={30}
                    className="mt-3 w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono leading-relaxed"
                  />
                  <DocumentDownloadButtons
                    user_id={user_id}
                    cvText={cv}
                    coverText={cover}
                    activeTab={activeTab}
                    analysis={analysis}
                    onTokenFail={() => setError('Out of download tokens.')}
                  />
                </>
              ) : (
                <div className="h-full min-h-[16rem] rounded border border-dashed border-gray-300 flex items-center justify-center px-6 text-center text-sm text-gray-500">
                  {busy === 'cv' || busy === 'cover'
                    ? phase
                    : 'The CV and cover letter appear here. Adjust the steering on the left and regenerate as often as needed — no new analysis is charged.'}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Set up once / checked rarely. Below the day's work, closed, and
             not mounted until opened — AiCostPanel fetches the whole ledger on
             mount, which every page load was paying for unasked. ─────────── */}
        <div className="mt-8">
          <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">Set up once</p>
          <div className="space-y-3">
            <div className="border border-gray-200 rounded-lg bg-white shadow-sm px-4 py-2">
              <VoiceProfilePanel profile={voiceProfile} onUpdated={setVoiceProfile} />
            </div>

            <CollapsibleSection label="AI spend" hint="every Gemini call, off the ledger">
              <AiCostPanel />
            </CollapsibleSection>
          </div>
        </div>
      </main>
    </>
  );
}

export async function getServerSideProps({ req }) {
  const decoded = await verifyToken(getTokenFromReq(req)).catch(() => null);
  if (!decoded?.user_id) {
    return { redirect: { destination: '/?error=unauthorized', permanent: false } };
  }
  let user;
  try {
    user = await getUserStats(decoded.user_id);
  } catch {
    return { redirect: { destination: '/?error=user-not-found', permanent: false } };
  }
  return {
    props: {
      user_id: decoded.user_id,
      generationsRemaining: user.generations_left ?? 0,
      docDownloadsRemaining: user.tokens ?? 0,
    },
  };
}
