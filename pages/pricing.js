// path: pages/pricing.js
import Header from '../components/Header';

export default function Pricing() {
  return (
    <>
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-light text-slate-800 mb-6 leading-tight">
            Simple, Pay-As-You-Go Pricing
          </h1>
          <p className="text-xl text-slate-500 font-normal max-w-2xl mx-auto">
            No subscriptions. No hidden fees. Only pay when you download your optimized documents.
          </p>
        </div>

        {/* Free Generation Info */}
        <div className="bg-[#41b4a2] bg-opacity-10 border border-[#41b4a2] rounded-2xl p-8 mb-16 text-center">
          <h2 className="text-2xl font-semibold text-slate-800 mb-4">Try Before You Buy</h2>
          <p className="text-lg text-slate-600 mb-6">
            Generate unlimited CVs and cover letters for free. Experiment with different tones and styles.
            You only pay when you're ready to download your final documents.
          </p>
          <div className="flex items-center justify-center space-x-8">
            <div className="text-center">
              <div className="text-3xl font-light text-[#41b4a2] mb-2">∞</div>
              <div className="text-slate-700 font-medium">Free Generations</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-light text-[#41b4a2] mb-2">10</div>
              <div className="text-slate-700 font-medium">Free Experiments</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-light text-[#41b4a2] mb-2">€0</div>
              <div className="text-slate-700 font-medium">To Get Started</div>
            </div>
          </div>
        </div>

        {/* Download Pricing */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-light text-slate-800 mb-4">Download Pricing</h2>
          <p className="text-lg text-slate-500 mb-8">
            When you're happy with your documents, choose how many downloads you need
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {/* Starter */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-slate-800 mb-2">Starter</h3>
              <div className="text-3xl font-light text-[#41b4a2] mb-1">€6</div>
              <div className="text-slate-500 text-sm mb-4">1 Download</div>
              <div className="text-slate-600 text-sm mb-6">Perfect for trying out</div>

              <ul className="text-left space-y-2 mb-6 text-sm">
                <li className="flex items-center text-slate-700">
                  <svg className="w-4 h-4 text-[#41b4a2] mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  CV or Cover Letter
                </li>
                <li className="flex items-center text-slate-700">
                  <svg className="w-4 h-4 text-[#41b4a2] mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  PDF & DOCX formats
                </li>
                <li className="flex items-center text-slate-700">
                  <svg className="w-4 h-4 text-[#41b4a2] mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  ATS-optimized
                </li>
              </ul>

              <button className="w-full bg-gray-100 text-slate-700 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors text-sm">
                €6.00 per download
              </button>
            </div>
          </div>

          {/* Essential */}
          <div className="bg-white border-2 border-[#41b4a2] rounded-xl p-6 relative hover:shadow-lg transition-all duration-200">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-[#41b4a2] text-white px-3 py-1 rounded-full text-xs font-medium">
              Most Popular
            </div>
            <div className="text-center">
              <h3 className="text-xl font-semibold text-slate-800 mb-2">Essential</h3>
              <div className="text-3xl font-light text-[#41b4a2] mb-1">€8</div>
              <div className="text-slate-500 text-sm mb-4">2 Downloads</div>
              <div className="text-slate-600 text-sm mb-6">CV + Cover Letter</div>

              <ul className="text-left space-y-2 mb-6 text-sm">
                <li className="flex items-center text-slate-700">
                  <svg className="w-4 h-4 text-[#41b4a2] mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Complete application set
                </li>
                <li className="flex items-center text-slate-700">
                  <svg className="w-4 h-4 text-[#41b4a2] mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  PDF & DOCX formats
                </li>
                <li className="flex items-center text-slate-700">
                  <svg className="w-4 h-4 text-[#41b4a2] mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  33% savings
                </li>
              </ul>

              <button className="w-full bg-[#41b4a2] hover:bg-[#369185] text-white py-2 rounded-lg font-medium transition-colors text-sm">
                €4.00 per download
              </button>
            </div>
          </div>

          {/* Professional */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-slate-800 mb-2">Professional</h3>
              <div className="text-3xl font-light text-[#41b4a2] mb-1">€23</div>
              <div className="text-slate-500 text-sm mb-4">10 Downloads</div>
              <div className="text-slate-600 text-sm mb-6">Best for job hunting</div>

              <ul className="text-left space-y-2 mb-6 text-sm">
                <li className="flex items-center text-slate-700">
                  <svg className="w-4 h-4 text-[#41b4a2] mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Multiple applications
                </li>
                <li className="flex items-center text-slate-700">
                  <svg className="w-4 h-4 text-[#41b4a2] mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  PDF & DOCX formats
                </li>
                <li className="flex items-center text-slate-700">
                  <svg className="w-4 h-4 text-[#41b4a2] mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  62% savings
                </li>
              </ul>

              <button className="w-full bg-slate-700 hover:bg-slate-800 text-white py-2 rounded-lg font-medium transition-colors text-sm">
                €2.30 per download
              </button>
            </div>
          </div>

          {/* Enterprise */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-slate-800 mb-2">Enterprise</h3>
              <div className="text-3xl font-light text-[#41b4a2] mb-1">€42</div>
              <div className="text-slate-500 text-sm mb-4">30 Downloads</div>
              <div className="text-slate-600 text-sm mb-6">Professional package</div>

              <ul className="text-left space-y-2 mb-6 text-sm">
                <li className="flex items-center text-slate-700">
                  <svg className="w-4 h-4 text-[#41b4a2] mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Bulk applications
                </li>
                <li className="flex items-center text-slate-700">
                  <svg className="w-4 h-4 text-[#41b4a2] mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  PDF & DOCX formats
                </li>
                <li className="flex items-center text-slate-700">
                  <svg className="w-4 h-4 text-[#41b4a2] mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  77% savings
                </li>
              </ul>

              <button className="w-full bg-slate-700 hover:bg-slate-800 text-white py-2 rounded-lg font-medium transition-colors text-sm">
                €1.40 per download
              </button>
            </div>
          </div>
        </div>

        {/* How it Works */}
        <div className="bg-gray-50 rounded-2xl p-8 mb-16">
          <h2 className="text-2xl font-light text-slate-800 mb-6 text-center">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-[#41b4a2] bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-[#41b4a2] font-semibold">1</span>
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">Generate for Free</h3>
              <p className="text-slate-600 text-sm">Upload your CV and job description. Generate unlimited variations with different tones and styles.</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-[#41b4a2] bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-[#41b4a2] font-semibold">2</span>
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">Perfect Your Documents</h3>
              <p className="text-slate-600 text-sm">Try up to 10 different versions. Experiment with professional, casual, or creative tones.</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-[#41b4a2] bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-[#41b4a2] font-semibold">3</span>
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">Download When Ready</h3>
              <p className="text-slate-600 text-sm">Only pay when you're satisfied. Download your optimized documents in PDF or DOCX format.</p>
            </div>
          </div>
        </div>

        {/* Value Proposition */}
        <div className="text-center mb-16">
          <h2 className="text-3xl font-light text-slate-800 mb-6">Why Choose Pay-Per-Download?</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            <div className="text-left">
              <h3 className="text-xl font-semibold text-slate-800 mb-3">No Recurring Fees</h3>
              <p className="text-slate-600">Pay only when you need documents. No monthly subscriptions or hidden charges.</p>
            </div>
            <div className="text-left">
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Try Before You Buy</h3>
              <p className="text-slate-600">Generate and preview unlimited versions before purchasing your final documents.</p>
            </div>
            <div className="text-left">
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Bulk Discounts</h3>
              <p className="text-slate-600">Save up to 77% when you buy downloads in bulk for your job search campaign.</p>
            </div>
            <div className="text-left">
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Instant Access</h3>
              <p className="text-slate-600">Download immediately after purchase. No waiting, no approval process.</p>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="text-center">
          <h2 className="text-3xl font-light text-slate-800 mb-8">Frequently Asked Questions</h2>
          <div className="text-left max-w-2xl mx-auto space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">How many times can I generate documents for free?</h3>
              <p className="text-slate-600">You can generate unlimited documents and try up to 10 different versions before needing to purchase downloads.</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">What file formats do you provide?</h3>
              <p className="text-slate-600">All downloads include both PDF and DOCX formats, optimized for ATS systems and human review.</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Do my download credits expire?</h3>
              <p className="text-slate-600">No, your download credits never expire. Use them whenever you need them.</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Can I get a refund?</h3>
              <p className="text-slate-600">Since you can preview documents before purchase, we don't offer refunds on downloads. However, we're happy to help with any issues.</p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
