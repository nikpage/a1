// pages/me.js
//
// Personal workbench — one page, the whole loop, no funnel:
//
//   1. Master     upload the base CV once, then keep topping the record up
//                 (AddInfoPanel) and settling its open questions (MasterFlagFixer).
//   2. Job        paste the ad, run the deep analysis (auto-confirms the cheap
//                 extraction pass — no modal in the way).
//   3. Steering   emphasise / play down / free instructions, composed into the
//                 `tweak` string that prompts/cv-generator.js already treats as
//                 HIGHEST PRIORITY, plus tone and output language.
//   4. Write      generate CV + cover, read them, re-steer and regenerate without
//                 paying for a second analysis, download.
//
// Every call goes through the existing shared paths (uploadAndAnalyze,
// /api/master-add-info, /api/resolve-flag, generate-background) — this page
// adds UI and the steering composition, nothing else. The session cookie decides
// whose record this is, so /me is always the signed-in user's own workbench.

import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import MasterFlagFixer from '../components/MasterFlagFixer';
import AddInfoPanel from '../components/AddInfoPanel';
import MasterRecordPanel from '../components/MasterRecordPanel';
import DocumentDownloadButtons from '../components/DocumentDownloadButtons';
import { uploadAndAnalyze } from '../utils/uploadAndAnalyze';
import { logGemini } from '../utils/log-gemini.js';
import { generateDocuments } from '../utils/generateDocuments';
import { composeTweak } from '../utils/steering';
import { verifyToken, getTokenFromReq } from '../lib/auth';
import { getUserStats } from '../utils/database';
import { GENERATION_LANGUAGES } from '../prompts/language';

const TONES = ['Formal', 'Friendly', 'Enthusiastic', 'Cocky'];

function Section({ n, title, children, note }) {
  return (
    <section className="border border-gray-200 rounded-lg shadow-sm bg-white p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900">
        <span className="text-gray-400 mr-2">{n}</span>{title}
      </h2>
      {note && <p className="mt-1 text-sm text-gray-600">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function MePage({ user_id, generationsRemaining, docDownloadsRemaining }) {
  const [analysis, setAnalysis] = useState('');
  const [flags, setFlags] = useState([]);
  const [experience, setExperience] = useState([]);
  const [master, setMaster] = useState(null);
  const [loadingRecord, setLoadingRecord] = useState(true);

  const [uploading, setUploading] = useState(false);
  const [jobText, setJobText] = useState('');
  const [analysing, setAnalysing] = useState(false);

  const [tone, setTone] = useState('Formal');
  const [language, setLanguage] = useState('auto');
  const [emphasise, setEmphasise] = useState('');
  const [playDown, setPlayDown] = useState('');
  const [freeform, setFreeform] = useState('');

  const [generating, setGenerating] = useState(false);
  const [cv, setCv] = useState('');
  const [cover, setCover] = useState('');
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
      }
    } catch {
      /* an empty record simply renders the upload box */
    }
    setLoadingRecord(false);
  }, [user_id]);

  useEffect(() => { loadRecord(); }, [loadRecord]);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      // deep:true — this is a signed-in, past-the-wall run, so the worker builds
      // the master and runs the full analysis, not just the landing teaser.
      await uploadAndAnalyze({ file, user_id, deep: true });
      await loadRecord();
    } catch (err) {
      setError(err.message);
    }
    setUploading(false);
  }

  async function runAnalysis() {
    if (!jobText.trim()) return;
    setError('');
    setAnalysing(true);
    try {
      await uploadAndAnalyze({
        user_id,
        jobText,
        deep: true,
        // The confirmation modal exists to protect strangers from paying for a
        // misread ad. On my own workbench the extraction is accepted as-is.
        onJobExtracted: (extraction) => extraction,
      });
      await loadRecord();
    } catch (err) {
      setError(err.message);
    }
    setAnalysing(false);
  }

  async function generate() {
    if (!analysis) return;
    setError('');
    setGenerating(true);
    try {
      const data = await generateDocuments({
        analysis,
        tone,
        type: 'both',
        language,
        tweak: composeTweak({ emphasise, playDown, freeform }),
      });
      if (!data.ok) throw new Error(data.error || 'Generation failed');
      (data.gemini_usage || []).forEach(logGemini);
      setCv(data.cv || '');
      setCover(data.cover || '');
      setActiveTab(data.cv ? 'cv' : 'cover');
      window.dispatchEvent(new Event('header-stats-updated'));
    } catch (err) {
      setError(err.message);
    }
    setGenerating(false);
  }

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
      <main className="max-w-4xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
        )}

        <Section
          n="1"
          title="My master record"
          note="The single source every CV and cover letter is written from. Upload replaces it; the boxes below grow it."
        >
          <div className="flex items-center gap-3">
            <label className="px-4 py-2 text-sm rounded bg-gray-800 text-white font-medium cursor-pointer">
              {uploading ? 'Building…' : master ? 'Replace base CV' : 'Upload base CV'}
              <input type="file" accept=".pdf,.doc,.docx" className="hidden" disabled={uploading} onChange={handleUpload} />
            </label>
          </div>

          {master && (
            <div className="mt-4">
              <MasterRecordPanel
                master={master}
                onUpdated={(saved, newFlags) => {
                  setMaster(saved);
                  if (Array.isArray(saved?.experience)) setExperience(saved.experience);
                  if (Array.isArray(newFlags)) setFlags(newFlags);
                }}
              />
            </div>
          )}

          {!loadingRecord && (experience.length > 0 || flags.length > 0) && (
            <div className="mt-5">
              <MasterFlagFixer
                flags={flags}
                experience={experience}
                rebuilding={false}
                onComplete={loadRecord}
              />
            </div>
          )}

          <div className="mt-5">
            <AddInfoPanel onUpdated={(updated, newFlags) => {
              if (updated) {
                setMaster(updated);
                if (Array.isArray(updated.experience)) setExperience(updated.experience);
              }
              if (Array.isArray(newFlags)) setFlags(newFlags);
            }} />
          </div>
        </Section>

        <Section n="2" title="The job" note="Paste the ad. This runs the full analysis your documents are written against.">
          <textarea
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            rows={8}
            disabled={analysing}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm disabled:opacity-60"
            placeholder="Paste the whole job ad here…"
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={runAnalysis}
              disabled={analysing || !jobText.trim()}
              className="px-4 py-2 text-sm rounded bg-blue-600 text-white font-medium disabled:opacity-50"
            >
              {analysing ? 'Analysing…' : 'Analyse against my record'}
            </button>
            {analysis && !analysing && <span className="text-sm text-green-700">✓ analysis ready</span>}
          </div>
        </Section>

        <Section
          n="3"
          title="Steering"
          note="Highest-priority instructions to the writer. It reframes, reorders and cuts — it will never invent a fact to satisfy these."
        >
          <div className="grid gap-4 sm:grid-cols-2">
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
              <span className="font-medium text-gray-800">Output language</span>
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

          <label className="mt-4 block text-sm">
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
              rows={3}
              className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              placeholder="e.g. frame this as a deliberate pivot into X — the through-line is Y. One page."
            />
          </label>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={generate}
              disabled={generating || !analysis}
              className="px-4 py-2 text-sm rounded bg-blue-600 text-white font-medium disabled:opacity-50"
            >
              {generating ? 'Writing…' : cv || cover ? 'Regenerate with this steering' : 'Write CV + cover letter'}
            </button>
            {!analysis && <span className="text-sm text-gray-500">Run an analysis first</span>}
          </div>
        </Section>

        {(cv || cover) && (
          <Section n="4" title="Documents" note="Re-steer above and regenerate as often as you like — no new analysis needed.">
            <div className="flex gap-2 border-b border-gray-200">
              {['cv', 'cover'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium ${activeTab === tab ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500'}`}
                >
                  {tab === 'cv' ? 'CV' : 'Cover letter'}
                </button>
              ))}
            </div>
            <pre className="mt-4 whitespace-pre-wrap text-sm text-gray-900">
              {activeTab === 'cv' ? cv : cover}
            </pre>
            <DocumentDownloadButtons
              user_id={user_id}
              cvText={cv}
              coverText={cover}
              activeTab={activeTab}
              onTokenFail={() => setError('Out of download tokens.')}
            />
          </Section>
        )}
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
