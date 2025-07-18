// path: /Header.js
import Image from 'next/image';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Header({ user_id, generationsRemaining, docDownloadsRemaining }) {
  const [downloads, setDownloads] = useState(0);
  const [generations, setGenerations] = useState(0);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const fetchHeaderStats = async () => {
    if (!user_id) return;
    const res = await fetch(`/api/header-stats?user_id=${user_id}`);
    if (res.ok) {
      const { generations, downloads } = await res.json();
      setGenerations(generations);
      setDownloads(downloads);
    }
  };

  useEffect(() => {
    fetchHeaderStats();
  }, [user_id]);

  useEffect(() => {
    const updateStats = () => fetchHeaderStats();
    window.addEventListener('header-stats-updated', updateStats);
    return () => window.removeEventListener('header-stats-updated', updateStats);
  }, []);

  useEffect(() => {
    const updateDownloads = (e) => {
      if (e.detail?.tokens !== undefined) {
        setDownloads(e.detail.tokens);
      }
    };
    window.addEventListener('tokens-updated', updateDownloads);
    return () => window.removeEventListener('tokens-updated', updateDownloads);
  }, []);

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

  const NavigationLinks = ({ mobile = false }) => (
    <>
      <Link
        href="/the-secret-weapon"
        className={`text-slate-700 hover:text-[#41b4a2] font-medium transition-colors ${mobile ? 'block py-2' : ''}`}
        onClick={() => mobile && setMobileMenuOpen(false)}
      >
        The Secret Weapon
      </Link>
      <Link
        href="/simple-steps"
        className={`text-slate-700 hover:text-[#41b4a2] font-medium transition-colors ${mobile ? 'block py-2' : ''}`}
        onClick={() => mobile && setMobileMenuOpen(false)}
      >
        Simple Steps
      </Link>
      <Link
        href="/pricing"
        className={`text-slate-700 hover:text-[#41b4a2] font-medium transition-colors ${mobile ? 'block py-2' : ''}`}
        onClick={() => mobile && setMobileMenuOpen(false)}
      >
        Pricing
      </Link>
    </>
  );

  return (
    <header className="bg-white border-b border-gray-200 py-4 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">

        {/* Desktop Layout - reordered counter above email */}
        <div className="hidden lg:flex items-center justify-between">
          {/* Logo and Title */}
          <div className="flex flex-col items-start">
            <Link href="/">
              <Image
                src="/logo_cvprp+trans.png"
                alt="TheCV.Pro Logo - Your Secret Weapon to Interview Calls"
                width={120}
                height={60}
                className="h-12 w-auto object-contain"
                priority
              />
            </Link>
            <h1 className="text-xl font-bold text-[#41b4a2]">
              Your Secret Weapon to Interview Calls <em className="text-[#2c9486] font-normal">...or his?</em>
            </h1>
          </div>

          {/* Navigation */}
          <nav className="flex items-center space-x-8">
            <NavigationLinks />
          </nav>

          {/* User Info Panel (only shown when user_id exists) */}
          {user_id && (
            <div className="flex flex-col items-end space-y-4">
              {/* Usage Stats */}
              <div className="flex items-center space-x-4 bg-gray-50 px-4 py-2 rounded-lg">
                <div className="text-center">
                  <div className="text-sm font-semibold text-slate-800">{generations}</div>
                  <div className="text-xs text-slate-600">Generations</div>
                </div>
                <div className="h-8 w-px bg-gray-300"></div>
                <div className="text-center">
                  <div className="text-sm font-semibold text-slate-800">{downloads}</div>
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

        {/* Mobile/Tablet Layout */}
        <div className="lg:hidden">
          {/* Top Row: Logo and Menu Button */}
          <div className="flex items-center justify-between">
            <Link href="/">
              <Image
                src="/logo_cvprp+trans.png"
                alt="TheCV.Pro Logo - Your Secret Weapon to Interview Calls"
                width={120}
                height={60}
                className="h-10 w-auto object-contain sm:h-12"
                priority
              />
            </Link>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md text-slate-700 hover:text-[#41b4a2] hover:bg-gray-100 transition-colors"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

          {/* Tagline - only show on index page (no user_id) */}
          {!user_id && (
            <div className="mt-2">
              <h1 className="text-sm sm:text-base font-bold text-[#41b4a2] text-center">
                Your Secret Weapon to Interview Calls
              </h1>
            </div>
          )}

          {/* User Stats Row - only show when user_id exists */}
          {user_id && (
            <div className="mt-3 flex justify-center">
              <div className="flex items-center space-x-6 bg-gray-50 px-4 py-2 rounded-lg">
                <div className="text-center">
                  <div className="text-sm font-semibold text-slate-800">{generations}</div>
                  <div className="text-xs text-slate-600">Generations</div>
                </div>
                <div className="h-6 w-px bg-gray-300"></div>
                <div className="text-center">
                  <div className="text-sm font-semibold text-slate-800">{downloads}</div>
                  <div className="text-xs text-slate-600">Downloads</div>
                </div>
              </div>
            </div>
          )}

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="mt-4 py-4 border-t border-gray-200">
              <nav className="flex flex-col space-y-2">
                <NavigationLinks mobile={true} />
              </nav>
            </div>
          )}

          {/* Email Form - only show when user_id exists */}
          {user_id && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <form onSubmit={handleSend} autoComplete="off" className="space-y-3">
                <input
                  type="email"
                  required
                  placeholder="Email me my link"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#41b4a2] focus:border-transparent"
                  disabled={sending || sent}
                />
                <button
                  type="submit"
                  className="w-full bg-[#41b4a2] hover:bg-[#2c9486] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  disabled={sending || sent}
                >
                  {sending ? 'Sending...' : sent ? 'Sent!' : 'Send'}
                </button>
                {error && <div className="text-red-500 text-xs mt-1">{error}</div>}
                {sent && <div className="text-green-600 text-xs mt-1">Email sent successfully!</div>}
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
