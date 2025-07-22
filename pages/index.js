<<<<<<< HEAD
// pages/index.js
import { useState } from 'react';
=======
// path: pages/index.js
import { useState, useEffect } from 'react';
>>>>>>> 0dc90bed97c2b789059cc7aec82817ab86fb6540
import { useRouter } from 'next/router';
import Head from 'next/head';
import Header from '../components/Header';
import LoadingModal from '../components/LoadingModal';
<<<<<<< HEAD
import LoginModal from '../components/LoginModal';
=======
import AnalysisDisplay from '../components/AnalysisDisplay';
>>>>>>> 0dc90bed97c2b789059cc7aec82817ab86fb6540

export default function IndexPage() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [jobText, setJobText] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showLoadingModal, setShowLoadingModal] = useState(false);
  const [loadingModalMessage, setLoadingModalMessage] = useState('');
  const [loadingModalTitle, setLoadingModalTitle] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  // Check for error messages from auth redirects
  const { error: urlError } = router.query;
  useState(() => {
    if (urlError) {
      switch (urlError) {
        case 'unauthorized':
          setError('Please log in to access your CV analysis.');
          break;
        case 'invalid-token':
        case 'invalid-or-expired-token':
          setError('Login link is invalid or expired. Please request a new one.');
          break;
        case 'verification-failed':
        case 'login-failed':
          setError('Login failed. Please try again.');
          break;
      }
    }
  }, [urlError]);

  useEffect(() => {
    const stored = localStorage.getItem('parsed_cv');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.analysis) setAnalysis(parsed.analysis);
    }
  }, []);

  const handleUploadAndAnalyze = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setShowLoadingModal(true);
    setLoadingModalTitle('Processing your CV and Job Ad');
    setLoadingModalMessage('Uploading your CV and preparing for analysis...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/upload-cv', {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.user_id) throw new Error(uploadData.error || 'Upload failed');

      setCurrentUserId(uploadData.user_id);
      setLoadingModalMessage('Analysis in progress...');

      const analyzeRes = await fetch('/api/analyze-cv-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: uploadData.user_id, jobText }),
      });
      const analyzeData = await analyzeRes.json();
      if (!analyzeRes.ok || analyzeData.error) throw new Error(analyzeData.error || 'Analysis failed');

<<<<<<< HEAD
      if (!analyzeRes.ok || analyzeData.error) {
        throw new Error(analyzeData.error || 'Analysis failed');
      }

      // Analysis complete - show Write Now button
      setShowLoadingModal(false);
      setLoading(false);

=======
      const payload = { analysis: analyzeData.analysis };
      localStorage.setItem('parsed_cv', JSON.stringify(payload));
      setAnalysis(analyzeData.analysis);
>>>>>>> 0dc90bed97c2b789059cc7aec82817ab86fb6540
    } catch (err) {
      setError('Error: ' + err.message);
      setShowLoadingModal(false);
      setLoading(false);
    }
  };

  const handleWriteNowClick = () => {
    if (!currentUserId) {
      setError('Please upload and analyze your CV first.');
      return;
    }
    setShowLoginModal(true);
  };

  return (
    <>
      <Head>
        <title>Job Targeted CV & Cover Letter</title>
        <meta name="description" content="Target your applications to every job you apply to with keyword matched and ATS optimized CV and cover letters that make you not only get noticed but stand out and got onto the interview A-List." />
        <link rel="icon" href="/favicon-32x32.png" />
      </Head>
      <Header />
      <main className="mx-auto px-4 py-4 text-center">
        <div className="flex flex-col lg:flex-row justify-center items-start mb-6 lg:gap-20 gap-8">
          <div className="w-full lg:w-[600px] text-2xl sm:text-3xl lg:text-4xl font-light text-slate-800 text-center leading-tight">
            Regular CV<br /><em>plus</em> Job Add
          </div>
          <div className="w-full lg:w-[600px] text-2xl sm:text-3xl lg:text-4xl font-light text-slate-800 text-center leading-tight">
            Targeted<br />CV & Cover Letter
          </div>
          <div className="w-full lg:w-[600px] text-2xl sm:text-3xl lg:text-4xl font-light text-slate-800 text-center leading-tight">
            More Interviews<br />More Offers
          </div>
        </div>
        <div className="mb-8 text-lg sm:text-xl text-slate-500 font-normal text-center px-4">
          Because Average CVs Are for Average People.
        </div>
        {!analysis ? (
          <form onSubmit={handleUploadAndAnalyze} className="flex flex-col gap-6 items-center mb-16 px-4">
            <div
              onClick={() => document.getElementById('file-input').click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const droppedFile = e.dataTransfer.files[0];
                if (droppedFile) setFile(droppedFile);
              }}
              className="w-full max-w-xl border-2 border-dashed border-gray-300 rounded-lg py-6 bg-white cursor-pointer flex flex-col items-center justify-center h-28 touch-manipulation"
            >
              {file ? (
                <p className="text-black text-sm sm:text-base px-4 text-center break-words">{file.name}</p>
              ) : (
                <>
                  <p className="text-black text-sm sm:text-base">Drop CV or LinkedIn Profile</p>
                  <p className="text-black text-sm sm:text-base mt-1">PDF or Word</p>
                </>
              )}
              <input
                id="file-input"
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files[0])}
                className="hidden"
              />
            </div>
            <textarea
              placeholder="Paste Job Ad (highly recommended)"
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
              rows={5}
              className="w-full max-w-xl border border-gray-300 rounded-lg p-3 text-sm sm:text-base text-black text-center placeholder-text-black placeholder-opacity-100 resize-none"
            />
            <button
              type="submit"
              disabled={loading || !file}
              className="action-btn w-full max-w-xl text-sm sm:text-base py-3 sm:py-4 touch-manipulation"
            >
              {loading ? 'Uploading & Analyzing…' : 'Upload & Analyze'}
            </button>
            {error && <div className="text-red-600 text-sm mt-2 px-4 text-center">{error}</div>}
          </form>
        ) : (
          <div className="border rounded-lg p-6 bg-white shadow-sm max-w-3xl mx-auto text-left">
            <div className="mb-6 text-2xl font-bold text-center">Your CV Analysis</div>
            <AnalysisDisplay analysis={analysis} />
            <a href="/login" className="mt-6 inline-block text-blue-600 underline text-lg">Log in to save it permanently.</a>
          </div>
<<<<<<< HEAD

          {/* Job Text Area */}
          <textarea
            placeholder="Paste Job Ad (highly recommended)"
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            rows={5}
            className="w-full max-w-xl border border-gray-300 rounded-lg p-3 text-sm sm:text-base text-black text-center placeholder-text-black placeholder-opacity-100 resize-none"
          />

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !file}
            className="action-btn w-full max-w-xl text-sm sm:text-base py-3 sm:py-4 touch-manipulation"
          >
            {loading ? 'Uploading & Analyzing…' : 'Upload & Analyze'}
          </button>

          {/* Error Message */}
          {error && <div className="text-red-600 text-sm mt-2 px-4 text-center">{error}</div>}
        </form>

        {/* Write Now button - only show after successful analysis */}
        {currentUserId && !loading && (
          <button
            onClick={handleWriteNowClick}
            className="action-btn w-full max-w-xl text-sm sm:text-base py-3 sm:py-4 mt-8 touch-manipulation"
          >
            Write Now
          </button>
        )}

        {/* Loading Modal */}
=======
        )}
>>>>>>> 0dc90bed97c2b789059cc7aec82817ab86fb6540
        {showLoadingModal && (
          <LoadingModal
            title={loadingModalTitle}
            message={loadingModalMessage}
            onClose={() => setShowLoadingModal(false)}
          />
        )}

        {/* Login Modal */}
        {showLoginModal && (
          <LoginModal
            onClose={() => setShowLoginModal(false)}
            userId={currentUserId}
          />
        )}
      </main>
    </>
  );
}
<<<<<<< HEAD

export async function getStaticProps() {
  return {
    props: {},
  };
}
=======
>>>>>>> 0dc90bed97c2b789059cc7aec82817ab86fb6540
