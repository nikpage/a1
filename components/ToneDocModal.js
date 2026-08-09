// components/ToneDocModal.js
import BaseModal from './BaseModal';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function ToneDocModal({ onClose, onSubmit }) {
  const { t } = useTranslation('toneDocModal');
  const [tone, setTone] = useState('formal');
  const [types, setTypes] = useState({ cv: true, coverLetter: true });
  const [tweak, setTweak] = useState('');
  // Output language for THIS application. 'auto' keeps the historic behaviour
  // (write in the master CV's own language); an explicit choice lets an English
  // master CV produce a Czech application, which is the whole point.
  const [language, setLanguage] = useState('auto');

  // The server expects 'cv' / 'cover'; the UI state uses 'coverLetter' as its key.
  const keyToType = { cv: 'cv', coverLetter: 'cover' };

  const handleGenerate = () => {
    const selected = Object.entries(types)
      .filter(([_, checked]) => checked)
      .map(([key]) => keyToType[key] || key);

    if (selected.length === 0) {
      alert(t('alertNoSelection'));
      return;
    }

    onSubmit({ tone, selected, tweak, language });
  };

  const toneOptions = ['formal', 'friendly', 'enthusiastic', 'cocky'];
  // Values match prompts/language.js GENERATION_LANGUAGES; the server coerces
  // anything it doesn't recognise back to 'auto'.
  const languageOptions = [['auto', 'langAuto'], ['en', 'langEn'], ['cs', 'langCs']];

  return (
    <BaseModal onClose={onClose}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          {t('chooseTone')}
        </h2>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {toneOptions.map(opt => (
            <button
              key={opt}
              type="button"
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: '1px solid #ccc',
                backgroundColor: tone === opt ? '#3b82f6' : '#fff',
                color: tone === opt ? 'white' : 'black',
                cursor: 'pointer'
              }}
              onClick={() => setTone(opt)}
            >
              {t(opt)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          {t('selectDocType')}
        </h2>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {['cv', 'coverLetter'].map(doc => (
            <label key={doc} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={types[doc]}
                onChange={() => setTypes(prev => ({ ...prev, [doc]: !prev[doc] }))}
              />
              {t(doc)}
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          {t('chooseLanguage')}
        </h2>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {languageOptions.map(([value, labelKey]) => (
            <button
              key={value}
              type="button"
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: '1px solid #ccc',
                backgroundColor: language === value ? '#3b82f6' : '#fff',
                color: language === value ? 'white' : 'black',
                cursor: 'pointer'
              }}
              onClick={() => setLanguage(value)}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          {t('tweakHeading')}
        </h2>
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem' }}>
          {t('tweakHint')}
        </p>
        <textarea
          value={tweak}
          onChange={e => setTweak(e.target.value)}
          placeholder={t('tweakPlaceholder')}
          rows={3}
          style={{
            width: '100%',
            padding: '0.6rem',
            borderRadius: '6px',
            border: '1px solid #ccc',
            fontSize: '0.9rem',
            resize: 'vertical'
          }}
        />
      </div>

      <div style={{ textAlign: 'center', marginTop: '1rem' }}>
        <button
          type="button"
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          onClick={handleGenerate}
        >
          {t('generate')}
        </button>
      </div>
    </BaseModal>
  );
}
