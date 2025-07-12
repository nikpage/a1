// path: components/DocumentDownloadButtons.js
import { supabase } from '../utils/database';
import exportDocxWithDocxLib from '../utils/exportDocxFormatted';



export default function DocumentDownloadButtons({
  user_id,
  cvText,
  coverText,
  activeTab,
  onTokenFail,
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
        alert('Download failed');
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-${user_id}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      alert('Download error');
    }
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '2rem' }}>
      <button
        onClick={handleDownload}
      >
        Download {activeTab === 'cv' ? 'CV' : 'Cover Letter'}
      </button>
    </div>
  );
}
