// pages/simple-steps.js
import Head from 'next/head';
import Header from '../components/Header';
import { useTranslation } from 'react-i18next';

export default function SimpleSteps() {
  const { t } = useTranslation('simpleSteps');

  return (
    <>
      <Head>
        <title>{t('title')}</title>
        <meta name="description" content={t('metaDescription')} />
        <link rel="icon" href="/favicon-32x32.png" />
      </Head>
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-light text-slate-800 mb-6 leading-tight">
            {t('hero.heading')}
          </h1>
          <p className="text-xl text-slate-500 font-normal max-w-2xl mx-auto">
            {t('hero.subheading')}
          </p>
        </div>

        {/* Steps Section */}
        <div className="space-y-12 mb-16">
          <div className="flex items-start space-x-6">
            <div className="flex-shrink-0 w-12 h-12 bg-[#41b4a2] text-white rounded-full flex items-center justify-center font-semibold text-lg">1</div>
            <div>
              <h3 className="text-2xl font-semibold text-slate-800 mb-3">{t('steps.oneTitle')}</h3>
              <p className="text-slate-600 text-lg leading-relaxed">{t('steps.oneText')}</p>
            </div>
          </div>

          <div className="flex items-start space-x-6">
            <div className="flex-shrink-0 w-12 h-12 bg-[#41b4a2] text-white rounded-full flex items-center justify-center font-semibold text-lg">2</div>
            <div>
              <h3 className="text-2xl font-semibold text-slate-800 mb-3">{t('steps.twoTitle')}</h3>
              <p className="text-slate-600 text-lg leading-relaxed">{t('steps.twoText')}</p>
            </div>
          </div>

          <div className="flex items-start space-x-6">
            <div className="flex-shrink-0 w-12 h-12 bg-[#41b4a2] text-white rounded-full flex items-center justify-center font-semibold text-lg">3</div>
            <div>
              <h3 className="text-2xl font-semibold text-slate-800 mb-3">{t('steps.threeTitle')}</h3>
              <p className="text-slate-600 text-lg leading-relaxed">{t('steps.threeText')}</p>
            </div>
          </div>

          <div className="flex items-start space-x-6">
            <div className="flex-shrink-0 w-12 h-12 bg-[#41b4a2] text-white rounded-full flex items-center justify-center font-semibold text-lg">4</div>
            <div>
              <h3 className="text-2xl font-semibold text-slate-800 mb-3">{t('steps.fourTitle')}</h3>
              <p className="text-slate-600 text-lg leading-relaxed">{t('steps.fourText')}</p>
            </div>
          </div>
        </div>

        {/* Key Benefits */}
        <div className="bg-gray-50 rounded-lg p-8 mb-16">
          <h2 className="text-3xl font-light text-slate-800 mb-8 text-center">{t('benefits.heading')}</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h4 className="font-semibold text-slate-800 mb-2">{t('benefits.tailoredTitle')}</h4>
              <p className="text-slate-600">{t('benefits.tailoredText')}</p>
            </div>
            <div>
              <h4 className="font-semibold text-slate-800 mb-2">{t('benefits.fastTitle')}</h4>
              <p className="text-slate-600">{t('benefits.fastText')}</p>
            </div>
            <div>
              <h4 className="font-semibold text-slate-800 mb-2">{t('benefits.improveTitle')}</h4>
              <p className="text-slate-600">{t('benefits.improveText')}</p>
            </div>
            <div>
              <h4 className="font-semibold text-slate-800 mb-2">{t('benefits.dataTitle')}</h4>
              <p className="text-slate-600">{t('benefits.dataText')}</p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <h2 className="text-3xl font-light text-slate-800 mb-6">{t('cta.heading')}</h2>
          <p className="text-xl text-slate-500 mb-8 max-w-2xl mx-auto">{t('cta.text')}</p>
          <button className="action-btn">{t('cta.button')}</button>
        </div>
      </main>
    </>
  );
}

export async function getStaticProps() {
  return { props: {} };
}
