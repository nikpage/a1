// path: pages/the-secret-weapon.js
import Head from 'next/head'; // Import Head
import Header from '../components/Header';

export default function TheSecretWeapon() {
  return (
    <>
      <Head>
        <title>CV to Interview Secret Weapon</title>
        <meta name="description" content="Unlock more interview calls. Discover the secret to transforming your CV into a perfectly targeted, ATS-optimized application that gets noticed by recruiters and hiring managers." />
        <link rel="icon" href="/favicon-32x32.png" /> {/* Added favicon link */}
      </Head>
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-light text-slate-800 mb-6 leading-tight">
            The Secret Weapon: Your Path to Job Interview Success
          </h1>
          <p className="text-xl text-slate-500 font-normal max-w-2xl mx-auto">
            Uncover the proven strategy to elevate your job applications. Transform your CV into a targeted asset that secures more interviews and job offers.
          </p>
        </div>

        {/* The Problem */}
        <div className="mb-16">
          <h2 className="text-3xl font-light text-slate-800 mb-8 text-center">The Job Application Problem: Why Your CV Gets Ignored</h2>
          <div className="bg-red-50 border-l-4 border-red-400 p-6 rounded-r-lg mb-8">
            <p className="text-slate-700 text-lg leading-relaxed">
              Are your job applications disappearing into a black hole? You're submitting resumes, but getting no interview invitations. It's a common frustration, especially when less qualified candidates seem to get ahead.
            </p>
          </div>
          <p className="text-slate-600 text-lg leading-relaxed">
            The harsh reality is: <strong>most resumes are generic, lack focus, and fail to speak the employer's specific language.</strong> They're often written for human eyes but filtered out by Applicant Tracking Systems (ATS). They showcase what you want to highlight, not the specific skills and experience recruiters are actively searching for.
          </p>
        </div>

        {/* The Secret */}
        <div className="mb-16">
          <h2 className="text-3xl font-light text-slate-800 mb-8 text-center">The Secret Weapon: Targeted CVs & Cover Letters</h2>
          <div className="bg-[#41b4a2] bg-opacity-10 border-l-4 border-[#41b4a2] p-6 rounded-r-lg mb-8">
            <p className="text-slate-700 text-lg leading-relaxed font-medium">
              The real secret isn't a "perfect" CV. It's having a <em>perfectly targeted CV and cover letter</em> for every single job application.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold text-slate-800 mb-4">Common Application Mistakes</h3>
              <ul className="space-y-2 text-slate-600">
                <li className="flex items-start">
                  <span className="text-red-500 mr-2">✗</span>
                  Sending a single, generic CV to all jobs
                </li>
                <li className="flex items-start">
                  <span className="text-red-500 mr-2">✗</span>
                  Using unoriginal, template-based cover letters
                </li>
                <li className="flex items-start">
                  <span className="text-red-500 mr-2">✗</span>
                  Focusing on general job duties instead of specific achievements
                </li>
                <li className="flex items-start">
                  <span className="text-red-500 mr-2">✗</span>
                  Ignoring crucial keywords and company values in job descriptions
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-slate-800 mb-4">Winning Job Search Strategies</h3>
              <ul className="space-y-2 text-slate-600">
                <li className="flex items-start">
                  <span className="text-[#41b4a2] mr-2">✓</span>
                  Customizing every application for maximum relevance
                </li>
                <li className="flex items-start">
                  <span className="text-[#41b4a2] mr-2">✓</span>
                  Matching your language precisely to the job description keywords
                </li>
                <li className="flex items-start">
                  <span className="text-[#41b4a2] mr-2">✓</span>
                  Highlighting accomplishments that directly align with the role
                </li>
                <li className="flex items-start">
                  <span className="text-[#41b4a2] mr-2">✓</span>
                  Speaking the employer's specific needs and language
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* The Method */}
        <div className="mb-16">
          <h2 className="text-3xl font-light text-slate-800 mb-8 text-center">Our AI-Powered CV Optimization Method</h2>
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-slate-800 mb-3">1. Advanced Algorithmic CV Analysis</h3>
              <p className="text-slate-600">
                Our cutting-edge AI comprehensively analyzes job descriptions to identify exact requirements, in-demand skills, and subtle company culture cues. It goes beyond surface-level text, understanding the employer's true needs.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-slate-800 mb-3">2. Smart CV and Resume Optimization</h3>
              <p className="text-slate-600">
                We intelligently restructure your resume and CV to emphasize the most relevant achievements and skills. Our system fine-tunes your language to match industry standards, ensuring your application successfully navigates ATS filters and impresses human recruiters.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-slate-800 mb-3">3. Strategic Application Positioning</h3>
              <p className="text-slate-600">
                Every word in your tailored documents is strategically chosen for maximum impact. We effectively position you as the ideal candidate by emphasizing core competencies and experiences that are most critical for the specific job role and company.
              </p>
            </div>
          </div>
        </div>

        {/* The Results */}
        <div className="mb-16">
          <h2 className="text-3xl font-light text-slate-800 mb-8 text-center">Achieve Job Search Success: Proven Results</h2>
          <div className="bg-gray-50 rounded-lg p-8">
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-4xl font-light text-[#41b4a2] mb-2">3x</div>
                <div className="text-slate-800 font-semibold">More Job Interview Invitations</div>
                <div className="text-slate-600 text-sm mt-2">Based on extensive user feedback</div>
              </div>
              <div>
                <div className="text-4xl font-light text-[#41b4a2] mb-2">75%</div>
                <div className="text-slate-800 font-semibold">Faster Application Process</div>
                <div className="text-slate-600 text-sm mt-2">Streamline your job search from hours to minutes</div>
              </div>
              <div>
                <div className="text-4xl font-light text-[#41b4a2] mb-2">90%</div>
                <div className="text-slate-800 font-semibold">User Satisfaction Rate</div>
                <div className="text-slate-600 text-sm mt-2">Our users highly recommend our targeted CV and cover letter tool</div>
              </div>
            </div>
          </div>
        </div>

        {/* Why Now */}
        <div className="mb-16">
          <h2 className="text-3xl font-light text-slate-800 mb-8 text-center">Why Tailored Applications Matter in Today's Job Market</h2>
          <div className="space-y-4 text-slate-600 text-lg leading-relaxed">
            <p>
              The modern job market is highly competitive. With hundreds of applicants for each position, employers rely on advanced filtering systems and AI to pre-screen candidates. Your resume and cover letter now have mere seconds to make a critical impression.
            </p>
            <p>
              <strong>Generic applications are no longer effective.</strong> The candidates who successfully secure interviews and job offers are those who clearly demonstrate a deep understanding of the role, the company culture, and the exact skills required.
            </p>
            <p>
              Our platform provides you with a crucial advantage: perfectly targeted applications, every time. While others submit unoptimized documents, you'll be sending laser-focused CVs and cover letters that directly address what employers seek, ensuring you stand out.
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <h2 className="text-3xl font-light text-slate-800 mb-6">Ready to Experience Your Job Search Secret Weapon?</h2>
          <p className="text-xl text-slate-500 mb-8 max-w-2xl mx-auto">
            Stop generic applications. Start getting noticed. Target your CVs and cover letters like a seasoned professional.
          </p>
          <button className="action-btn">
            Get Started Now
          </button>
        </div>
      </main>
    </>
  );
}
