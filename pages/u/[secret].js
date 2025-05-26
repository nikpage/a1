// pages/u/[secret].js

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import ExtractionPanel from '../../components/ExtractionPanel';
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

  useEffect(() => {
    if (!secret) return;

    const fetchUser = async () => {
      const res = await fetch(`/api/users?secret=${secret}`);
      const user = await res.json();
      if (user?.id) setUserId(user.id);
    };
    fetchUser();
  }, [secret]);

  const handleExtract = (data) => {
    setCvData(data);
  };

  const handleGenerate = async (type) => {
    try {
      if (!cvData || !userId) return;

      const commonPayload = {
        userId,
        metadata: cvData,
        tone,
        language: 'en',
        secret,
        coverLetterData: cvData,
      };

      if (type === 'cv' || type === 'cover') {
        const res = await fetch('/api/write-docs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...commonPayload, outputType: type }),
        });

        const result = await res.json();
        const content = type === 'cv'
          ? result?.cv?.choices?.[0]?.message?.content
          : result?.coverLetter?.choices?.[0]?.message?.content;

        if (type === 'cv') setCvContent(content || '');
        else setCoverContent(content || '');

        setFeedbackReady(true);
      }

      if (type === 'both') {
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

        setCvContent(cvResult?.cv?.choices?.[0]?.message?.content?.trim() || '');
        setCoverContent(coverResult?.coverLetter?.choices?.[0]?.message?.content?.trim() || '');
        setFeedbackReady(true);
      }
    } catch (err) {
      console.error('Generation error:', err);
      setFeedbackReady(false);
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <DashboardHeader secret={secret} />
      <ExtractionPanel onExtract={handleExtract} />

      {cvData && (
        <>
          <h2 style={{ marginTop: '2rem' }}>Generate Documents</h2>

          <div style={{ marginBottom: '1rem' }}>
            <label>Select Tone:</label>
            {['neutral', 'formal', 'casual', 'cocky'].map((t) => (
              <button
                key={t}
                style={{ marginLeft: '0.5rem' }}
                onClick={() => setTone(t)}
                className={tone === t ? 'selected' : ''}
              >
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div style={{ marginTop: '1rem' }}>
            <button onClick={() => handleGenerate('cv')}>CV</button>
            <button onClick={() => handleGenerate('cover')}>Cover Letter</button>
            <button onClick={() => handleGenerate('both')}>Both</button>
          </div>
        </>
      )}

      {feedbackReady && (
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
