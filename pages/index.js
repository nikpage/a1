import { useEffect, useState } from 'react';
import FileUpload from '../components/FileUpload';
import { languages } from '../lib/market-config';
import ReactMarkdown from 'react-markdown';
import { franc } from 'franc';
import Header from '../components/Header';

const METADATA_FIELDS = [
  { key: 'current_role', label: 'Current role' },
  { key: 'seniority', label: 'Seniority' },
  { key: 'primary_company', label: 'Most recent company' },
  { key: 'career_arcs_summary', label: 'Career arcs summary' },
  { key: 'parallel_experiences_summary', label: 'Parallel experiences summary' },
  { key: 'years_experience', label: 'Years of experience' },
  { key: 'industries', label: 'Industries' },
  { key: 'education', label: 'Education' },
  { key: 'skills', label: 'Skills/Keywords' },
  { key: 'languages', label: 'Languages' },
  { key: 'key_achievements', label: 'Key achievements' },
  { key: 'user_name', label: 'Name' },
  { key: 'contact_info', label: 'Contact Info' },
];

export default function HomePage() {
  const [userId, setUserId] = useState(null);
  const [secretUrl, setSecretUrl] = useState(null);
  const [cvMetadata, setCvMetadata] = useState({});
  const [fieldUsage, setFieldUsage] = useState({});
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
    return languages.find(l => l.iso6393 === lang3)?.code || 'en';
  };

  const handleUploadResult = ({ metadata, rawText }) => {
    const detectedLang = detectLanguageCode(rawText || '');
    setSelectedLang(languages.some(l => l.code === detectedLang) ? detectedLang : 'en');
    setCvMetadata(metadata);
    setSelectedMarket('eu');

    const usage = {};
    METADATA_FIELDS.forEach(({ key }) => {
      const val = metadata[key];
      if (val && (Array.isArray(val) ? val.length : true)) {
        usage[key] = true;
      }
    });
    for (let i = 0; i < 30; i++) {
      usage[`skills_${i}`] = metadata.skills?.[i] ? true : false;
      usage[`industries_${i}`] = metadata.industries?.[i] ? true : false;
    }
    setFieldUsage(usage);
  };

  const handleFieldChange = (key, value, index = null) => {
    setCvMetadata(prev => {
      if (index !== null) {
        const updatedList = [...(prev[key] || [])];
        updatedList[index] = value;
        return { ...prev, [key]: updatedList };
      }
      return { ...prev, [key]: value };
    });
  };

  const handleToggleUse = (key, index = null) => {
    const toggleKey = index !== null ? `${key}_${index}` : key;
    setFieldUsage(prev => ({ ...prev, [toggleKey]: !prev[toggleKey] }));
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
        metadata: cvMetadata
      }),
    });
    const { feedback: fb } = await res.json();
    const text = typeof fb === 'string'
      ? fb
      : fb.choices?.[0]?.message?.content || JSON.stringify(fb);
    setFeedback(text);

    await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        data: cvMetadata,
        feedback: text
      }),
    });
  };

  const autoExpand = (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  if (!userId) return <div>Loading...</div>;

  if (!cvMetadata || Object.keys(cvMetadata).length === 0) {
    return (
      <>
        <Header />
        <div className="container">
          <h1>CV Feedback Assistant</h1>
          <FileUpload userId={userId} onUpload={handleUploadResult} />
        </div>
      </>
    );
  }

  // 2. After upload, show meta editing. Feedback/dashboard only after feedback exists.
  return (
    <div className="container">

      {/* Top meta in two-column grid, all fields editable */}
      <div style={{ margin: '2rem 0 2rem 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', rowGap: '0.75rem', alignItems: 'start' }}>
          <div style={{ fontWeight: 'bold' }}>Name:</div>
          <input
            type="text"
            value={cvMetadata.name || ""}
            onChange={e => handleFieldChange('name', e.target.value)}

            style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', width: '100%' }}
            placeholder="Enter name"
            autoComplete="off"
          />

          <div style={{ fontWeight: 'bold' }}>Phone:</div>
          <input
            type="text"
            value={cvMetadata.phone || ""}
            onChange={e => handleFieldChange('phone', e.target.value)}
            style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', width: '100%' }}
            placeholder="Enter phone"
            autoComplete="off"
          />

          <div style={{ fontWeight: 'bold' }}>Email:</div>
          <input
            type="text"
            value={cvMetadata.email || ""}
            onChange={e => handleFieldChange('email', e.target.value)}
            style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', width: '100%' }}
            placeholder="Enter email"
            autoComplete="off"
          />

          <div style={{ fontWeight: 'bold' }}>Languages:</div>
          <input
            type="text"
            value={Array.isArray(cvMetadata.languages) ? cvMetadata.languages.join(', ') : (cvMetadata.languages || "")}
            onChange={e => handleFieldChange('languages', e.target.value.split(',').map(v => v.trim()))}
            style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', width: '100%' }}
            placeholder="English, Czech, etc."
            autoComplete="off"
          />

          <div style={{ fontWeight: 'bold' }}>Years Experience:</div>
          <input
            type="text"
            value={cvMetadata.years_experience || ""}
            onChange={e => handleFieldChange('years_experience', e.target.value)}
            style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', width: '100%' }}
            placeholder="e.g. 5"
            autoComplete="off"
          />

          <div style={{ fontWeight: 'bold' }}>Seniority:</div>
          <input
            type="text"
            value={cvMetadata.seniority || ""}
            onChange={e => handleFieldChange('seniority', e.target.value)}
            style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', width: '100%' }}
            placeholder="e.g. Senior"
            autoComplete="off"
          />

          <div style={{ fontWeight: 'bold' }}>Current Role:</div>
          <input
            type="text"
            value={cvMetadata.current_role || ""}
            onChange={e => handleFieldChange('current_role', e.target.value)}
            style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', width: '100%' }}
            placeholder="e.g. UX Lead"
            autoComplete="off"
          />

          <div style={{ fontWeight: 'bold', marginTop: '1.5rem', fontSize: '1.1em' }}>Employment Gaps (6+ months):</div>
          <div style={{ marginTop: '1.5rem' }}>
            {Array.isArray(cvMetadata.employment_gaps) && cvMetadata.employment_gaps.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: '1.5em' }}>
                {cvMetadata.employment_gaps.map((gap, i) => (
                  <li key={i}>
                    {gap.start} &ndash; {gap.end} ({gap.months} months)
                  </li>
                ))}
              </ul>
            ) : (
              <span>None Found</span>
            )}
          </div>
        </div>
      </div>

      {/* Certifications */}
      {cvMetadata.certifications?.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <h3>Certifications</h3>
          {(Array.isArray(cvMetadata.certifications) ? cvMetadata.certifications : [cvMetadata.certifications]).map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={fieldUsage[`certifications_${i}`] ?? true}
                onChange={() => handleToggleUse('certifications', i)}
              />
              <input
                type="text"
                value={item}
                onChange={e => handleFieldChange('certifications', e.target.value, i)}
                style={{ flex: 1, padding: '0.3rem', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
          ))}
        </div>
      )}

      {['key_achievements'].map(section => (
        cvMetadata[section]?.length > 0 && (
          <div key={section} style={{ marginBottom: '1rem' }}>
            <h3>{section.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h3>
            {(Array.isArray(cvMetadata[section]) ? cvMetadata[section] : [cvMetadata[section]]).map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={fieldUsage[`${section}_${i}`] ?? true}
                  onChange={() => handleToggleUse(section, i)}
                />
                <input
                  type="text"
                  value={item}
                  onChange={e => handleFieldChange(section, e.target.value, i)}
                  style={{ flex: 1, padding: '0.3rem', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </div>
            ))}
          </div>
        )
      ))}

      {['career_arcs_summary', 'parallel_experiences_summary'].map(section => (
        cvMetadata[section] && (
          <div key={section} style={{ marginBottom: '1rem' }}>
            <h3>{section.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h3>
            <textarea
              value={cvMetadata[section]}
              onChange={e => handleFieldChange(section, e.target.value)}
              onInput={autoExpand}
              style={{
                width: '100%',
                padding: '0.3rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                minHeight: '3rem',
                overflow: 'hidden'
              }}
            />
          </div>
        )
      ))}

      {/* Industries: show only the number of inferred industries */}
      <div style={{ marginBottom: '1rem' }}>
        <h3>Industries</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
          {(cvMetadata.industries || []).map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={fieldUsage[`industries_${i}`] ?? false}
                onChange={() => handleToggleUse('industries', i)}
              />
              <input
                type="text"
                value={item || ''}
                onChange={e => handleFieldChange('industries', e.target.value, i)}
                style={{
                  flex: 1,
                  padding: '0.3rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Places */}
      {cvMetadata.places?.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <h3>Places</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            {cvMetadata.places.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={fieldUsage[`places_${i}`] ?? true}
                  onChange={() => handleToggleUse('places', i)}
                />
                <input
                  type="text"
                  value={item}
                  onChange={e => handleFieldChange('places', e.target.value, i)}
                  style={{
                    flex: 1,
                    padding: '0.3rem',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skills: always 30 fields */}
      <div style={{ marginBottom: '1rem' }}>
        <h3>Skills</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={fieldUsage[`skills_${i}`] ?? false}
                onChange={() => handleToggleUse('skills', i)}
              />
              <input
                type="text"
                value={cvMetadata.skills?.[i] || ''}
                onChange={e => handleFieldChange('skills', e.target.value, i)}
                style={{
                  flex: 1,
                  padding: '0.3rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSaveMetadata}>
        <button type="submit">Review CV</button>
      </form>

      {/* Feedback + dashboard link: ONLY after feedback */}
      {feedback && (
        <>
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
          {secretUrl && (
            <footer style={{ marginTop: '2rem', fontSize: '0.9rem', color: '#6b7280' }}>
              <p>Your dashboard URL:</p>
              <a href={secretUrl} style={{ color: '#b45309', textDecoration: 'underline' }}>
                {secretUrl}
              </a>
            </footer>
          )}
        </>
      )}
    </div>
  );
}
