// pages/index.js
import { useEffect, useState } from 'react';
import FileUpload from '../components/FileUpload';
import { buildCVFeedbackPrompt } from '../lib/prompt-builder';

const METADATA_FIELDS = [
  { key: 'current_role', label: 'Current role' },
  { key: 'seniority', label: 'Seniority' },
  { key: 'primary_company', label: 'Most recent company' },
  { key: 'career_arcs_summary', label: 'Career arcs summary' },
  { key: 'parallel_experiences_summary', label: 'Parallel experiences summary' },
  { key: 'years_experience', label: 'Years of experience' },
  { key: 'industries', label: 'Industries' },
  { key: 'education', label: 'Education' },
  { key: 'skills', label: 'Skills' },
  { key: 'languages', label: 'Languages' },
  { key: 'key_achievements', label: 'Key achievements' },
];

export default function HomePage() {
  const [userId, setUserId] = useState(null);
  const [secretUrl, setSecretUrl] = useState(null);
  const [cvMetadata, setCvMetadata] = useState({});
  const [fieldUsage, setFieldUsage] = useState({});
  const [keywords, setKeywords] = useState([]);
  const [feedback, setFeedback] = useState('');

  // Get or create the user and dashboard URL
  useEffect(() => {
    fetch('/api/users', { method: 'POST' })
      .then(res => res.json())
      .then(({ userId, secret }) => {
        setUserId(userId);
        setSecretUrl(`${window.location.origin}/u/${secret}`);
      });
  }, []);

  // When a CV is uploaded, initialize metadata and keywords
  const handleUploadResult = ({ metadata }) => {
    setCvMetadata(metadata);
    const initialUsage = METADATA_FIELDS.reduce((acc, { key }) => {
      const val = metadata[key];
      if (val && (Array.isArray(val) ? val.length > 0 : true)) acc[key] = true;
      return acc;
    }, {});
    setFieldUsage(initialUsage);

    const kw = [
      ...(metadata.skills || []),
      ...(metadata.industries || []),
    ].slice(0, 8);
    setKeywords(kw);
  };

  // Update a metadata field
  const handleFieldChange = (key, value) => {
    setCvMetadata(prev => ({ ...prev, [key]: value }));
  };

  // Toggle including a metadata field
  const handleToggleUse = key => {
    setFieldUsage(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Build prompt, send to AI, and extract plain text feedback
  const handleSaveMetadata = async e => {
    e.preventDefault();
    const selected = Object.entries(fieldUsage)
      .filter(([_, used]) => used)
      .reduce((acc, [key]) => ({ ...acc, [key]: cvMetadata[key] }), {});

    const prompt = buildCVFeedbackPrompt({ metadata: selected, parsedCV: cvMetadata });
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metadata: selected, cvBody: cvMetadata, prompt }),
    });
    const { feedback: fb } = await res.json();

    let text = '';
    if (typeof fb === 'string') {
      text = fb;
    } else if (fb.choices?.[0]?.message?.content) {
      text = fb.choices[0].message.content;
    } else {
      text = JSON.stringify(fb);
    }
    setFeedback(text);
  };

  if (!userId) return <div className="p-4">Initializing...</div>;

  const fieldsToShow = METADATA_FIELDS.filter(({ key }) => {
    const val = cvMetadata[key];
    return val && (Array.isArray(val) ? val.length > 0 : true);
  });
  const selectedCount = Object.values(fieldUsage).filter(Boolean).length;

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">CV AI MVP</h1>
      <FileUpload userId={userId} onUpload={handleUploadResult} />

      {fieldsToShow.length > 0 && (
        <section className="mt-6 p-4 border rounded bg-gray-50 shadow">
          <h2 className="text-xl mb-2 font-bold">Review Extracted Metadata</h2>

          {keywords.length > 0 && (
            <div className="mb-4">
              <strong>Keywords:</strong>{' '}
              {keywords.map((kw, i) => (
                <span key={i} className="inline-block px-2 py-1 bg-blue-100 rounded text-xs mr-1">
                  {kw}
                </span>
              ))}
            </div>
          )}

          <form onSubmit={handleSaveMetadata}>
            {fieldsToShow.map(({ key, label }) => (
              <div key={key} className="mb-3 flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={fieldUsage[key] || false}
                  onChange={() => handleToggleUse(key)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <label className="block font-semibold mb-1">{label}</label>
                  {Array.isArray(cvMetadata[key]) ? (
                    <textarea
                      value={cvMetadata[key].join(', ')}
                      onChange={e => handleFieldChange(key, e.target.value.split(',').map(s => s.trim()))}
                      rows={2}
                      className="w-full border rounded p-2"
                    />
                  ) : (
                    <input
                      type="text"
                      value={cvMetadata[key] || ''}
                      onChange={e => handleFieldChange(key, e.target.value)}
                      className="w-full border rounded p-2"
                    />
                  )}
                </div>
              </div>
            ))}

            {selectedCount > 0 && (
              <button type="submit" className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">
                Review CV
              </button>
            )}
          </form>

          {feedback && (
            <article className="mt-6 p-4 bg-green-50 border-l-4 border-green-400">
              <h3 className="font-bold mb-2">CV Feedback</h3>
              <div className="prose">
                {feedback.split('\n').map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))}
              </div>
            </article>
          )}
        </section>
      )}

      {secretUrl && (
        <footer className="mt-6 text-sm">
          <p>Your dashboard URL:</p>
          <a href={secretUrl} className="text-blue-600 break-all">
            {secretUrl}
          </a>
        </footer>
      )}
    </div>
  );
}
