// components/AnalysisDisplay.js
import React from 'react';
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

export default function AnalysisDisplay({ analysis }) {
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

  const hasSummary =
    data.summary && typeof data.summary === 'object'
      ? any(data.summary.fit_summary, data.summary.cover_letter_focus)
      : !isEmpty(data.summary);
  const hasAssessment = any(a.cv_format_analysis, a.style_wording, a.ats_keywords_present, a.ats_keywords_missing);
  const hasFit = hasJobMatch
    ? any(a.cultural_fit, a.overall_commentary)
    : any(a.cultural_fit, a.overall_commentary, a.suitable_positions, a.career_arc, a.parallel_experience, a.transferable_skills);
  const hasScores = any(a.overall_score, a.ats_score, a.scenario_tags);
  const hasActionItems = a.action_items && Object.values(a.action_items).some(
    (cats) => cats && Object.values(cats).some((items) => Array.isArray(items) && items.filter((x) => !isEmpty(x)).length > 0)
  );
  const hasSuggestions = any(data.job_match?.positioning_strategy, data.job_match?.career_scenario) || hasActionItems;
  const hasAnalysis = hasScores || hasAssessment || hasFit || any(a.quick_wins, a.red_flags);

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
        {hasSummary && (
        <Section
          title={t('summary')}
          content={
            data.summary && typeof data.summary === 'object' ? (
              <div>
                <div><strong>{t('fitSummary')}</strong> {data.summary.fit_summary}</div>
                <div><strong>{t('coverLetterRecommended')}</strong> {data.summary.cover_letter_recommended ? t('yes') : t('no')}</div>
                <div><strong>{t('coverLetterFocus')}</strong> {data.summary.cover_letter_focus?.join(', ')}</div>
              </div>
            ) : (
              data.summary
            )
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
                <Field label={t('scenarios')} value={a.scenario_tags} />
                {hasJobMatch && (
                  <div style={{ marginTop: '1rem' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.25rem' }}>{t('keywordSkills')}</h4>
                    <Field label={t('matches')} value={data.job_match?.keyword_match} />
                    <Field label={t('suggestedAdditions')} value={data.job_match?.inferred_keywords} />
                  </div>
                )}
              </div>
              )}
              {hasAssessment && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>{t('cvAssessment')}</h3>
                <Field label={t('structureLength')} value={a.cv_format_analysis} />
                <Field label={t('writingStyle')} value={a.style_wording} />
                <Field label={t('atsOptimization')} value={a.ats_keywords_present} />
                <Field label={t('atsGaps')} value={a.ats_keywords_missing} />
              </div>
              )}
              {hasFit && (hasJobMatch ? (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>{t('applicantFit')}</h3>
                  <Field label={t('culturalFit')} value={a.cultural_fit} />
                  <Field label={t('jobMatchCommentary')} value={a.overall_commentary} />
                </div>
              ) : (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>{t('generalAssessment')}</h3>
                  <Field label={t('culturalFit')} value={a.cultural_fit} />
                  <Field label={t('commentary')} value={a.overall_commentary} />
                  <Field label={t('suitablePositions')} value={a.suitable_positions} />
                  <Field label={t('careerArc')} value={a.career_arc} />
                  <Field label={t('parallelExperience')} value={a.parallel_experience} />
                  <Field label={t('transferableSkills')} value={a.transferable_skills} />
                </div>
              ))}
              <ListField label={t('quickWins')} items={a.quick_wins} />
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
              {a.action_items && Object.keys(a.action_items).length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <strong>{t('actionItems')}</strong>
                  {Object.entries(a.action_items).map(([section, categories]) => (
                    <div key={section} style={{ marginTop: '0.5rem' }}>
                      <div style={{ fontWeight: 'bold' }}>
                        {section === 'cv_changes' ? t('cv') : section === 'cover_letter' ? t('coverLetter') : section}
                      </div>
                      {Object.entries(categories).map(([priority, items]) =>
                        Array.isArray(items) && items.filter((x) => !isEmpty(x)).length > 0 ? (
                          <div key={priority} style={{ marginLeft: '1rem', marginTop: '0.25rem' }}>
                            <div style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>{priority}:</div>
                            <ul style={{ marginLeft: '1rem' }}>
                              {items.filter((x) => !isEmpty(x)).map((text, i) => (
                                <li key={i}>• {text}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          }
        />
        )}
        {!isEmpty(data.final_thought) && (
          <Section title={t('finalThought')} content={<div>{data.final_thought}</div>} />
        )}
      </div>
    </div>
  );
}
