// /components/cardCVFeedback.js
import ReactMarkdown from 'react-markdown';

export default function CardCVFeedback({ feedback, secretUrl }) {
  if (!feedback) return null;

  const handleSaveAndRedirect = async () => {
    try {
      // Simply save the feedback as a file
      const payload = {
        feedback: typeof feedback === 'object' ? JSON.stringify(feedback) : feedback,
      };

      const res = await fetch('/api/saveCVFeedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Save failed with status: ${res.status}`);
      }

      // Redirect to secret URL after successful save
      if (secretUrl) {
        window.location.href = secretUrl;
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Error saving feedback: ' + error.message);
    }
  };

  return (
    <div style={{ marginTop: '2rem' }}>
      <div style={{
        backgroundColor: '#fffef5',
        padding: '1.25rem',
        borderLeft: '4px solid #facc15',
        borderRadius: '6px',
        fontSize: '0.95rem',
        lineHeight: '1.6',
        color: '#1f2937'
      }}>
        <ReactMarkdown>{typeof feedback === 'object' ? JSON.stringify(feedback) : feedback}</ReactMarkdown>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <button
          onClick={handleSaveAndRedirect}
          style={{
            marginTop: '1rem',
            backgroundColor: '#1e5a96',
            color: 'white',
            padding: '0.5rem 1rem',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          Write My Awesome CV
        </button>
      </div>
    </div>
  );
}
