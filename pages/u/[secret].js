// pages/u/[secret].js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import FileUpload from '../../components/FileUpload';
import ExtractionPanel from '../../components/ExtractionPanel';
import { buildExtractionPrompt, buildCVFeedbackPrompt } from '../../lib/prompt-builder';

const JOB_FIELDS = [
  { key: 'job_title', label: 'Job Title' },
  { key: 'company_name', label: 'Company Name' },
  { key: 'hr_contact', label: 'HR Contact' },
  { key: 'keywords', label: 'Keywords' },
];
const TONES = ['Formal', 'Neutral', 'Friendly', 'Cocky'];

export default function DashboardPage() {
  const router = useRouter();
  const { secret } = router.query;
  const [user, setUser] = useState(null);
  const [pasteAd, setPasteAd] = useState('');
  const [jobMeta, setJobMeta] = useState({});
  const [useField, setUseField] = useState({});
  const [tone, setTone] = useState('Neutral');
  const [language, setLanguage] = useState('');
  const [outputType, setOutputType] = useState('both');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({ cv: '', cover: '' });

  // fetch user by secret
  useEffect(() => {
    if (!secret) return;
    fetch(`/api/users?secret=${secret}`)
      .then(res => res.json())
      .then(data => setUser({ email: data.email || '', tokens: data.tokens || 0 }))
      .catch(console.error);
  }, [secret]);

  // show loading until user data arrives
  if (user === null) {
    return <div className="p-4">Loading dashboard…</div>;
  }

  // extract job metadata
  const handleExtract = async () => {
    if (!pasteAd) return;
    const res = await fetch(`/api/extract-job-meta?secret=${secret}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: pasteAd }),
    });
    const data = await res.json();
    setJobMeta(data);
    setUseField(Object.fromEntries(Object.keys(data).map(k => [k, true])));
  };

  const handleToggleField = key => {
    setUseField(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // generate docs
  const handleGenerate = async () => {
    setLoading(true);
    const payload = {
      metadata: Object.fromEntries(
        Object.entries(jobMeta).filter(([k]) => useField[k])
      ),
      tone,
      language,
      outputType,
    };
    const res = await fetch(`/api/write-docs?secret=${secret}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const docs = await res.json();
    setResults({ cv: docs.cv, cover: docs.cover });
    setLoading(false);
  };

  return (
    <div className="min-h-screen p-6">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl">Dashboard</h1>
        <div>
          <span className="mr-4">{user.email.split('@')[0]}</span>
          <span>Tokens: {user.tokens}</span>
        </div>
      </header>

      {/* 1. Paste Job Ad */}
      <section className="mb-6">
        <h2 className="font-semibold mb-2">1. Paste Job Ad</h2>
        <ExtractionPanel onExtract={handleExtract} />
      </section>

      {/* 2. Review Job Metadata */}
      {Object.keys(jobMeta).length > 0 && (
        <section className="mb-6 border rounded p-4 bg-gray-50">
          <h2 className="font-semibold mb-2">2. Review Job Metadata</h2>
          {JOB_FIELDS.map(({ key, label }) => (
            <div key={key} className="flex items-center mb-2">
              <input
                type="checkbox"
                checked={!!useField[key]}
                onChange={() => handleToggleField(key)}
                className="mr-2"
              />
              <div>
                <div className="font-semibold">{label}</div>
                <div>{Array.isArray(jobMeta[key]) ? jobMeta[key].join(', ') : jobMeta[key]}</div>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* 3. Options & Generate */}
      <section className="mb-6">
        <h2 className="font-semibold mb-2">3. Options & Generate</h2>
        <div className="flex gap-4 mb-4">
          <div>
            <label>Tone</label>
            <select value={tone} onChange={e => setTone(e.target.value)}>
              {TONES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label>Language</label>
            <input type="text" placeholder="Auto" value={language} onChange={e => setLanguage(e.target.value)} />
          </div>
          <div>
            <label>Output</label>
            <select value={outputType} onChange={e => setOutputType(e.target.value)}>
              <option value="cv">CV</option>
              <option value="cover">Cover Letter</option>
              <option value="both">Both</option>
            </select>
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          {loading ? 'Generating...' : 'Generate Documents'}
        </button>
      </section>

      {/* 4. Display Results */}
      {(results.cv || results.cover) && (
        <section className="space-y-6">
          {results.cv && (
            <article className="border rounded p-4">
              <h3 className="font-bold mb-2">Generated CV</h3>
              <div dangerouslySetInnerHTML={{ __html: results.cv }} />
            </article>
          )}
          {results.cover && (
            <article className="border rounded p-4">
              <h3 className="font-bold mb-2">Generated Cover Letter</h3>
              <div dangerouslySetInnerHTML={{ __html: results.cover }} />
            </article>
          )}
        </section>
      )}

      {/* 5. File Upload Section */}
      <FileUpload secret={secret} />
    </div>
  );
}
