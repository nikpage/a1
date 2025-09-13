// pages/the-secret-weapon.js
import Head from 'next/head';
import Header from '../components/Header';
import { useTranslation } from 'react-i18next';

export default function TheSecretWeapon() {
  const { t } = useTranslation('secretWeapon');

  return (
    <>
      <Head>
        <title>{t('title')}</title>
        <meta name="description" content={t('metaDescription')} />
        <link rel="icon" href="/favicon-32x32.png" />
      </Head>
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-light text-slate-800 mb-6">{t('hero.heading')}</h1>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto">{t('hero.subheading')}</p>
        </div>

        {/* Problem */}
        <div className="mb-16">
          <h2 className="text-3xl font-light text-slate-800 mb-8 text-center">{t('problem.heading')}</h2>
          <div className="bg-red-50 border-l-4 border-red-400 p-6 rounded-r-lg mb-8">
            <p className="text-slate-700 text-lg">{t('problem.alert')}</p>
          </div>
          <p className="text-slate-600 text-lg">{t('problem.text')}</p>
        </div>

        {/* Secret */}
        <div className="mb-16">
          <h2 className="text-3xl font-light text-slate-800 mb-8 text-center">{t('secret.heading')}</h2>
          <div className="bg-[#41b4a2] bg-opacity-10 border-l-4 border-[#41b4a2] p-6 rounded-r-lg mb-8">
            <p className="text-slate-700 text-lg font-medium">{t('secret.intro')}</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold mb-4">{t('secret.mistakesTitle')}</h3>
              <ul className="space-y-2 text-slate-600">
                {t('secret.mistakes', { returnObjects: true }).map((item, i) => (
                  <li key={i} className="flex items-start"><span className="text-red-500 mr-2">✗</span>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-4">{t('secret.strategiesTitle')}</h3>
              <ul className="space-y-2 text-slate-600">
                {t('secret.strategies', { returnObjects: true }).map((item, i) => (
                  <li key={i} className="flex items-start"><span className="text-[#41b4a2] mr-2">✓</span>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Method */}
        <div className="mb-16">
          <h2 className="text-3xl font-light text-slate-800 mb-8 text-center">{t('method.heading')}</h2>
          <div className="space-y-6">
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-3">{t('method.steps.oneTitle')}</h3>
              <p className="text-slate-600">{t('method.steps.oneText')}</p>
            </div>
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-3">{t('method.steps.twoTitle')}</h3>
              <p className="text-slate-600">{t('method.steps.twoText')}</p>
            </div>
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-3">{t('method.steps.threeTitle')}</h3>
              <p className="text-slate-600">{t('method.steps.threeText')}</p>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="mb-16">
          <h2 className="text-3xl font-light text-slate-800 mb-8 text-center">{t('results.heading')}</h2>
          <div className="bg-gray-50 rounded-lg p-8">
            <div className="grid md:grid-cols-3 gap-8 text-center">
              {Object.entries(t('results.stats', { returnObjects: true })).map(([key, stat]) => (
                <div key={key}>
                  <div className="text-4xl font-light text-[#41b4a2] mb-2">{stat.value}</div>
                  <div className="font-semibold">{stat.label}</div>
                  <div className="text-slate-600 text-sm mt-2">{stat.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Why Now */}
        <div className="mb-16">
          <h2 className="text-3xl font-light text-slate-800 mb-8 text-center">{t('whyNow.heading')}</h2>
          <div className="space-y-4 text-slate-600 text-lg">
            <p>{t('whyNow.p1')}</p>
            <p><strong>{t('whyNow.p2')}</strong></p>
            <p>{t('whyNow.p3')}</p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <h2 className="text-3xl font-light text-slate-800 mb-6">{t('cta.heading')}</h2>
          <p className="text-xl text-slate-500 mb-8 max-w-2xl mx-auto">{t('cta.text')}</p>
          <button className="action-btn">{t('cta.button')}</button>
        </div>
      </main>
    </>
  );
}
