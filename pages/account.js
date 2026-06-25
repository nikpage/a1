import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Header from '../components/Header';
import { verifyToken, getTokenFromReq } from '../lib/auth';
import { getUser } from '../utils/database';

export default function AccountPage({ user_id, email, tokens, generationsLeft, cardOnFile, freeDownloadsLeft, initialCore }) {
  const [core, setCore] = useState(initialCore || '');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState(null);

  const verifyCard = async () => {
    setVerifying(true);
    setVerifyError(null);
    try {
      const res = await fetch('/api/stripe/create-setup', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not start verification');
      window.location.href = data.url;
    } catch (e) {
      setVerifyError(e.message);
      setVerifying(false);
    }
  };

  const saveCore = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch('/api/candidate-core', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_core: core }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setCore(data.candidate_core);
      setSaved(true);
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  return (
    <>
      <Head>
        <title>Your Profile — mysuper.cv</title>
        <link rel="icon" href="/favicon-32x32.png" />
      </Head>
      <Header user_id={user_id} generationsRemaining={generationsLeft} docDownloadsRemaining={tokens} />

      <main className="max-w-4xl mx-auto px-4 py-10 space-y-8">
        <h1 className="text-3xl font-light">Your Profile</h1>

        {/* Balance */}
        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Account</h2>
          <div className="grid sm:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-slate-500">Email</div>
              <div className="font-medium break-all">{email || '—'}</div>
            </div>
            <div>
              <div className="text-slate-500">Free writes left</div>
              <div className="font-medium text-[#41b4a2]">{generationsLeft}</div>
            </div>
            <div>
              <div className="text-slate-500">Download tokens</div>
              <div className="font-medium text-[#41b4a2]">{tokens}</div>
            </div>
          </div>

          {!cardOnFile ? (
            <div className="mt-5 p-4 rounded-lg bg-[#f0faf8] border border-[#cdeee8]">
              <div className="font-medium mb-1">Get your first download free</div>
              <p className="text-sm text-slate-600 mb-3">
                Add a card to verify your account — <strong>no charge</strong>. You&apos;ll unlock {freeDownloadsLeft || 1} free
                download and can buy more anytime with one click.
              </p>
              <button
                onClick={verifyCard}
                disabled={verifying}
                className="bg-[#41b4a2] hover:bg-[#2c9486] text-white px-5 py-2 rounded-lg font-medium transition-colors disabled:opacity-60"
              >
                {verifying ? 'Opening…' : 'Add card (no charge)'}
              </button>
              {verifyError && <span className="ml-3 text-sm text-red-600">{verifyError}</span>}
            </div>
          ) : (
            <div className="mt-5 text-sm">
              <span className="inline-block px-2 py-1 rounded bg-[#f0faf8] text-[#2c9486] border border-[#cdeee8]">
                ✓ Card verified
              </span>
              <span className="ml-3 text-slate-600">Free downloads left: <strong>{freeDownloadsLeft}</strong></span>
            </div>
          )}

          <div className="mt-4 flex gap-4 text-sm">
            <Link href={`/${user_id}`} className="text-[#41b4a2] hover:underline">Your documents →</Link>
            <Link href="/pricing" className="text-[#41b4a2] hover:underline">Buy tokens →</Link>
          </div>
        </section>

        {/* Candidate core */}
        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-1">What you bring to every role</h2>
          <p className="text-sm text-slate-500 mb-4">
            We drafted this from your CV. It quietly guides every CV and cover letter we write for you —
            so edit it to sound like you. Keep it true to your real experience; we won&apos;t invent anything from it.
          </p>
          <textarea
            value={core}
            onChange={(e) => { setCore(e.target.value); setSaved(false); }}
            rows={5}
            placeholder="e.g. I bring business and product development plus team leadership across early-stage tech — turning unclear briefs into shipped products and teams that stay."
            className="w-full p-3 border border-gray-300 rounded-lg text-sm resize-y"
          />
          <div className="mt-3 flex items-center gap-4">
            <button
              onClick={saveCore}
              disabled={saving}
              className="bg-[#41b4a2] hover:bg-[#2c9486] text-white px-5 py-2 rounded-lg font-medium transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            {saved && <span className="text-sm text-[#41b4a2]">Saved</span>}
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </section>
      </main>
    </>
  );
}

export async function getServerSideProps({ req }) {
  const token = getTokenFromReq(req);
  try {
    const decoded = await verifyToken(token);
    if (!decoded?.user_id) {
      return { redirect: { destination: '/?error=unauthorized', permanent: false } };
    }
    const user_id = decoded.user_id;

    let user;
    try {
      user = await getUser(user_id);
    } catch {
      return { redirect: { destination: '/?error=user-not-found', permanent: false } };
    }

    return {
      props: {
        user_id,
        email: user.email || '',
        tokens: user.tokens ?? 0,
        generationsLeft: user.generations_left ?? 0,
        cardOnFile: !!user.card_on_file,
        freeDownloadsLeft: user.free_downloads_left ?? 0,
        initialCore: user.candidate_core || '',
      },
    };
  } catch {
    return { redirect: { destination: '/?error=invalid-token', permanent: false } };
  }
}
