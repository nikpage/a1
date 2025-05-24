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

  const handleExtract = (data, newToggles) => {
    setCvData(data);
    setToggles(newToggles);
  };

  const handleGenerate = async (type) => {
    try {
      if (!cvData) return;

      const commonPayload = {
        metadata: cvData,
        tone,
        language: 'en',
      };

      if (type === 'cv' || type === 'cover') {
        const res = await fetch('/api/write-docs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...commonPayload, outputType: type }),
        });

        const result = await res.json();
        const content = type === 'cv' ? result.cv : result.cover;
        setFeedback(`${type.toUpperCase()}:\n\n${content}`);
      } else if (type === 'both') {
        const [cvRes, coverRes] = await Promise.all([
          fetch('/api/write-docs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...commonPayload, outputType: 'cv' }),
          }),
          fetch('/api/write-docs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...commonPayload, outputType: 'cover' }),
          }),
        ]);

        const cvResult = await cvRes.json();
        const coverResult = await coverRes.json();

        setFeedback(`
### CV
${cvResult.cv}

---

### Cover Letter
${coverResult.cover}
        `);
      }
    } catch (err) {
      console.error('Generation error:', err);
      setFeedback('❌ Failed to generate. Try again.');
    }
  };

  return (
    <div>
      <DashboardHeader secret={secret} />

      <ExtractionPanel onExtract={handleExtract} />

      {cvData && (
        <>
          <div>
            <strong>Select Tone:</strong><br />
            <button onClick={() => setTone('neutral')}>Neutral</button>
            <button onClick={() => setTone('formal')}>Formal</button>
            <button onClick={() => setTone('casual')}>Casual</button>
            <button onClick={() => setTone('cocky')}>Cocky</button>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <strong>Generate:</strong><br />
            <button onClick={() => handleGenerate('cv')}>CV</button>
            <button onClick={() => handleGenerate('cover')}>Cover Letter</button>
            <button onClick={() => handleGenerate('both')}>Both</button>
          </div>

          <div style={{ marginTop: '2rem' }}>
            <h3>Extracted Data</h3>
            <ul>
              {cvData.jobTitle && <li><strong>Job Title:</strong> {cvData.jobTitle}</li>}
              {cvData.company && <li><strong>Company:</strong> {cvData.company}</li>}
              {cvData.hrContact && <li><strong>HR Contact:</strong> {cvData.hrContact}</li>}
              {cvData.keywords && Array.isArray(cvData.keywords) && cvData.keywords.map((kw, index) => (
                <li key={index}><strong>Keyword {index + 1}:</strong> {kw}</li>
              ))}
            </ul>
          </div>
        </>
      )}

      {feedback && (
        <div dangerouslySetInnerHTML={{ __html: marked(feedback) }} />
      )}
    </div>
  );
}
