// components/Header.js

import Image from 'next/image'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import LoginModal from './LoginModal'
import { useRouter } from 'next/router'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'

export default function Header({ user_id }) {
  const [downloads, setDownloads] = useState(0)
  const [generations, setGenerations] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)

  // FIX: ADDED STATE TO TRACK IF COMPONENT IS MOUNTED IN THE BROWSER
  const [isMounted, setIsMounted] = useState(false);

  const { locale } = useRouter()
  const { t } = useTranslation('header')

  const fetchHeaderStats = async () => {
    if (!user_id) return
    const res = await fetch(`/api/header-stats?user_id=${user_id}`)
    if (res.ok) {
      const { generations, downloads } = await res.json()
      setGenerations(generations)
      setDownloads(downloads)
    }
  }

  useEffect(() => {
    fetchHeaderStats()
  }, [user_id])

  // FIX: ADDED EFFECT TO SET MOUNTED STATE TO TRUE ONLY IN THE BROWSER
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const updateStats = () => fetchHeaderStats()
    window.addEventListener('header-stats-updated', updateStats)
    return () => window.removeEventListener('header-stats-updated', updateStats)
  }, [])

  useEffect(() => {
    const updateDownloads = (e) => {
      if (e.detail?.tokens !== undefined) {
        setDownloads(e.detail.tokens)
      }
    }
    window.addEventListener('tokens-updated', updateDownloads)
    return () => window.removeEventListener('tokens-updated', updateDownloads)
  }, [])

  const changeLang = (lng) => {
    i18n.changeLanguage(lng)
  }

  const NavigationLinks = ({ mobile = false }) => (
    <>
      <Link
        href="/the-secret-weapon"
        className={`text-slate-700 hover:text-[#41b4a2] font-medium transition-colors ${mobile ? 'block py-2' : ''}`}
        onClick={() => mobile && setMobileMenuOpen(false)}
      >
        {t('secretWeapon')}
      </Link>
      <Link
        href="/simple-steps"
        className={`text-slate-700 hover:text-[#41b4a2] font-medium transition-colors ${mobile ? 'block py-2' : ''}`}
        onClick={() => mobile && setMobileMenuOpen(false)}
      >
        {t('simpleSteps')}
      </Link>
      <Link
        href="/pricing"
        className={`text-slate-700 hover:text-[#41b4a2] font-medium transition-colors ${mobile ? 'block py-2' : ''}`}
        onClick={() => mobile && setMobileMenuOpen(false)}
      >
        {t('pricing')}
      </Link>
      <div className={`flex ${mobile ? 'mt-2' : 'mt-1'} space-x-3 text-lg`}>
        <button
          onClick={() => changeLang('en')}
          className={`px-2 py-1 rounded transition ${i18n.language === 'en' ? 'bg-[#41b4a2] text-white' : 'bg-gray-100 text-slate-700'}`}
        >
          🇬🇧
        </button>
        <button
          onClick={() => changeLang('cs')}
          className={`px-2 py-1 rounded transition ${i18n.language === 'cs' ? 'bg-[#41b4a2] text-white' : 'bg-gray-100 text-slate-700'}`}
        >
          🇨🇿
        </button>
        <button
  onClick={() => changeLang('pl')}
  className={`px-2 py-1 rounded transition ${i18n.language === 'pl' ? 'bg-[#41b4a2] text-white' : 'bg-gray-100 text-slate-700'}`}
>
  🇵🇱
</button>

      </div>
    </>
  )

  // FIX: ADDED CHECK TO PREVENT SERVER-SIDE RENDERING, REMOVING THE HYDRATION ERROR
  if (!isMounted) {
    return null;
  }

  return (
    <header className="bg-white border-b border-gray-200 py-4 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="hidden lg:flex items-start justify-between">
          <div className="flex flex-col items-start">
            <Link href="/">
              <Image
                src="/logo_cvprp+trans.png"
                alt="TheCV.Pro Logo"
                width={120}
                height={60}
                className="h-12 w-auto object-contain"
                priority
              />
            </Link>
            <h1 className="text-xl font-normal text-[#41b4a2]">
              {t('titleStart')}{' '}
              <em className="italic text-[#2c9486] font-normal">{t('titleEnd')}</em>
            </h1>
          </div>
          <div className="flex flex-col items-end">
            {user_id ? (
              <div className="flex items-center space-x-4 bg-gray-50 px-4 py-2 rounded-lg mb-2">
                <div className="text-center">
                  <div className="text-sm font-semibold text-slate-800">{generations}</div>
                  <div className="text-xs text-slate-600">{t('generations')}</div>
                </div>
                <div className="h-8 w-px bg-gray-300"></div>
                <div className="text-center">
                  <div className="text-sm font-semibold text-slate-800">{downloads}</div>
                  <div className="text-xs text-slate-600">{t('downloads')}</div>
                </div>
              </div>
            ) : (
              <div className="mb-2">
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="bg-[#41b4a2] hover:bg-[#2c9486] text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  {t('login')}
                </button>
              </div>
            )}
            <nav className="flex items-center space-x-8">
              <NavigationLinks />
            </nav>
          </div>
        </div>
        <div className="lg:hidden">
          <div className="flex items-center justify-between">
            <Link href="/">
              <Image
                src="/logo_cvprp+trans.png"
                alt="TheCV.Pro Logo"
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
          {!user_id && (
            <div className="mt-2">
              <h1 className="text-sm sm:text-base font-normal text-[#41b4a2] text-center">
                {t('titleStart')}{' '}
                <em className="italic text-[#2c9486] font-normal">{t('titleEnd')}</em>
              </h1>
            </div>
          )}
          {user_id && (
            <div className="mt-3 flex justify-end">
              <div className="flex items-center space-x-6 bg-gray-50 px-4 py-2 rounded-lg">
                <div className="text-center">
                  <div className="text-sm font-semibold text-slate-800">{generations}</div>
                  <div className="text-xs text-slate-600">{t('generations')}</div>
                </div>
                <div className="h-6 w-px bg-gray-300"></div>
                <div className="text-center">
                  <div className="text-sm font-semibold text-slate-800">{downloads}</div>
                  <div className="text-xs text-slate-600">{t('downloads')}</div>
                </div>
              </div>
            </div>
          )}
          {mobileMenuOpen && (
            <div className="mt-4 py-4 border-t border-gray-200">
              <nav className="flex flex-col space-y-2">
                <NavigationLinks mobile={true} />
                {!user_id && (
                  <button
                    onClick={() => {
                      setIsLoginModalOpen(true)
                      setMobileMenuOpen(false)
                    }}
                    className="bg-[#41b4a2] hover:bg-[#2c9486] text-white px-4 py-2 rounded-lg font-medium transition-colors block"
                  >
                    {t('login')}
                  </button>
                )}
              </nav>
            </div>
          )}
        </div>
        {isLoginModalOpen && <LoginModal onClose={() => setIsLoginModalOpen(false)} userId={user_id} />}
      </div>
    </header>
  )
}
