// pages/index.js
import axios from 'axios';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Header from '../components/Header';
import LoadingModal from '../components/LoadingModal';
import AnalysisDisplay from '../components/AnalysisDisplay';
import LoginModal from '../components/LoginModal';
import { useTranslation } from 'react-i18next';

export default function IndexPage() {
  const { t } = useTranslation();  const router = useRouter();
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
    setLoadingModalTitle(t('modal.processingTitle'));
    setLoadingModalMessage(t('modal.processingMessage'));

    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await axios.post(`${process.env.NEXT_PUBLIC_BASE_URL}/api/upload-cv`, formData);
      const uploadData = uploadRes.data;
      if (!uploadData?.user_id) throw new Error(uploadData.error || t('error.uploadFailed'));

      setCurrentUserId(uploadData.user_id);
      setLoadingModalMessage(t('modal.inProgress'));

      const analyzeRes = await axios.post('/api/analyze-cv-job', {
        user_id: uploadData.user_id,
        jobText,
      });
      const analyzeData = analyzeRes.data;
      if (analyzeData.error) throw new Error(analyzeData.error || t('error.analysisFailed'));

      const payload = { analysis: analyzeData.analysis, user_id: uploadData.user_id };
      localStorage.setItem('parsed_cv', JSON.stringify(payload));
      setAnalysis(analyzeData.analysis);

    } catch (err) {
      const message = err.response?.data?.error || err.message;
      setError(t('modal.errorPrefix') + message);
    } finally {
      setLoading(false);
      setShowLoadingModal(false);
    }
  };

  const handleWriteNowClick = () => {
    if (!currentUserId) {
      setError(t('error.noUserId'));
      return;
    }
    setShowLoginModal(true);
  };

  return (
    <>
      <Head>
        <title>{t('meta.title')}</title>
        <meta name="description" content={t('meta.description')} />
        <link rel="icon" href="/favicon-32x32.png" />
      </Head>
      <Header />
      <main className="mx-auto px-4 py-4 text-center">
        <div className="flex flex-col lg:flex-row justify-center items-start mb-6 lg:gap-20 gap-8">
          <div className="w-full lg:w-[600px] text-2xl sm:text-3xl lg:text-4xl font-light text-slate-800 text-center leading-tight">
            {t('hero.section1')}
          </div>
          <div className="w-full lg:w-[600px] text-2xl sm:text-3xl lg:text-4xl font-light text-slate-800 text-center leading-tight">
            {t('hero.section2')}
          </div>
          <div className="w-full lg:w-[600px] text-2xl sm:text-3xl lg:text-4xl font-light text-slate-800 text-center leading-tight">
            {t('hero.section3')}
          </div>
        </div>
        <div className="mb-8 text-lg sm:text-xl text-slate-500 font-normal text-center px-4">
          {t('hero.tagline')}
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
                  <p className="text-black text-sm sm:text-base">{t('form.dropPrompt')}</p>
                  <p className="text-black text-sm sm:text-base mt-1">{t('form.formatHint')}</p>
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
              placeholder={t('form.placeholder')}
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
              {loading ? t('form.button.loading') : t('form.button.submit')}
            </button>
            {error && <div className="text-red-600 text-sm mt-2 px-4 text-center">{error}</div>}
          </form>
        ) : (
          <div className="border rounded-lg p-6 bg-white shadow-sm max-w-3xl mx-auto text-left">
            <div className="mb-6 text-2xl font-bold text-center">{t('form.analysisTitle')}</div>
            <AnalysisDisplay analysis={analysis} />
            <button
              onClick={handleWriteNowClick}
              className="action-btn w-full max-w-xl text-sm sm:text-base py-3 sm:py-4 mt-6 touch-manipulation mx-auto block"
            >
              {t('form.writeNow')}
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
