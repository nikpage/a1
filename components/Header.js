// path: /Header.js
import Image from 'next/image';
import { useState } from 'react';
import Link from 'next/link';

export default function Header({ user_id, generationsRemaining, docDownloadsRemaining }) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async (e) => {
    e.preventDefault();
    setSending(true);
    setSent(false);
    setError('');

    try {
      const res = await fetch('/api/send-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, user_id }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to send email.');
      } else {
        setSent(true);
      }
    } catch (err) {
      setError('Network error.');
    }

    setSending(false);
  };

  return (
    <header className="bg-white border-b border-gray-200 py-4 px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center">
          <Image
            src="/logo_cvprp+trans.png"
            alt="CV App Logo"
            width={120}
            height={60}
            className="h-12 w-auto object-contain"
            priority
          />
        </div>

        {/* Navigation */}
        <nav className="flex items-center space-x-8">
          <Link href="/the-secret-weapon" className="text-slate-700 hover:text-[#41b4a2] font-medium transition-colors">
            The Secret Weapon
          </Link>
          <Link href="/simple-steps" className="text-slate-700 hover:text-[#41b4a2] font-medium transition-colors">
            Simple Steps
          </Link>
          <Link href="/pricing" className="text-slate-700 hover:text-[#41b4a2] font-medium transition-colors">
            Pricing
          </Link>
        </nav>

        {/* User Info Panel (only shown when user_id exists) */}
        {user_id && (
          <div className="flex items-center space-x-6">
            {/* Usage Stats */}
            <div className="flex items-center space-x-4 bg-gray-50 px-4 py-2 rounded-lg">
              <div className="text-center">
                <div className="text-sm font-semibold text-slate-800">{generationsRemaining}</div>
                <div className="text-xs text-slate-600">Generations</div>
              </div>
              <div className="h-8 w-px bg-gray-300"></div>
              <div className="text-center">
                <div className="text-sm font-semibold text-slate-800">{docDownloadsRemaining}</div>
                <div className="text-xs text-slate-600">Downloads</div>
              </div>
            </div>

            {/* Email Form */}
            <div className="flex flex-col items-end">
              <form className="flex space-x-2" onSubmit={handleSend} autoComplete="off">
                <input
                  type="email"
                  required
                  placeholder="Email me my link"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#41b4a2] focus:border-transparent"
                  disabled={sending || sent}
                />
                <button
                  type="submit"
                  className="bg-[#41b4a2] hover:bg-[#2c9486] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  disabled={sending || sent}
                >
                  {sending ? 'Sending...' : sent ? 'Sent!' : 'Send'}
                </button>
              </form>
              {error && <div className="text-red-500 text-xs mt-1">{error}</div>}
              {sent && <div className="text-green-600 text-xs mt-1">Email sent successfully!</div>}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
