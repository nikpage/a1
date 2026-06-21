import { useState, useEffect } from 'react';
import Header from '../components/Header';
import TabbedViewer from '../components/TabbedViewer';
import Head from 'next/head';
import { verifyToken, getTokenFromReq } from '../lib/auth';
import { getUserStats } from '../utils/database';
import { useTranslation } from 'react-i18next';

export default function UserPage({ user_id, generationsRemaining, docDownloadsRemaining }) {
  const [analysis, setAnalysis] = useState('');
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
        })
        .catch(() => {
          setAnalysis('');
        });
    }
  }, [user_id]);

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
        {analysis ? (
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
