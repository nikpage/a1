// /components/cardDocsView.js
import { useEffect, useState } from 'react';

export default function CardDocsView({ userId }) {
  const [cvContent, setCvContent] = useState('');
  const [coverLetterContent, setCoverLetterContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchDocs = async () => {
      try {
        const res = await fetch(`/api/user-docs?userId=${userId}`);
        const data = await res.json();

        if (data) {
          setCvContent(data.cv || '');
          setCoverLetterContent(data.coverLetter || '');
        } else {
          console.error('Invalid document data:', data);
        }
      } catch (err) {
        console.error('Error fetching docs:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDocs();
  }, [userId]);

  if (!userId) {
    return <p>User not loaded.</p>;
  }

  if (loading) {
    return <p>Loading documents...</p>;
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h2>CV Document</h2>
      {cvContent ? (
        <div style={{ border: '1px solid #ccc', padding: '1rem', marginBottom: '1rem' }}>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{cvContent}</pre>
        </div>
      ) : (
        <p>No CV document found.</p>
      )}

      <h2>Cover Letter Document</h2>
      {coverLetterContent ? (
        <div style={{ border: '1px solid #ccc', padding: '1rem' }}>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{coverLetterContent}</pre>
        </div>
      ) : (
        <p>No cover letter found.</p>
      )}
    </div>
  );
}
