// pages/pricing.js
import Head from 'next/head';
import Header from '../components/Header';
import { useTranslation } from 'react-i18next';

export default function Pricing() {
  const { t } = useTranslation('pricing');

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

        {/* Free Generation Info */}
        <div className="bg-[#41b4a2] bg-opacity-10 border border-[#41b4a2] rounded-2xl p-8 mb-16 text-center">
          <h2 className="text-2xl font-semibold text-slate-800 mb-4">{t('freeSection.heading')}</h2>
          <p className="text-lg text-slate-600 mb-6">{t('freeSection.text')}</p>
          <div className="flex items-center justify-center space-x-8">
            <div className="text-center">
              <div className="text-3xl font-light text-[#41b4a2] mb-2">1</div>
              <div className="text-slate-700 font-medium">{t('freeSection.items.analysis')}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-light text-[#41b4a2] mb-2">10</div>
              <div className="text-slate-700 font-medium">{t('freeSection.items.docs')}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-light text-[#41b4a2] mb-2">€0</div>
              <div className="text-slate-700 font-medium">{t('freeSection.items.free')}</div>
            </div>
          </div>
        </div>

        {/* Download Pricing */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-light text-slate-800 mb-4">{t('downloadSection.heading')}</h2>
          <p className="text-lg text-slate-500 mb-8">{t('downloadSection.text')}</p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {/* Single Doc */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 relative hover:shadow-lg transition-all duration-200">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-slate-800 mb-2">{t('plans.single.title')}</h3>
              <div className="text-3xl font-light text-[#41b4a2] mb-1">{t('plans.single.price')}</div>
              <div className="text-slate-500 text-sm mb-4">{t('plans.single.desc')}</div>
              <div className="text-slate-600 text-sm mb-6">{t('plans.single.note')}</div>
              <button className="w-full bg-gray-100 text-slate-700 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors text-sm">
                {t('plans.single.price')} per download
              </button>
            </div>
          </div>

          {/* Essential */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 relative hover:shadow-lg transition-all duration-200">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-slate-800 mb-2">{t('plans.essential.title')}</h3>
              <div className="text-3xl font-light text-[#41b4a2] mb-1">{t('plans.essential.price')}</div>
              <div className="text-slate-500 text-sm mb-4">{t('plans.essential.desc')}</div>
              <div className="text-slate-600 text-sm mb-6">{t('plans.essential.note')}</div>
              <button className="w-full bg-gray-100 text-slate-700 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors text-sm">
                {t('plans.essential.price')} total
              </button>
            </div>
          </div>

          {/* Serious */}
          <div className="bg-white border-2 border-[#41b4a2] rounded-xl p-6 relative hover:shadow-lg transition-all duration-200">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-[#41b4a2] text-white px-3 py-1 rounded-full text-xs font-medium">
              Most Popular
            </div>
            <div className="text-center">
              <h3 className="text-xl font-semibold text-slate-800 mb-2">{t('plans.serious.title')}</h3>
              <div className="text-3xl font-light text-[#41b4a2] mb-1">{t('plans.serious.price')}</div>
              <div className="text-slate-500 text-sm mb-4">{t('plans.serious.desc')}</div>
              <div className="text-slate-600 text-sm mb-6">{t('plans.serious.note')}</div>
              <button className="w-full bg-[#41b4a2] hover:bg-[#369185] text-white py-2 rounded-lg font-medium transition-colors text-sm">
                {t('plans.serious.price')} total
              </button>
            </div>
          </div>

          {/* Driven */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 relative hover:shadow-lg transition-all duration-200">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-slate-800 mb-2">{t('plans.driven.title')}</h3>
              <div className="text-3xl font-light text-[#41b4a2] mb-1">{t('plans.driven.price')}</div>
              <div className="text-slate-500 text-sm mb-4">{t('plans.driven.desc')}</div>
              <div className="text-slate-600 text-sm mb-6">{t('plans.driven.note')}</div>
              <button className="w-full bg-slate-600 hover:bg-slate-700 text-white py-2 rounded-lg font-medium transition-colors text-sm">
                {t('plans.driven.price')} total
              </button>
            </div>
          </div>
        </div>

        {/* How it Works */}
        <div className="bg-gray-50 rounded-2xl p-8 mb-16">
          <h2 className="text-2xl font-light text-slate-800 mb-6 text-center">{t('howItWorks.heading')}</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <h3 className="font-semibold text-slate-800 mb-2">{t('howItWorks.steps.oneTitle')}</h3>
              <p className="text-slate-600 text-sm">{t('howItWorks.steps.oneText')}</p>
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-slate-800 mb-2">{t('howItWorks.steps.twoTitle')}</h3>
              <p className="text-slate-600 text-sm">{t('howItWorks.steps.twoText')}</p>
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-slate-800 mb-2">{t('howItWorks.steps.threeTitle')}</h3>
              <p className="text-slate-600 text-sm">{t('howItWorks.steps.threeText')}</p>
            </div>
          </div>
        </div>

        {/* Value Proposition */}
        <div className="text-center mb-16">
          <h2 className="text-3xl font-light text-slate-800 mb-6">{t('why.heading')}</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            <div className="text-left">
              <h3 className="text-xl font-semibold text-slate-800 mb-3">{t('why.benefits.noFees')}</h3>
              <p className="text-slate-600">{t('why.benefits.noFeesText')}</p>
            </div>
            <div className="text-left">
              <h3 className="text-xl font-semibold text-slate-800 mb-3">{t('why.benefits.try')}</h3>
              <p className="text-slate-600">{t('why.benefits.tryText')}</p>
            </div>
            <div className="text-left">
              <h3 className="text-xl font-semibold text-slate-800 mb-3">{t('why.benefits.bulk')}</h3>
              <p className="text-slate-600">{t('why.benefits.bulkText')}</p>
            </div>
            <div className="text-left">
              <h3 className="text-xl font-semibold text-slate-800 mb-3">{t('why.benefits.instant')}</h3>
              <p className="text-slate-600">{t('why.benefits.instantText')}</p>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="text-center">
          <h2 className="text-3xl font-light text-slate-800 mb-8">{t('faq.heading')}</h2>
          <div className="text-left max-w-2xl mx-auto space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">{t('faq.q1')}</h3>
              <p className="text-slate-600">{t('faq.a1')}</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">{t('faq.q2')}</h3>
              <p className="text-slate-600">{t('faq.a2')}</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">{t('faq.q3')}</h3>
              <p className="text-slate-600">{t('faq.a3')}</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">{t('faq.q4')}</h3>
              <p className="text-slate-600">{t('faq.a4')}</p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
