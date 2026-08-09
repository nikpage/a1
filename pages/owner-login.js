// pages/owner-login.js
//
// The owner's door. One password box: the key is POSTed in the request body to
// /api/auth/owner, so it never appears in a URL — not in browser history, not in
// the host's access logs. On success the ordinary session cookie is set and the
// browser goes to /me.
//
// The email defaults to OWNER_EMAIL when the server has one, so normally there
// is nothing to type but the key (and the browser can remember it).

import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function OwnerLogin({ defaultEmail }) {
  const [key, setKey] = useState('');
  const [email, setEmail] = useState(defaultEmail || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/owner', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Login failed (${res.status})`);
      router.push('/me');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>Owner login</title>
        <meta name="robots" content="noindex" />
      </Head>
      <main className="max-w-sm mx-auto px-4 py-24">
        <h1 className="text-lg font-semibold text-gray-900">Owner login</h1>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="font-medium text-gray-800">Key</span>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              autoComplete="current-password"
              autoFocus
              className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-800">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={busy || !key.trim()}
            className="px-4 py-2 text-sm rounded bg-blue-600 text-white font-medium disabled:opacity-50"
          >
            {busy ? 'Opening…' : 'Open my workbench'}
          </button>
        </form>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </main>
    </>
  );
}

export async function getServerSideProps() {
  // Only the address is prefilled — the key is never sent to the browser.
  return { props: { defaultEmail: process.env.OWNER_EMAIL || '' } };
}
