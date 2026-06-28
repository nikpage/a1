import { useState, useEffect } from 'react';
import Header from '../components/Header';
import TabbedViewer from '../components/TabbedViewer';
import MasterFlagFixer from '../components/MasterFlagFixer';
import Head from 'next/head';
import { verifyToken, getTokenFromReq } from '../lib/auth';
import { getUserStats } from '../utils/database';
import { useTranslation } from 'react-i18next';

export default function UserPage({ user_id, generationsRemaining, docDownloadsRemaining }) {
  const [analysis, setAnalysis] = useState('');
  const [flags, setFlags] = useState([]);
  const [experience, setExperience] = useState([]);
  const [onboardingDone, setOnboardingDone] = useState(false);
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
        .then(data => {
          setAnalysis(data.analysis || '');
          setFlags(Array.isArray(data.flags) ? data.flags : []);
          setExperience(Array.isArray(data.experience) ? data.experience : []);
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
            <MasterFlagFixer flags={flags} experience={experience} onComplete={() => setOnboardingDone(true)} />
          </div>
        ) : analysis ? (
          <div className="border border-gray-200 rounded-lg shadow-sm p-6 bg-white">
            <TabbedViewer user_id={user_id} analysisText={analysis} />
          </div>
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
