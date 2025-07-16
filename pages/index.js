// path: pages/index.js

import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Header from '../components/Header';
import LoadingModal from '../components/LoadingModal';

export default function IndexPage() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [jobText, setJobText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showLoadingModal, setShowLoadingModal] = useState(false);
  const [loadingModalMessage, setLoadingModalMessage] = useState('');
  const [loadingModalTitle, setLoadingModalTitle] = useState('');

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

      if (!uploadRes.ok || !uploadData.user_id) {
        throw new Error(uploadData.error || 'Upload failed');
      }

      setLoadingModalMessage('Analysis in progress...');

      const analyzeRes = await fetch('/api/analyze-cv-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: uploadData.user_id,
          jobText,
          created_at: uploadData.created_at,
        }),
      });

      const analyzeData = await analyzeRes.json();

      if (!analyzeRes.ok || analyzeData.error) {
        throw new Error(analyzeData.error || 'Analysis failed');
      }

      router.push(`/${uploadData.user_id}`);
    } catch (err) {
      console.error("Upload/Analysis Error:", err);
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
      setShowLoadingModal(false);
    }
  };

  return (
    <>
      <Head>
        <title>Job Targeted CV & Cover Letter</title>
        <meta name="description" content="Target your applications to every job you apply to with keyword matched and ATS optimized CV and cover letters that make you not only get noticed but stand out and got onto the interview A-List." />
      </Head>
      <Header />
      <main className="mx-auto px-4 py-4 text-center">
        {/* Hero Section - 3 columns on desktop, stacked on mobile */}
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

        {/* Subtitle */}
        <div className="mb-8 text-lg sm:text-xl text-slate-500 font-normal text-center px-4">
          Because Average CVs Are for Average People.
        </div>

        {/* Form Section */}
        <form onSubmit={handleUploadAndAnalyze} className="flex flex-col gap-6 items-center mb-16 px-4">
          {/* File Upload */}
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

        {/* Loading Modal */}
        {showLoadingModal && (
          <LoadingModal
            title={loadingModalTitle}
            message={loadingModalMessage}
            onClose={() => setShowLoadingModal(false)}
          />
        )}
      </main>
    </>
  );
}

// Add getStaticProps for static site generation
export async function getStaticProps() {
  return {
    props: {}, // No specific props needed for this page as content is hardcoded in JSX
  };
}
