// path: components/DocumentDownloadButtons.js
import { supabase } from '../utils/database';
import exportDocxWithDocxLib from '../utils/exportDocxFormatted';



export default function DocumentDownloadButtons({
  user_id,
  cvText,
  coverText,
  activeTab,
  analysis,          // names the file: [doc]-[FirstLast]_[Company]
  onTokenFail,
  onDownloaded,      // called with the exact body that reached the user's disk
}) {
  const handleDownload = async () => {
    const type = activeTab === 'cv' ? 'cv' : 'cover';
    const content = type === 'cv' ? cvText : coverText;
    if (!content) return;

    try {
      const res = await fetch('/api/download-token-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id, type, content }),
      });

      if (res.status === 402) {
        onTokenFail?.();
        return;
      }

      if (!res.ok) {
        alert('Token check failed');
        return;
      }

      // Token valid — generate and download
      await exportDocxWithDocxLib({
        type,
        user_id,
        markdownText: content,
        analysis,
      });

      // Only after the export actually completed — a failed export must not
      // clear the "you haven't saved this yet" warning.
      onDownloaded?.(content);

      window.dispatchEvent(new Event('header-stats-updated'));


    } catch (err) {
      console.error('Download error:', err);
      alert('Download error');
    }
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '2rem' }}>
      <button
    className="download-btn"
    onClick={handleDownload}
  >
    Download {activeTab === 'cv' ? 'CV' : 'Cover Letter'}
  </button>

    </div>
  );
}
