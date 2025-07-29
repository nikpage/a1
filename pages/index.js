//  pages/index.js
import axios from 'axios';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Header from '../components/Header';
import LoadingModal from '../components/LoadingModal';
import AnalysisDisplay from '../components/AnalysisDisplay';
import LoginModal from '../components/LoginModal';

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

  useEffect(() => {
    const stored = localStorage.getItem('parsed_cv');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.analysis) {
        setAnalysis(parsed.analysis);
      }
      if (parsed?.user_id) {
        setCurrentUserId(parsed.user_id);
      }
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

          const uploadRes = await axios.post(`${process.env.NEXT_PUBLIC_BASE_URL}/api/upload-cv`, formData);
          const uploadData = uploadRes.data;
          if (!uploadData?.user_id) throw new Error(uploadData.error || 'Upload failed to return a user ID.');

          setCurrentUserId(uploadData.user_id);
          setLoadingModalMessage('Analysis in progress...');

          const analyzeRes = await axios.post('/api/analyze-cv-job', {
            user_id: uploadData.user_id,
            jobText,
          });
          const analyzeData = analyzeRes.data;
          if (analyzeData.error) throw new Error(analyzeData.error || 'Analysis failed.');

          const payload = { analysis: analyzeData.analysis, user_id: uploadData.user_id };
          localStorage.setItem('parsed_cv', JSON.stringify(payload));
          setAnalysis(analyzeData.analysis);

        } catch (err) {
          const message = err.response?.data?.error || err.message;
          setError('Error: ' + message);
        } finally {
              setLoading(false);
              setShowLoadingModal(false);
            }
          };
  const handleWriteNowClick = () => {
    if (!currentUserId) {
      setError('User ID not found. Please analyze again.');
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
            <button
              onClick={handleWriteNowClick}
              className="action-btn w-full max-w-xl text-sm sm:text-base py-3 sm:py-4 mt-6 touch-manipulation mx-auto block"
            >
              Write Now
            </button>
          </div>
        )}
        {showLoadingModal && (
          <LoadingModal
            title={loadingModalTitle}
            message={loadingModalMessage}
            onClose={() => setShowLoadingModal(false)}
          />
        )}
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
