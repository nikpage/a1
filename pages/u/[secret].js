// pages/u/[secret].js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import FileUpload from '../../components/FileUpload';
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
  const [user, setUser] = useState({ email: '', tokens: 0 });
  const [pasteAd, setPasteAd] = useState('');
  const [jobMeta, setJobMeta] = useState({});
  const [useField, setUseField] = useState({});
  const [tone, setTone] = useState('Neutral');
  const [language, setLanguage] = useState('');
  const [outputType, setOutputType] = useState('both');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({ cv: '', cover: '' });

  // fetch user info by secret
  useEffect(() => {
    if (!secret) return;
    fetch(`/api/users?secret=${secret}`)
      .then(res => res.json())
      .then(data => setUser(data))
      .catch(console.error);
  }, [secret]);

  // extract job metadata
  const handleExtract = async () => {
    if (!pasteAd) return;
    const prompt = buildExtractionPrompt(pasteAd);
    const res = await fetch(`/api/extract-job-meta?secret=${secret}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const { metadata } = await res.json();
    setJobMeta(metadata);
    setUseField(Object.fromEntries(Object.keys(metadata).map(k => [k, true])));
  };

  const handleToggleField = key => {
    setUseField(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // generate docs
  const handleGenerate = async () => {
    setLoading(true);
    const selected = Object.entries(useField)
      .filter(([_, used]) => used)
      .reduce((acc, [k]) => ({ ...acc, [k]: jobMeta[k] }), {});
    const payload = { metadata: selected, tone, language: language || 'auto', output: outputType };
    const res = await fetch(`/api/write-docs?secret=${secret}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setResults({ cv: data.cv, cover: data.cover });
    setLoading(false);
  };

  if (!user.email) return <div className="p-4">Loading dashboard…</div>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="text-sm">
          <div>User: <strong>{user.email.split('@')[0]}</strong></div>
          <div>Tokens: <strong>{user.tokens}</strong></div>
        </div>
      </header>

      <section className="mb-6">
        <h2 className="font-semibold mb-2">1. Paste Job Ad</h2>
        <textarea
          rows={6}
          className="w-full border rounded p-2"
          placeholder="Paste job description here..."
          value={pasteAd}
          onChange={e => setPasteAd(e.target.value)}
        />
        <button
          onClick={handleExtract}
          className="mt-2 px-4 py-2 bg-green-600 text-white rounded"
        >Extract Metadata</button>
      </section>

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

      <section className="mb-6">
        <h2 className="font-semibold mb-2">3. Options</h2>
        <div className="flex gap-4 mb-4">
          <div>
            <label className="block mb-1 font-semibold">Tone</label>
            <select value={tone} onChange={e => setTone(e.target.value)} className="border rounded p-2">
              {TONES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block mb-1 font-semibold">Language</label>
            <input type="text" placeholder="Auto-detect" value={language} onChange={e => setLanguage(e.target.value)} className="border rounded p-2" />
          </div>
          <div>
            <label className="block mb-1 font-semibold">Output</label>
            <select value={outputType} onChange={e => setOutputType(e.target.value)} className="border rounded p-2">
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

      {(results.cv || results.cover) && (
        <section className="space-y-6">
          {results.cv && (
            <article className="border rounded p-4">
              <h3 className="font-bold mb-2">Generated CV</h3>
              <div className="prose" dangerouslySetInnerHTML={{ __html: results.cv }} />
            </article>
          )}
          {results.cover && (
            <article className="border rounded p-4">
              <h3 className="font-bold mb-2">Generated Cover Letter</h3>
              <div className="prose" dangerouslySetInnerHTML={{ __html: results.cover }} />
            </article>
          )}
        </section>
      )}
    </div>
  );
}
