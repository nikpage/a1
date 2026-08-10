import { useState, useEffect } from 'react';
import Header from '../components/Header';
import TabbedViewer from '../components/TabbedViewer';
import MasterFlagFixer from '../components/MasterFlagFixer';
import AddInfoPanel from '../components/AddInfoPanel';
import MasterRecordPanel from '../components/MasterRecordPanel';
import { uploadAndAnalyze } from '../utils/uploadAndAnalyze';
import Head from 'next/head';
import { verifyToken, getTokenFromReq } from '../lib/auth';
import { getUserStats } from '../utils/database';
import { useTranslation } from 'react-i18next';

export default function UserPage({ user_id, generationsRemaining, docDownloadsRemaining }) {
  const [analysis, setAnalysis] = useState('');
  const [flags, setFlags] = useState([]);
  const [experience, setExperience] = useState([]);
  const [master, setMaster] = useState(null);
  const [onboardingDone, setOnboardingDone] = useState(false);
  // The master record is missing (its build failed) and is being rebuilt now.
  const [rebuilding, setRebuilding] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (user_id) {
      fetch('/api/get-analysis', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id }),
      })
        .then(res => {
          if (!res.ok) {
            return res.json().then(err => Promise.reject(err));
          }
          return res.json();
        })
        .then(async data => {
          setAnalysis(data.analysis || '');
          setFlags(Array.isArray(data.flags) ? data.flags : []);
          setExperience(Array.isArray(data.experience) ? data.experience : []);
          setMaster(data.master || null);

          // No master record: its build failed at analysis time, leaving the
          // column null while the CV text is safely on file. Rebuild it here
          // rather than showing an empty skeleton the user cannot fix — the
          // background function is the only place with the budget to run the
          // build (a Pages route has 10s; the build needs longer), and it
          // builds the master whenever it is absent.
          if (data.master_missing) {
            setRebuilding(true);
            try {
              await uploadAndAnalyze({ user_id, deep: true });
              const res = await fetch('/api/get-analysis', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id }),
              });
              if (res.ok) {
                const fresh = await res.json();
                setAnalysis(fresh.analysis || '');
                setFlags(Array.isArray(fresh.flags) ? fresh.flags : []);
                setExperience(Array.isArray(fresh.experience) ? fresh.experience : []);
                setMaster(fresh.master || null);
              }
            } catch (e) {
              console.error('Master rebuild failed:', e.message);
            }
            setRebuilding(false);
          }
        })
        .catch(() => {
          setAnalysis('');
        });
    }
  }, [user_id]);

  // The onboarding blueprint renders for every newly-analysed user, whether or
  // not the AI surfaced open questions. A clean record simply shows the 4-step
  // tracker with no question cards and a Continue button — it must always be
  // visible post-registration, never gated on flags existing.
  const showOnboarding = !onboardingDone && !!analysis;

  return (
    <>
      <Head>
        <link rel="icon" href="/favicon-32x32.png" />
      </Head>
      <Header
        user_id={user_id}
        generationsRemaining={generationsRemaining}
        docDownloadsRemaining={docDownloadsRemaining}
      />
      <main className="max-w-4xl mx-auto px-4 py-10">
        {showOnboarding ? (
          <div className="border border-gray-200 rounded-lg shadow-sm p-6 bg-white">
            <MasterFlagFixer flags={flags} experience={experience} rebuilding={rebuilding} onComplete={() => setOnboardingDone(true)} />
          </div>
        ) : analysis ? (
          <>
            <div className="border border-gray-200 rounded-lg shadow-sm p-6 bg-white">
              <TabbedViewer user_id={user_id} analysisText={analysis} />
            </div>
            {/* Past onboarding the record is never closed: anything the CV missed
                can still be typed in here and reaches every future generation. */}
            <div className="mt-6">
              <AddInfoPanel onUpdated={(updated, newFlags) => {
                if (updated) {
                  setMaster(updated);
                  if (Array.isArray(updated.experience)) setExperience(updated.experience);
                }
                if (Array.isArray(newFlags)) setFlags(newFlags);
              }} />
            </div>
            {/* The record itself, read-only: what every CV and cover letter is
                written from, so it can be checked without leaving the page. */}
            {master && (
              <div className="mt-6 border border-gray-200 rounded-lg shadow-sm p-6 bg-white">
                <h2 className="text-sm font-semibold text-gray-900">My master record</h2>
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
          </>
        ) : (
          <div className="text-center text-muted-foreground">
            {t('user.analysis.none')}
          </div>
        )}
      </main>
    </>
  );
}

export async function getServerSideProps(context) {
  const { req, params } = context;
  const { user_id } = params;

  const token = getTokenFromReq(req);

  try {
    const decoded = await verifyToken(token);
    if (!decoded || decoded.user_id !== user_id) {
      return { redirect: { destination: '/?error=unauthorized', permanent: false } };
    }

    let user;
    try {
      user = await getUserStats(user_id);
    } catch {
      return { redirect: { destination: '/?error=user-not-found', permanent: false } };
    }

    return {
      props: {
        user_id,
        generationsRemaining: user.generations_left ?? 0,
        docDownloadsRemaining: user.tokens ?? 0,
      },
    };
  } catch {
    return { redirect: { destination: '/?error=invalid-token', permanent: false } };
  }
}
