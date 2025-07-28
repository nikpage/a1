import Image from 'next/image';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Header({ user_id, generationsRemaining, docDownloadsRemaining }) {
  const [downloads, setDownloads] = useState(0);
  const [generations, setGenerations] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

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

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
    <header className={`bg-white border-b border-gray-200 sticky top-0 z-50 transition-all duration-300 ${
      isScrolled ? 'pt-1 px-4 sm:px-6' : 'py-4 px-4 sm:px-6'
    }`}>
      <div className="max-w-7xl mx-auto">

        <div className={`hidden lg:flex justify-between ${isScrolled ? 'items-start' : 'items-end'}`}>
                  <div className="flex flex-col items-start">
                    <Link href="/">
                      <Image
                        src="/logo_cvprp+trans.png"
                        alt="TheCV.Pro Logo - Your Secret Weapon to Interview Calls"
                        width={120}
                        height={60}
                        className={`w-auto object-contain transition-all duration-300 ${
                          isScrolled ? 'h-8' : 'h-12'
                        }`}
                        priority
                      />
                    </Link>
                    <div className={`flex items-baseline justify-between w-full min-w-0 transition-all duration-300 overflow-hidden ${
                      isScrolled ? 'max-h-0 opacity-0' : 'max-h-10 opacity-100'
                    }`}>
                      <h1 className="text-xl font-bold text-[#41b4a2]">
                        Your Secret Weapon to Interview Calls <em className="text-[#2c9486] font-normal">...or his?</em>
                      </h1>
                    </div>
                  </div>

                  <div className="flex flex-col items-end">
                    {user_id && (
                      <div className="flex items-center space-x-3 bg-gray-50 px-3 py-1.5 rounded-lg text-sm mb-2">
                        <div className="text-center">
                          <div className="font-semibold text-slate-800">{generations}</div>
                          <div className="text-xs text-slate-600">Generations</div>
                        </div>
                        <div className="h-6 w-px bg-gray-300"></div>
                        <div className="text-center">
                          <div className="font-semibold text-slate-800">{downloads}</div>
                          <div className="text-xs text-slate-600">Downloads</div>
                        </div>
                      </div>
                    )}

                    <nav className={`flex items-center space-x-8 transition-all duration-300 overflow-hidden ${
                      isScrolled ? 'max-h-0 opacity-0' : 'max-h-10 opacity-100'
                    }`}>
                      <NavigationLinks />
                    </nav>
                  </div>
                </div>

        <div className="lg:hidden">
          <div className="flex items-center justify-between">
            <Link href="/">
              <Image
                src="/logo_cvprp+trans.png"
                alt="TheCV.Pro Logo - Your Secret Weapon to Interview Calls"
                width={120}
                height={60}
                className={`w-auto object-contain transition-all duration-300 ${
                  isScrolled ? 'h-6 sm:h-8' : 'h-10 sm:h-12'
                }`}
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

          {!user_id && (
            <div className={`mt-2 transition-all duration-300 overflow-hidden ${
              isScrolled ? 'max-h-0 opacity-0' : 'max-h-8 opacity-100'
            }`}>
              <h1 className="text-sm sm:text-base font-bold text-[#41b4a2] text-center">
                Your Secret Weapon to Interview Calls
              </h1>
            </div>
          )}

          {user_id && (
            <div className="mt-3 flex justify-end">
              <div className="flex items-center space-x-4 bg-gray-50 px-3 py-1.5 rounded-lg">
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

          {mobileMenuOpen && (
            <div className="mt-4 py-4 border-t border-gray-200">
              <nav className="flex flex-col space-y-2">
                <NavigationLinks mobile={true} />
              </nav>
            </div>
          )}

        </div>
      </div>
    </header>
  );
}
