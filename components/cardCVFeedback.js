// /components/cardCVFeedback.js

import ReactMarkdown from 'react-markdown';

export default function CardCVFeedback({ feedback, secretUrl }) {
  if (!feedback) return null;
  return (
    <>
      <div style={{
        marginTop: '2rem',
        backgroundColor: '#fffef5',
        padding: '1.25rem',
        borderLeft: '4px solid #facc15',
        borderRadius: '6px',
        fontSize: '0.95rem',
        lineHeight: '1.6',
        color: '#1f2937'
      }}>
        <ReactMarkdown>{feedback}</ReactMarkdown>
      </div>
      {secretUrl && (
        <footer style={{ marginTop: '2rem', fontSize: '0.9rem', color: '#6b7280' }}>
          <p>Your dashboard URL:</p>
          <a href={secretUrl} style={{ color: '#b45309', textDecoration: 'underline' }}>
            {secretUrl}
          </a>
        </footer>
      )}
    </>
  );
}
