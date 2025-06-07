// pages/[secret].js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import ExtractionPanel from '../../components/cardJobMeta';
import DashboardHeader from '../../components/DashboardHeader';
import DocTabs from '../../components/DocTabs';

export default function SecretPage() {
  const router = useRouter();
  const { secret } = router.query;

  const [userId, setUserId] = useState(null);
  const [cvData, setCvData] = useState(null);
  const [tone, setTone] = useState('neutral');
  const [cvContent, setCvContent] = useState('');
  const [coverContent, setCoverContent] = useState('');
  const [feedbackReady, setFeedbackReady] = useState(false);
  const [rewrittenContent, setRewrittenContent] = useState({
    'Professional Summary': '',
    'Core Skills': []
  });

  useEffect(() => {
    if (!secret) return;

    const fetchUser = async () => {
      try {
        const res = await fetch(`/api/users?secret=${secret}`);
        const user = await res.json();

        if (user?.id && typeof user.id === 'string' && user.id.length === 36) {
          setUserId(user.id);
        } else if (user?.userId && typeof user.userId === 'string' && user.userId.length === 36) {
          setUserId(user.userId);
        } else {
          console.error('Invalid userId from /api/users:', user);
          setUserId(null);
        }
      } catch (err) {
        console.error('Error fetching userId:', err);
        setUserId(null);
      }
    };
    fetchUser();
  }, [secret]);

  const handleMetaReady = async (meta) => {
    setCvData(meta);
    if (meta.professionalSummary) {
      setRewrittenContent(prev => ({
        ...prev,
        'Professional Summary': meta.professionalSummary,
        'Core Skills': meta.coreSkills || []
      }));
    }
    sessionStorage.setItem('cvData', JSON.stringify(meta));
    if (userId) {
      sessionStorage.setItem('userId', userId);
    }
    sessionStorage.setItem('hiddenStuffKey', 'someDefaultValue');

    if (userId && meta) {
      try {
        const saveRes = await fetch('/api/saveJobMetadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
             userId: userId,
             data: meta,
             timestamp: new Date().toISOString(),
          }),
        });

        if (!saveRes.ok) {
          const errorText = await saveRes.text();
          throw new Error(`Save failed in handleMetaReady: ${errorText}`);
        }
        console.log('Extracted metadata saved successfully via handleMetaReady.');
      } catch (err) {
        console.error('Error saving extracted metadata in handleMetaReady:', err);
      }
    } else {
      console.warn("Skipping save in handleMetaReady: userId or meta missing.");
    }
  };

  const handleGenerate = async (type) => {
    setCvContent('');
    setCoverContent('');
    setFeedbackReady(false);

    if (!cvData || !userId) {
      alert('Missing userId or CV data!');
      return;
    }

    const payload = {
      userId,
      jobMetadata: cvData,
      timestamp: new Date().toISOString(),
      hiddenStuff: sessionStorage.getItem('hiddenStuffKey'),
      tone,
      language: 'en',
      secret,
      coverLetterData: cvData,
      rewrittenContent
    };

    try {
      if (type === 'both') {
        const res = await fetch('/api/write-docs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, outputType: 'both' }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setCvContent(data.cv || '');
        setCoverContent(data.coverLetter || '');
      } else if (type === 'cv') {
        const res = await fetch('/api/write-docs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, outputType: 'cv' }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setCvContent(data.cv || '');
      } else if (type === 'cover') {
        const res = await fetch('/api/write-docs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, outputType: 'cover-letter' }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setCoverContent(data.coverLetter || '');
      }

      const saveRes = await fetch('/api/saveJobMetadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          data: cvData,
          timestamp: new Date().toISOString(),
          hiddenStuff: sessionStorage.getItem('hiddenStuffKey'),
        }),
      });

      if (!saveRes.ok) {
        const errText = await saveRes.text();
        console.error('Failed to save job metadata:', errText);
        alert('Failed to save metadata. Check console.');
        setFeedbackReady(false);
        return;
      }

      console.log('Metadata saved successfully.');
      setFeedbackReady(true);

    } catch (err) {
      console.error('Error during generate or save:', err);
      alert('Error during generation or save. Check console.');
      setFeedbackReady(false);
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <DashboardHeader secret={secret} />

      <ExtractionPanel userId={userId} onExtract={handleMetaReady} />

      {cvData && (
        <>
          <h2 style={{ marginTop: '2rem' }}>Generate Documents</h2>

          <div style={{ marginBottom: '1rem' }}>
            <label>Select Tone:</label>
            {['neutral', 'formal', 'casual', 'cocky'].map((t) => (
              <button
                key={t}
                style={{ marginLeft: '0.5rem', fontWeight: tone === t ? 'bold' : 'normal' }}
                onClick={() => setTone(t)}
              >
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div style={{ marginTop: '1rem' }}>
            <button onClick={() => handleGenerate('cv')} >CV</button>
            <button onClick={() => handleGenerate('cover')} style={{ marginLeft: '0.5rem' }}>Cover Letter</button>
            <button onClick={() => handleGenerate('both')} style={{ marginLeft: '0.5rem' }}>Both</button>
          </div>
        </>
      )}

      {feedbackReady && (cvContent || coverContent) && (
        <DocTabs
          cv={cvContent}
          cover={coverContent}
          onEdit={(type, html) =>
            console.log(`Edited ${type.toUpperCase()} Document:`, html)
          }
        />
      )}
    </div>
  );
}
