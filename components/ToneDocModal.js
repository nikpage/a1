// components/ToneDocModal.js
//
// The generation request. The CV and the cover letter are written by separate
// calls against different rule sets, so each one carries its OWN tone and
// output language — a formal Czech CV alongside a friendly English letter is a
// real thing people send, and forcing one setting across both was a limitation
// of the form, never of the generator.
//
// Settings are shown only for the documents actually selected, so the choice
// is always explicit and there is no hidden state for a document being skipped.
import BaseModal from './BaseModal';
import { OFFERED_TONES } from '../prompts/tone';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// The offered tones, lower-cased for the locale keys. Which tones are offered
// is decided in prompts/tone.js, beside their definitions.
const TONE_OPTIONS = OFFERED_TONES.map((t) => t.toLowerCase());
// Values match prompts/language.js GENERATION_LANGUAGES; the server coerces
// anything it doesn't recognise back to 'auto'.
const LANGUAGE_OPTIONS = [['auto', 'langAuto'], ['en', 'langEn'], ['cs', 'langCs']];

// The server expects 'cv' / 'cover'; the UI labels them by the same keys.
const DOC_TYPES = ['cv', 'cover'];

export default function ToneDocModal({ onClose, onSubmit }) {
  const { t } = useTranslation('toneDocModal');
  const [types, setTypes] = useState({ cv: true, cover: true });
  const [tone, setTone] = useState({ cv: 'formal', cover: 'formal' });
  const [language, setLanguage] = useState({ cv: 'auto', cover: 'auto' });
  const [tweak, setTweak] = useState('');

  const selectedTypes = DOC_TYPES.filter((d) => types[d]);

  const handleGenerate = () => {
    if (selectedTypes.length === 0) {
      alert(t('alertNoSelection'));
      return;
    }
    // One entry per document, each carrying its own settings.
    onSubmit({
      selected: selectedTypes.map((type) => ({
        type,
        tone: tone[type],
        language: language[type],
      })),
      tweak,
    });
  };

  const pill = (active) => ({
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    border: '1px solid #ccc',
    backgroundColor: active ? '#3b82f6' : '#fff',
    color: active ? 'white' : 'black',
    cursor: 'pointer',
  });

  const row = { display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' };

  return (
    <BaseModal onClose={onClose}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          {t('selectDocType')}
        </h2>
        <div style={row}>
          {DOC_TYPES.map((doc) => (
            <label key={doc} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={types[doc]}
                onChange={() => setTypes((prev) => ({ ...prev, [doc]: !prev[doc] }))}
              />
              {t(doc === 'cover' ? 'coverLetter' : doc)}
            </label>
          ))}
        </div>
        {/* One token per document, so a pair costs two. Said plainly, before
            the click, rather than discovered on the balance afterwards. */}
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.75rem', textAlign: 'center' }}>
          {t('costNotice', { count: selectedTypes.length })}
        </p>
      </div>

      {selectedTypes.map((doc) => (
        <div
          key={doc}
          style={{
            marginBottom: '1.5rem',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '1rem',
          }}
        >
          <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.75rem', textAlign: 'center' }}>
            {t(doc === 'cover' ? 'coverLetter' : doc)}
          </h3>

          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.4rem' }}>{t('chooseTone')}</p>
          <div style={{ ...row, marginBottom: '1rem' }}>
            {TONE_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                style={pill(tone[doc] === opt)}
                onClick={() => setTone((prev) => ({ ...prev, [doc]: opt }))}
              >
                {t(opt)}
              </button>
            ))}
          </div>

          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.4rem' }}>{t('chooseLanguage')}</p>
          <div style={row}>
            {LANGUAGE_OPTIONS.map(([value, labelKey]) => (
              <button
                key={value}
                type="button"
                style={pill(language[doc] === value)}
                onClick={() => setLanguage((prev) => ({ ...prev, [doc]: value }))}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          {t('tweakHeading')}
        </h2>
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem' }}>
          {t('tweakHint')}
        </p>
        <textarea
          value={tweak}
          onChange={(e) => setTweak(e.target.value)}
          placeholder={t('tweakPlaceholder')}
          rows={3}
          style={{
            width: '100%',
            padding: '0.6rem',
            borderRadius: '6px',
            border: '1px solid #ccc',
            fontSize: '0.9rem',
            resize: 'vertical',
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
