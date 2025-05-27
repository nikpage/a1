// File: /pages/index.js
import { useEffect, useState } from 'react';
import FileUpload from '../components/FileUpload';
import { languages, markets } from '../lib/market-config';
import ReactMarkdown from 'react-markdown';
import { franc } from 'franc';

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
  const [selectedLang, setSelectedLang] = useState('en');
  const [selectedMarket, setSelectedMarket] = useState('eu');

  useEffect(() => {
    const existing = sessionStorage.getItem('user_secret');
    if (existing) {
      fetch(`/api/users?secret=${existing}`)
        .then(res => res.json())
        .then(data => {
          setUserId(data.id);
          setSecretUrl(`${window.location.origin}/u/${existing}`);
        });
    } else {
      fetch('/api/users', { method: 'POST' })
        .then(res => res.json())
        .then(({ userId: id, secret }) => {
          setUserId(id);
          setSecretUrl(`${window.location.origin}/u/${secret}`);
          sessionStorage.setItem('user_secret', secret);
        });
    }
  }, []);

  const detectLanguageCode = (text) => {
    const lang3 = franc(text, { minLength: 20 });
    if (lang3 === 'und') return 'en';
    const match = iso6393.find(lang => lang.iso6393 === lang3);
    return match?.iso6391 || 'en';
  };

  const handleUploadResult = ({ metadata, rawText }) => {
    const detectedLang = detectLanguageCode(rawText || '');
    setSelectedLang(languages.some(l => l.code === detectedLang) ? detectedLang : 'en');

    setCvMetadata(metadata);
    setSelectedMarket('eu');

    const usage = {};
    METADATA_FIELDS.forEach(({ key }) => {
      if (metadata[key] && (Array.isArray(metadata[key]) ? metadata[key].length : true)) {
        usage[key] = true;
      }
    });
    setFieldUsage(usage);
    setKeywords([...(metadata.skills || []), ...(metadata.industries || [])].slice(0, 8));
  };


  const handleFieldChange = (key, value) => {
    setCvMetadata(prev => ({ ...prev, [key]: value }));
  };

  const handleToggleUse = key => {
    setFieldUsage(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveMetadata = async e => {
    e.preventDefault();
    const res = await fetch('/api/review-cv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        tone: 'neutral',
        targetIndustry: selectedMarket,
        country: selectedLang,
      }),
    });
    const { feedback: fb } = await res.json();
    const text = typeof fb === 'string'
      ? fb
      : fb.choices?.[0]?.message?.content || JSON.stringify(fb);
    setFeedback(text);
  };

  const fieldsToShow = METADATA_FIELDS.filter(({ key }) => {
    const val = cvMetadata[key];
    return val && (Array.isArray(val) ? val.length > 0 : true);
  });

  const selectedCount = Object.values(fieldUsage).filter(Boolean).length;

  if (!userId) return <div className="container">Loading...</div>;
  const orderedLangs = [...languages.filter(l => l.code !== 'en'), languages.find(l => l.code === 'en')];

  return (
    <div className="container">
      <h1>CV Feedback Assistant</h1>

      <FileUpload userId={userId} onUpload={handleUploadResult} />

      {fieldsToShow.length > 0 && (
        <section style={{ marginTop: '2rem' }}>
          <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem' }}>
            <div>
              <label style={{ fontWeight: 600 }}>Output Language:</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {orderedLangs.map(({ code, name }) => (
                  <label key={code} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <input
                      type="radio"
                      name="lang"
                      value={code}
                      checked={selectedLang === code}
                      onChange={() => {
                        setSelectedLang(code);
                        setCvMetadata(prev => ({ ...prev, languages: [code] }));
                      }}
                    />
                    {name}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontWeight: 600 }}>Target Market:</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {markets.map(({ code, name }) => (
                  <label key={code} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <input
                      type="radio"
                      name="market"
                      value={code}
                      checked={selectedMarket === code}
                      onChange={() => setSelectedMarket(code)}
                    />
                    {name}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <h2>Review Extracted Metadata</h2>

          {keywords.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <strong>Keywords:</strong>
              <ul style={{ listStyle: 'none', paddingLeft: 0, marginTop: '0.5rem' }}>
                {keywords.map((kw, i) => (
                  <li key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={fieldUsage[`keyword_${i}`] ?? true}
                      onChange={() =>
                        setFieldUsage(prev => ({
                          ...prev,
                          [`keyword_${i}`]: !prev[`keyword_${i}`],
                        }))
                      }
                    />
                    <input
                      type="text"
                      value={kw}
                      onChange={e => {
                        const newKeywords = [...keywords];
                        newKeywords[i] = e.target.value;
                        setKeywords(newKeywords);
                      }}
                      style={{ flex: 1, padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px' }}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form onSubmit={handleSaveMetadata}>
            {fieldsToShow.map(({ key, label }) => (
              <div key={key} style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <input
                  type="checkbox"
                  checked={fieldUsage[key] || false}
                  onChange={() => handleToggleUse(key)}
                  style={{ marginTop: '0.5rem' }}
                />
                <div style={{ flex: 1 }}>
                  <label style={{ fontWeight: '600', fontSize: '0.9rem' }}>{label}</label>
                  <textarea
                    value={cvMetadata[key] || ''}
                    onChange={e => handleFieldChange(key, e.target.value)}
                    rows={Math.min(6, (typeof cvMetadata[key] === 'string' ? cvMetadata[key].split('\n').length : 1))}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      minHeight: '3rem',
                      resize: 'vertical',
                    }}
                  />
                </div>
              </div>
            ))}
            {selectedCount > 0 && (
              <button type="submit">Review CV</button>
            )}
          </form>

          {feedback && (
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
          )}
        </section>
      )}

      {secretUrl && (
        <footer style={{ marginTop: '2rem', fontSize: '0.9rem', color: '#6b7280' }}>
          <p>Your dashboard URL:</p>
          <a href={secretUrl} style={{ color: '#b45309', textDecoration: 'underline' }}>
            {secretUrl}
          </a>
        </footer>
      )}
    </div>
  );
}
