// pages/[user_id].js
import { useState, useEffect } from 'react';
import Header from '../components/Header';
import TabbedViewer from '../components/TabbedViewer';
import { supabase } from '../utils/supabase';
import Head from 'next/head';
import { verifyToken, getTokenFromReq } from '../lib/auth';

export default function UserPage({ user_id, generationsRemaining, docDownloadsRemaining, userEmail }) {
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
        userEmail={userEmail}
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
  const { req, res, params, query } = context;
  const { user_id } = params;

  // Get token from request
  let token = getTokenFromReq(req);

  // If token is in query, set it as a cookie
  if (query.token && !req.cookies['auth-token']) {
    res.setHeader('Set-Cookie', `auth-token=${query.token}; Path=/; HttpOnly; Max-Age=${query.rememberMe ? '2592000' : '900'}`);
    token = query.token;
  }

  // Check authentication
  const decoded = verifyToken(token);
  if (!decoded || decoded.user_id !== user_id) {
    return { redirect: { destination: '/?error=unauthorized', permanent: false } };
  }

<<<<<<< HEAD
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: user, error } = await supabase
=======
  
  const { data: user } = await supabase
>>>>>>> 0dc90bed97c2b789059cc7aec82817ab86fb6540
    .from('users')
    .select('generations_left, tokens, email')
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
      userEmail: user?.email || decoded.email,
    },
  };
}
