// path: pages/the-secret-weapon.js
import Header from '../components/Header';

export default function TheSecretWeapon() {
  return (
    <>
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-light text-slate-800 mb-6 leading-tight">
            The Secret Weapon
          </h1>
          <p className="text-xl text-slate-500 font-normal max-w-2xl mx-auto">
            Discover the method that changes everything. No hype. Just results. The practical tools that work, backed by data and clear action steps.
          </p>
        </div>

        {/* The Problem */}
        <div className="mb-16">
          <h2 className="text-3xl font-light text-slate-800 mb-8 text-center">The Problem Everyone Faces</h2>
          <div className="bg-red-50 border-l-4 border-red-400 p-6 rounded-r-lg mb-8">
            <p className="text-slate-700 text-lg leading-relaxed">
              You send out dozens of applications. You hear nothing back. Your CV disappears into the void.
              Meanwhile, less qualified candidates are getting interviews. What's going wrong?
            </p>
          </div>
          <p className="text-slate-600 text-lg leading-relaxed">
            The truth is harsh: <strong>most CVs are generic, unfocused, and fail to speak the employer's language.</strong>
            They're written for humans, but filtered by algorithms. They highlight what you want to say, not what employers want to hear.
          </p>
        </div>

        {/* The Secret */}
        <div className="mb-16">
          <h2 className="text-3xl font-light text-slate-800 mb-8 text-center">The Secret Weapon Revealed</h2>
          <div className="bg-[#41b4a2] bg-opacity-10 border-l-4 border-[#41b4a2] p-6 rounded-r-lg mb-8">
            <p className="text-slate-700 text-lg leading-relaxed font-medium">
              The secret isn't having a perfect CV. It's having a <em>perfectly targeted CV</em> for each application.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold text-slate-800 mb-4">What Most People Do</h3>
              <ul className="space-y-2 text-slate-600">
                <li className="flex items-start">
                  <span className="text-red-500 mr-2">✗</span>
                  Send the same CV to every job
                </li>
                <li className="flex items-start">
                  <span className="text-red-500 mr-2">✗</span>
                  Use generic cover letters
                </li>
                <li className="flex items-start">
                  <span className="text-red-500 mr-2">✗</span>
                  Focus on job duties, not achievements
                </li>
                <li className="flex items-start">
                  <span className="text-red-500 mr-2">✗</span>
                  Ignore keywords and company culture
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-slate-800 mb-4">What Winners Do</h3>
              <ul className="space-y-2 text-slate-600">
                <li className="flex items-start">
                  <span className="text-[#41b4a2] mr-2">✓</span>
                  Tailor every application
                </li>
                <li className="flex items-start">
                  <span className="text-[#41b4a2] mr-2">✓</span>
                  Match the job description language
                </li>
                <li className="flex items-start">
                  <span className="text-[#41b4a2] mr-2">✓</span>
                  Highlight relevant achievements
                </li>
                <li className="flex items-start">
                  <span className="text-[#41b4a2] mr-2">✓</span>
                  Speak the employer's language
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* The Method */}
        <div className="mb-16">
          <h2 className="text-3xl font-light text-slate-800 mb-8 text-center">How It Actually Works</h2>
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-slate-800 mb-3">1. Algorithmic Analysis</h3>
              <p className="text-slate-600">
                Our AI analyzes job descriptions to identify key requirements, preferred skills, and company culture indicators.
                It understands not just what's written, but what's implied.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-slate-800 mb-3">2. CV Optimization</h3>
              <p className="text-slate-600">
                We restructure your experience to highlight the most relevant achievements, adjust language to match industry standards,
                and ensure your CV passes both ATS systems and human review.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-slate-800 mb-3">3. Strategic Positioning</h3>
              <p className="text-slate-600">
                Every word is chosen strategically. We position you as the ideal candidate by emphasizing skills that matter most
                for the specific role and company.
              </p>
            </div>
          </div>
        </div>

        {/* The Results */}
        <div className="mb-16">
          <h2 className="text-3xl font-light text-slate-800 mb-8 text-center">The Results Speak for Themselves</h2>
          <div className="bg-gray-50 rounded-lg p-8">
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-4xl font-light text-[#41b4a2] mb-2">3x</div>
                <div className="text-slate-800 font-semibold">More Interview Invitations</div>
                <div className="text-slate-600 text-sm mt-2">Based on user feedback</div>
              </div>
              <div>
                <div className="text-4xl font-light text-[#41b4a2] mb-2">75%</div>
                <div className="text-slate-800 font-semibold">Faster Application Process</div>
                <div className="text-slate-600 text-sm mt-2">Minutes instead of hours</div>
              </div>
              <div>
                <div className="text-4xl font-light text-[#41b4a2] mb-2">90%</div>
                <div className="text-slate-800 font-semibold">User Satisfaction Rate</div>
                <div className="text-slate-600 text-sm mt-2">Would recommend to others</div>
              </div>
            </div>
          </div>
        </div>

        {/* Why Now */}
        <div className="mb-16">
          <h2 className="text-3xl font-light text-slate-800 mb-8 text-center">Why This Matters More Than Ever</h2>
          <div className="space-y-4 text-slate-600 text-lg leading-relaxed">
            <p>
              The job market has changed. With hundreds of applications per position, employers use sophisticated filtering systems.
              Your CV has seconds to make an impression.
            </p>
            <p>
              <strong>Generic doesn't work anymore.</strong> The candidates who get hired are those who demonstrate they understand
              the role, the company, and exactly what's needed.
            </p>
            <p>
              Our platform gives you the unfair advantage of perfect targeting, every time. While others send generic applications,
              you send laser-focused ones that speak directly to what employers want.
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <h2 className="text-3xl font-light text-slate-800 mb-6">Ready to Use the Secret Weapon?</h2>
          <p className="text-xl text-slate-500 mb-8 max-w-2xl mx-auto">
            Stop competing with everyone else. Start targeting like a professional.
          </p>
          <button className="action-btn">
            Get Started Now
          </button>
        </div>
      </main>
    </>
  );
}
