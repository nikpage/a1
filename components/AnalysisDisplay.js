// components/AnalysisDisplay.js
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

// A value is "empty" if it is null/undefined, a placeholder sentinel, or an
// array/string that contains nothing real. Used to guarantee we never render a
// labelled headline with no content behind it.
const NA = new Set(['', 'n/a', 'na', 'null', 'none', 'undefined', '0-10']);
function isEmpty(v) {
  if (v == null) return true;
  if (Array.isArray(v)) return v.every(isEmpty);
  return NA.has(String(v).trim().toLowerCase());
}

// Render a value as text: arrays become a comma-separated list (never a run-on).
function display(v) {
  if (Array.isArray(v)) return v.filter((x) => !isEmpty(x)).join(', ');
  return v;
}

// ats_keywords_present is { term, proof } pairs (the proof is checked against
// the record in utils/openai.js). The candidate reads the terms; the proof is
// machinery, not copy.
function keywordTerms(v) {
  if (!Array.isArray(v)) return v;
  return v.map((e) => (e && typeof e === 'object' ? e.term : e));
}

// THE GAPS ARE NOT A VERDICT — they are a question.
//
// ats_keywords_missing is what the ad asked for and the RECORD could not
// evidence. Some of it the person genuinely does not have; some of it they have
// and their CV never said. Printing it as a flat list left them nowhere to go
// with the second kind. Each term is selectable, and the selected ones are
// handed to the "Add information" box as a draft the person finishes in their
// own words — so the claim and its evidence enter the master together, the
// record's fingerprint moves, and the career profile rebuilds around it.
function GapClaims({ label, terms, onClaim, t }) {
  const list = Array.isArray(terms)
    ? terms.filter((x) => !isEmpty(x)).map(String)
    : String(terms || '').split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
  const [picked, setPicked] = useState([]);
  if (!list.length) return null;

  const toggle = (term) =>
    setPicked((p) => (p.includes(term) ? p.filter((x) => x !== term) : [...p, term]));

  return (
    <div>
      <strong>{label}</strong>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', margin: '0.375rem 0' }}>
        {list.map((term) => (
          <button
            key={term}
            type="button"
            onClick={() => toggle(term)}
            style={{
              borderRadius: '9999px',
              border: `1px solid ${picked.includes(term) ? '#1d4ed8' : '#d1d5db'}`,
              background: picked.includes(term) ? '#dbeafe' : '#fff',
              color: picked.includes(term) ? '#1e3a8a' : '#374151',
              padding: '0.125rem 0.625rem',
              fontSize: '0.8125rem',
              cursor: 'pointer',
            }}
          >
            {term}
          </button>
        ))}
      </div>
      {picked.length > 0 && (
        <button
          type="button"
          onClick={() => { onClaim(picked); setPicked([]); }}
          style={{ fontSize: '0.8125rem', color: '#1d4ed8', textDecoration: 'underline', cursor: 'pointer' }}
        >
          {t('claimGapsAction', 'I do have these — add them to my record')}
        </button>
      )}
    </div>
  );
}

// A labelled field that renders nothing when its value is empty.
function Field({ label, value }) {
  if (isEmpty(value)) return null;
  return (
    <div>
      <strong>{label}</strong> {display(value)}
    </div>
  );
}

// A bulleted list that renders nothing (not even its heading) when empty.
function ListField({ label, items, style }) {
  const list = Array.isArray(items) ? items.filter((x) => !isEmpty(x)) : [];
  if (list.length === 0) return null;
  return (
    <div style={style || { marginTop: '1rem' }}>
      <strong>{label}</strong>
      <ul>
        {list.map((item, i) => (
          <li key={i}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

export default function AnalysisDisplay({ analysis, onClaimGaps = null }) {
  const { t } = useTranslation('analysisDisplay');
  if (!analysis) return null;

  let data;
  if (typeof analysis === 'string') {
    analysis = analysis.trim().replace(/^```json/, '').replace(/```$/, '').trim();
  }

  try {
    data = typeof analysis === 'string' ? JSON.parse(analysis) : analysis;
  } catch (e) {
    return (
      <div className="text-red-600">
        {t('invalidFormat')}<br />
        <pre style={{ whiteSpace: 'pre-wrap', color: '#444', fontSize: '0.85rem' }}>{analysis}</pre>
      </div>
    );
  }

  const Section = ({ title, content }) => (
    <div style={{ marginBottom: '1.6rem' }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>{title}</h2>
      <div>{content}</div>
    </div>
  );

  // A job ad is present only when the model actually extracted a position.
  // The no-job sentinel is "n/a" (and friends), so test for real content.
  const hasJobMatch = !isEmpty(data.job_data?.Position);
  const a = data.analysis || {};
  const any = (...vals) => vals.some((v) => !isEmpty(v));

  // MOTHBALLED (see prompts/analysis.js): the read-out shows only what the user
  // can act on. summary/fit_summary, overall_commentary, cv_format_analysis,
  // cultural_fit, style_wording, suitable_positions and final_thought are no
  // longer generated or rendered; career_arc, parallel_experience and
  // transferable_skills are still generated (the CV generator reads them) but
  // are not shown. Revive by restoring the <Field> rows and the prompt slots.
  const hasAssessment = any(keywordTerms(a.ats_keywords_present), a.ats_keywords_missing);
  const hasScores = any(a.overall_score, a.ats_score);
  const hasSuggestions = any(data.job_match?.positioning_strategy, data.job_match?.career_scenario);
  const hasAnalysis = hasScores || hasAssessment || any(a.red_flags);

  return (
    <div className="analysis-fix">
      <div className="doc-viewer">
        {(!isEmpty(a.hr_first_seconds) || !isEmpty(a.scan_reason)) && (
          <Section
            title={t('firstImpression', 'First Impression')}
            content={
              <div>
                {!isEmpty(a.hr_first_seconds) && (
                  <p style={{ fontStyle: 'italic', marginBottom: '0.75rem' }}>
                    “{a.hr_first_seconds}”
                  </p>
                )}
                {!isEmpty(a.scan_verdict) && (
                  <Field label={t('sevenSecondScan', '7-second scan:')} value={String(a.scan_verdict).toUpperCase()} />
                )}
                <Field label="" value={a.scan_reason} />
                {Array.isArray(a.scan_snags) && a.scan_snags.filter((s) => s && !isEmpty(s.point)).length > 0 && (
                  <ul style={{ marginTop: '0.5rem' }}>
                    {a.scan_snags.filter((s) => s && !isEmpty(s.point)).map((s, i) => (
                      <li key={i}>• <strong>{s.point}</strong>{!isEmpty(s.detail) ? ` — ${s.detail}` : ''}</li>
                    ))}
                  </ul>
                )}
              </div>
            }
          />
        )}
        <Section
          title={t('cvData')}
          content={
            <div>
              {Object.entries(data.cv_data || {}).map(([k, v]) => (
                <Field key={k} label={`${k.replace(/_/g, ' ')}:`} value={v} />
              ))}
              {hasJobMatch && (
                <div style={{ marginTop: '1rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>{t('jobAdData')}</h3>
                  {Object.entries(data.job_data || {}).map(([k, v]) => (
                    <Field key={k} label={`${k.replace(/_/g, ' ')}:`} value={v} />
                  ))}
                </div>
              )}
            </div>
          }
        />
        {hasAnalysis && (
        <Section
          title={t('analysis')}
          content={
            <div>
              {/* Overall/ATS scores and scenario are general CV metrics — shown
                  with or without a job, but labelled as a job match only when one exists. */}
              {hasScores && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  {hasJobMatch ? t('jobMatchEvaluation') : t('cvScore')}
                </h3>
                {!isEmpty(a.overall_score) && (
                  <Field label={hasJobMatch ? t('overallMatchScore') : t('overallScore')} value={`${a.overall_score}/10`} />
                )}
                {!isEmpty(a.ats_score) && <Field label={t('atsScore')} value={`${a.ats_score}/10`} />}
              </div>
              )}
              {hasAssessment && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>{t('cvAssessment')}</h3>
                <Field label={t('atsOptimization')} value={keywordTerms(a.ats_keywords_present)} />
                {onClaimGaps ? (
                  <GapClaims
                    label={t('atsGaps')}
                    terms={a.ats_keywords_missing}
                    onClaim={onClaimGaps}
                    t={t}
                  />
                ) : (
                  <Field label={t('atsGaps')} value={a.ats_keywords_missing} />
                )}
              </div>
              )}
              <ListField label={t('redFlags')} items={a.red_flags} />
            </div>
          }
        />
        )}
        {hasSuggestions && (
        <Section
          title={t('suggestions')}
          content={
            <div>
              <Field label={t('positioningStrategy')} value={data.job_match?.positioning_strategy} />
              <Field label={t('careerScenario')} value={data.job_match?.career_scenario} />
            </div>
          }
        />
        )}
      </div>
    </div>
  );
}
