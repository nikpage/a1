// pages/u/[secret].js
import { useState } from 'react';
import { useRouter } from 'next/router';
import { marked } from 'marked';
import ExtractionPanel from '../../components/ExtractionPanel';
import DashboardHeader from '../../components/DashboardHeader';

export default function SecretPage() {
  const router = useRouter();
  const { secret } = router.query;

  const [feedback, setFeedback] = useState('');
  const [cvData, setCvData] = useState(null);
  const [toggles, setToggles] = useState({});
  const [tone, setTone] = useState('neutral');
  const [skipped, setSkipped] = useState(false);

  const handleExtract = (data, newToggles) => {
    setCvData({ ...data, secret });
    setToggles(newToggles);
  };

  const handleSkip = () => {
    setCvData({ secret });
    setSkipped(true);
  };

  const handleGenerate = async (type) => {
    try {
      if (!cvData) return;

      const res = await fetch('/api/write-docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata: { ...cvData, secret },
          tone,
          language: 'en',
          outputType: type,
        }),
      });

      const result = await res.json();
      if (type === 'cv') {
        setFeedback(`# CV\n\n${result.cv}`);
      } else if (type === 'cover') {
        setFeedback(`# Cover Letter\n\n${result.cover}`);
      } else if (type === 'both') {
        setFeedback(`# CV\n\n${result.cv}\n\n---\n\n# Cover Letter\n\n${result.cover}`);
      }
    } catch (err) {
      console.error('Generation error:', err);
      setFeedback('❌ Failed to generate.');
    }
  };

  const showGeneration = cvData || skipped;

  const buttonStyle = (active) => ({
    backgroundColor: active ? '#10b981' : '#e5e7eb',
    color: active ? 'white' : '#111827',
    padding: '0.5rem 1rem',
    marginRight: '0.5rem',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
  });

  return (
    <div>
      <DashboardHeader secret={secret} />

      {!showGeneration && (
        <>
          <ExtractionPanel onExtract={handleExtract} />
          <button onClick={handleSkip}>Skip Job Matching</button>
        </>
      )}

      {showGeneration && (
        <>
          <div style={{ marginTop: '1rem' }}>
            <strong>Select Tone:</strong><br />
            {['neutral', 'formal', 'casual', 'cocky'].map((t) => (
              <button
                key={t}
                onClick={() => setTone(t)}
                style={buttonStyle(tone === t)}
              >
                {t}
              </button>
            ))}
          </div>

          <div style={{ marginTop: '1rem' }}>
            <strong>Generate:</strong><br />
            <button style={buttonStyle(false)} onClick={() => handleGenerate('cv')}>CV</button>
            <button style={buttonStyle(false)} onClick={() => handleGenerate('cover')}>Cover Letter</button>
            <button style={buttonStyle(true)} onClick={() => handleGenerate('both')}>Both</button>
          </div>
        </>
      )}

      {feedback && (
        <div style={{ marginTop: '2rem' }} dangerouslySetInnerHTML={{ __html: marked(feedback) }} />
      )}
    </div>
  );
}
