// path: /pages/[user_id].js

import { useState, useEffect } from 'react';
import Header from '../components/Header';
import TabbedViewer from '../components/TabbedViewer';
import { createClient } from '@supabase/supabase-js';
import Head from 'next/head';


export default function UserPage({ user_id, generationsRemaining, docDownloadsRemaining }) {
  const [analysis, setAnalysis] = useState('');

  useEffect(() => {
    fetch('/api/get-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id }),
    })
      .then(res => res.json())
      .then(data => setAnalysis(data.analysis || ''))
      .catch(() => setAnalysis(''));
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
          <div className="text-center text-muted-foreground">No analysis found.</div>
        )}
      </main>
    </>
  );
}


export async function getServerSideProps(context) {
  const { user_id } = context.params;

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: user } = await supabase
    .from('users')
    .select('generations_left, tokens')
    .eq('user_id', user_id)
    .single();

  // If no user is found, default tokeyboard to 0 for both values
  if (!user) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      user_id,
      generationsRemaining: user?.generations_left ?? 0,
      docDownloadsRemaining: user?.tokens ?? 0,
    },
  };
}
