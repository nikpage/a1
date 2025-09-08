// pages/[user_id].js
import { useState, useEffect } from 'react';
import Header from '../components/Header';
import TabbedViewer from '../components/TabbedViewer';
import { createClient } from '@supabase/supabase-js';
import Head from 'next/head';
import { verifyToken, getTokenFromReq } from '../lib/auth';

export default function UserPage({ user_id, generationsRemaining, docDownloadsRemaining }) {
  const [analysis, setAnalysis] = useState('');

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
          console.error('API Error Response:', res.status, res.statusText);
          return res.json().then(err => Promise.reject(err));
        }
        return res.json();
      })
      .then(data => {
        setAnalysis(data.analysis || '');
      })
      .catch((error) => {
        console.error('Failed to fetch analysis:', error);
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
            <TabbedViewer
              user_id={user_id}
              analysisText={analysis}
            />
          </div>
        ) : (
          <div className="text-center text-muted-foreground">No analysis found.</div>
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
  } catch (error) {
    return { redirect: { destination: '/?error=invalid-token', permanent: false } };
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: user, error } = await supabase
    .from('users')
    .select('generations_left, tokens')
    .eq('user_id', user_id)
    .single();

  if (error || !user) {
    console.error("Supabase user fetch error:", error);
    return { redirect: { destination: '/?error=user-not-found', permanent: false } };
  }

  return {
    props: {
      user_id,
      generationsRemaining: user?.generations_left ?? 0,
      docDownloadsRemaining: user?.tokens ?? 0,
    },
  };
}
