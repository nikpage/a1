// pages/u/[secret].js
import { useEffect, useState } from 'react';
import ExtractionPanel from '../../components/ExtractionPanel';
import { buildCVPrompt, buildCoverLetterPrompt } from '../../lib/prompt-builder';

export default function SecretPage() {
  const [userId, setUserId] = useState(null);
  const [secret, setSecret] = useState(null);
  const [cvMetadata, setCvMetadata] = useState(null);
  const [jobMetadata, setJobMetadata] = useState({});
  const [toggles, setToggles] = useState({});
  const [tone, setTone] = useState('neutral');
  const [outputType, setOutputType] = useState('both');
  const [result, setResult] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedSecret = sessionStorage.getItem('user_secret');
    if (!storedSecret) return;
    setSecret(storedSecret);

    fetch(`/api/users?secret=${storedSecret}`)
      .then(res => res.json())
      .then(user => {
        setUserId(user.id);
        return fetch(`/api/user-cvs?secret=${storedSecret}`);
      })
      .then(res => res.json())
      .then(cvs => {
        if (cvs.length > 0) {
          setCvMetadata(cvs[0].data); // Use latest saved CV metadata
        }
      });
  }, []);

  const handleExtract = (meta, toggleState) => {
    setJobMetadata(meta);
    setToggles(toggleState);
  };

  const handleGenerate = async () => {
    if (!cvMetadata) return;

    setLoading(true);

    const selectedJob = {};
    Object.entries(toggles).forEach(([key, active]) => {
      if (active) {
        if (key.startsWith('keywords_')) {
          const idx = parseInt(key.split('_')[1]);
          selectedJob.keywords = selectedJob.keywords || [];
          selectedJob.keywords.push(jobMetadata.keywords[idx]);
        } else {
          selectedJob[key] = jobMetadata[key];
        }
      }
    });

    const jobDetails = {
      ...selectedJob,
      keywords: selectedJob.keywords || [],
    };

    const docResults = {};

    try {
      if (outputType === 'cv' || outputType === 'both') {
        const prompt = buildCVPrompt(tone, jobDetails);
        const res = await fetch('/api/write-docs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metadata: jobDetails, cv: { data: cvMetadata }, tone, language: 'en', outputType: 'cv' }),
        });
        const data = await res.json();
        docResults.cv = data.cv;
      }

      if (outputType === 'cover' || outputType === 'both') {
        const prompt = buildCoverLetterPrompt(tone, jobDetails);
        const res = await fetch('/api/write-docs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metadata: jobDetails, cv: { data: cvMetadata }, tone, language: 'en', outputType: 'cover' }),
        });
        const data = await res.json();
        docResults.cover = data.cover;
      }

      setResult(docResults);
    } catch (err) {
      console.error('write-docs error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Document Generator</h1>

      <section>
        <ExtractionPanel onExtract={handleExtract} />
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-semibold">Tone</h2>
        <div className="flex gap-2 my-2">
          {['formal', 'neutral', 'casual', 'cocky'].map(t => (
            <button
              key={t}
              onClick={() => setTone(t)}
              className={`px-3 py-1 rounded ${tone === t ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            >
              {t}
            </button>
          ))}
        </div>

        <label className="block font-semibold mt-2">Document Type:</label>
        <select
          value={outputType}
          onChange={e => setOutputType(e.target.value)}
          className="mt-1 border rounded px-2 py-1"
        >
          <option value="cv">CV</option>
          <option value="cover">Cover Letter</option>
          <option value="both">Both</option>
        </select>
      </section>

      <section className="mt-4">
        <button
          onClick={handleGenerate}
          disabled={!cvMetadata || loading}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
        >
          {loading ? 'Generating...' : 'Generate Documents'}
        </button>
      </section>

      {result.cv && (
        <section className="mt-6">
          <h2 className="text-xl font-semibold mb-2">Generated CV</h2>
          <pre className="whitespace-pre-wrap bg-gray-100 p-4 rounded">
            {result.cv.choices?.[0]?.message?.content}
          </pre>
        </section>
      )}

      {result.cover && (
        <section className="mt-6">
          <h2 className="text-xl font-semibold mb-2">Generated Cover Letter</h2>
          <pre className="whitespace-pre-wrap bg-gray-100 p-4 rounded">
            {result.cover.choices?.[0]?.message?.content}
          </pre>
        </section>
      )}
    </div>
  );
}
