// path: pages/simple-steps.js
import Header from '../components/Header';

export default function SimpleSteps() {
  return (
    <>
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-light text-slate-800 mb-6 leading-tight">
            Simple Steps to Success
          </h1>
          <p className="text-xl text-slate-500 font-normal max-w-2xl mx-auto">
            Transform your job search with our proven process. Repeat these steps for every application to maximize your success rate.
          </p>
        </div>

        {/* Steps Section */}
        <div className="space-y-12 mb-16">
          {/* Step 1 */}
          <div className="flex items-start space-x-6">
            <div className="flex-shrink-0 w-12 h-12 bg-[#41b4a2] text-white rounded-full flex items-center justify-center font-semibold text-lg">
              1
            </div>
            <div>
              <h3 className="text-2xl font-semibold text-slate-800 mb-3">Upload Your CV</h3>
              <p className="text-slate-600 text-lg leading-relaxed">
                Start by uploading your current CV or LinkedIn profile. Our system accepts PDF and Word documents, making it easy to get started with whatever format you have.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start space-x-6">
            <div className="flex-shrink-0 w-12 h-12 bg-[#41b4a2] text-white rounded-full flex items-center justify-center font-semibold text-lg">
              2
            </div>
            <div>
              <h3 className="text-2xl font-semibold text-slate-800 mb-3">Add the Job Description</h3>
              <p className="text-slate-600 text-lg leading-relaxed">
                Paste the job advertisement you're applying for. This step is crucial – it allows our AI to understand exactly what the employer is looking for and tailor your application accordingly.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start space-x-6">
            <div className="flex-shrink-0 w-12 h-12 bg-[#41b4a2] text-white rounded-full flex items-center justify-center font-semibold text-lg">
              3
            </div>
            <div>
              <h3 className="text-2xl font-semibold text-slate-800 mb-3">Get Instant Analysis</h3>
              <p className="text-slate-600 text-lg leading-relaxed">
                Within seconds, receive comprehensive feedback on your CV, a tailored cover letter, and actionable recommendations. Our AI identifies gaps, highlights strengths, and suggests improvements.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex items-start space-x-6">
            <div className="flex-shrink-0 w-12 h-12 bg-[#41b4a2] text-white rounded-full flex items-center justify-center font-semibold text-lg">
              4
            </div>
            <div>
              <h3 className="text-2xl font-semibold text-slate-800 mb-3">Apply Changes & Repeat</h3>
              <p className="text-slate-600 text-lg leading-relaxed">
                Implement the suggested changes to your CV and use the generated cover letter. For each new job application, repeat this process to ensure maximum relevance and impact.
              </p>
            </div>
          </div>
        </div>

        {/* Key Benefits */}
        <div className="bg-gray-50 rounded-lg p-8 mb-16">
          <h2 className="text-3xl font-light text-slate-800 mb-8 text-center">Why This Process Works</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-8 h-8 bg-[#41b4a2] rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 mb-2">Tailored to Each Role</h4>
                <p className="text-slate-600">Every job is different. Our process ensures your application speaks directly to what each employer wants.</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-8 h-8 bg-[#41b4a2] rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 mb-2">Fast & Efficient</h4>
                <p className="text-slate-600">Get professional-quality results in minutes, not hours. Spend more time applying, less time formatting.</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-8 h-8 bg-[#41b4a2] rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 mb-2">Continuous Improvement</h4>
                <p className="text-slate-600">Each analysis helps you understand what works, making your next application even stronger.</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-8 h-8 bg-[#41b4a2] rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 mb-2">Data-Driven Results</h4>
                <p className="text-slate-600">Our recommendations are based on what actually works in today's job market, not outdated advice.</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <h2 className="text-3xl font-light text-slate-800 mb-6">Ready to Get Started?</h2>
          <p className="text-xl text-slate-500 mb-8 max-w-2xl mx-auto">
            Stop sending generic applications. Start getting interviews with targeted, professional CVs and cover letters.
          </p>
          <button className="action-btn">
            Upload Your CV Now
          </button>
        </div>
      </main>
    </>
  );
}
