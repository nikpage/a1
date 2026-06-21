// components/AnalysisDisplay.js
import React from 'react';
import { useTranslation } from 'react-i18next';

function TagList({ items }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.25rem' }}>
      {items.map((item, i) => (
        <span key={i} className="inline-block bg-blue-50 border border-blue-200 text-blue-800 text-sm px-2 py-0.5 rounded-full">{item}</span>
      ))}
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

  const hasJobMatch = data.job_data?.Position !== 'null' && data.job_data?.Position;

  return (
    <div className="analysis-fix">
      <div className="doc-viewer">
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
        <Section
          title={t('cvData')}
          content={
            <div>
              {Object.entries(data.cv_data || {}).map(([k, v]) => (
                <div key={k}>
                  <strong>{k.replace(/_/g, ' ')}:</strong> {Array.isArray(v) ? v.join(', ') : v}
                </div>
              ))}
              {hasJobMatch && (
                <div style={{ marginTop: '1rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>{t('jobAdData')}</h3>
                  {Object.entries(data.job_data || {}).map(([k, v]) => (
                    <div key={k}>
                      <strong>{k.replace(/_/g, ' ')}:</strong> {Array.isArray(v) ? v.join(', ') : v}
                    </div>
                  ))}
                </div>
              )}
            </div>
          }
        />
        <Section
          title={t('analysis')}
          content={
            <div>
              {hasJobMatch && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>{t('jobMatchEvaluation')}</h3>
                  {data.analysis?.overall_score != null && <div><strong>{t('overallMatchScore')}</strong> {data.analysis.overall_score}/10</div>}
                  {data.analysis?.ats_score != null && <div><strong>{t('atsScore')}</strong> {data.analysis.ats_score}/10</div>}
                  {Array.isArray(data.analysis?.scenario_tags) && data.analysis.scenario_tags.length > 0 && (
                    <div><strong>{t('scenarios')}</strong> {data.analysis.scenario_tags.join(', ')}</div>
                  )}
                  {data.job_match?.keyword_match !== 'null' && (
                    <div style={{ marginTop: '1rem' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.25rem' }}>{t('keywordSkills')}</h4>
                      <div><strong>{t('matches')}</strong> {data.job_match.keyword_match}</div>
                      <div><strong>{t('suggestedAdditions')}</strong> {Array.isArray(data.job_match.inferred_keywords) ? data.job_match.inferred_keywords.join(', ') : data.job_match.inferred_keywords}</div>
                    </div>
                  )}
                </div>
              )}
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>{t('cvAssessment')}</h3>
                {data.analysis?.cv_format_analysis && <div><strong>{t('structureLength')}</strong> {data.analysis.cv_format_analysis}</div>}
                {data.analysis?.style_wording && <div><strong>{t('writingStyle')}</strong> {data.analysis.style_wording}</div>}
                {data.analysis?.ats_keywords && <div><strong>{t('atsOptimization')}</strong> {data.analysis.ats_keywords}</div>}
              </div>
              {hasJobMatch && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>{t('applicantFit')}</h3>
                  {data.analysis?.cultural_fit && <div><strong>{t('culturalFit')}</strong> {data.analysis.cultural_fit}</div>}
                  {data.analysis?.overall_commentary && <div><strong>{t('jobMatchCommentary')}</strong> {data.analysis.overall_commentary}</div>}
                </div>
              )}
              {!hasJobMatch && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>{t('generalAssessment')}</h3>
                  {data.analysis?.cultural_fit && <div><strong>{t('culturalFit')}</strong> {data.analysis.cultural_fit}</div>}
                  {data.analysis?.overall_commentary && <div><strong>{t('commentary')}</strong> {data.analysis.overall_commentary}</div>}
                  {Array.isArray(data.analysis?.suitable_positions) && <div><strong>{t('suitablePositions')}</strong> {data.analysis.suitable_positions.join(', ')}</div>}
                  {data.analysis?.career_arc && <div><strong>{t('careerArc')}</strong> {data.analysis.career_arc}</div>}
                  {data.analysis?.parallel_experience && <div><strong>{t('parallelExperience')}</strong> {data.analysis.parallel_experience}</div>}
                  {data.analysis?.transferable_skills && <div><strong>{t('transferableSkills')}</strong> {data.analysis.transferable_skills}</div>}
                </div>
              )}
              {Array.isArray(data.analysis?.quick_wins) && (
                <div style={{ marginTop: '1rem' }}>
                  <strong>{t('quickWins')}</strong>
                  <ul>{data.analysis.quick_wins.map((item, i) => <li key={i}>• {item}</li>)}</ul>
                </div>
              )}
              {Array.isArray(data.analysis?.red_flags) && (
                <div style={{ marginTop: '1rem' }}>
                  <strong>{t('redFlags')}</strong>
                  <ul>{data.analysis.red_flags.map((item, i) => <li key={i}>• {item}</li>)}</ul>
                </div>
              )}
            </div>
          }
        />
        <Section
          title={t('suggestions')}
          content={
            <div>
              {hasJobMatch && (
                <div>
                  {data.job_match?.positioning_strategy && (
                    <div style={{ marginBottom: '1rem' }}>
                      <strong>{t('positioningStrategy')}</strong> {data.job_match.positioning_strategy}
                    </div>
                  )}
                  {data.job_match?.career_scenario && (
                    <div style={{ marginBottom: '1rem' }}>
                      <strong>{t('careerScenario')}</strong> {data.job_match.career_scenario}
                    </div>
                  )}
                </div>
              )}
              {data.analysis?.action_items && Object.keys(data.analysis.action_items).length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <strong>{t('actionItems')}</strong>
                  {Object.entries(data.analysis.action_items).map(([section, categories]) => (
                    <div key={section} style={{ marginTop: '0.5rem' }}>
                      <div style={{ fontWeight: 'bold' }}>
                        {section === 'cv_changes' ? t('cv') : section === 'cover_letter' ? t('coverLetter') : section}
                      </div>
                      {Object.entries(categories).map(([priority, items]) =>
                        Array.isArray(items) && items.length > 0 ? (
                          <div key={priority} style={{ marginLeft: '1rem', marginTop: '0.25rem' }}>
                            <div style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>{priority}:</div>
                            <ul style={{ marginLeft: '1rem' }}>
                              {items.map((text, i) => (
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
        {data.job_extraction && (() => {
          const ex = data.job_extraction;
          const hasContent = ex.position_title || ex.company || ex.location ||
            ex.seniority || ex.employment_type || ex.salary ||
            (Array.isArray(ex.hard_skills) && ex.hard_skills.length > 0) ||
            (Array.isArray(ex.soft_skills) && ex.soft_skills.length > 0) ||
            (Array.isArray(ex.must_have_requirements) && ex.must_have_requirements.length > 0) ||
            (Array.isArray(ex.nice_to_have) && ex.nice_to_have.length > 0) ||
            (Array.isArray(ex.keywords_for_ats) && ex.keywords_for_ats.length > 0) ||
            (Array.isArray(ex.responsibilities) && ex.responsibilities.length > 0) ||
            (Array.isArray(ex.language_requirements) && ex.language_requirements.length > 0);
          if (!hasContent) return null;
          return (
            <Section
              title={t('extractedFromJob')}
              content={
                <div>
                  {ex.position_title && <div><strong>{t('extPositionTitle')}</strong> {ex.position_title}</div>}
                  {ex.company && <div><strong>{t('extCompany')}</strong> {ex.company}</div>}
                  {ex.location && <div><strong>{t('extLocation')}</strong> {ex.location}</div>}
                  {ex.seniority && <div><strong>{t('extSeniority')}</strong> {ex.seniority}</div>}
                  {ex.employment_type && <div><strong>{t('extEmploymentType')}</strong> {ex.employment_type}</div>}
                  {ex.salary && ex.salary !== 'n/a' && <div><strong>{t('extSalary')}</strong> {ex.salary}</div>}
                  {Array.isArray(ex.hard_skills) && ex.hard_skills.length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}><strong>{t('extHardSkills')}</strong><TagList items={ex.hard_skills} /></div>
                  )}
                  {Array.isArray(ex.soft_skills) && ex.soft_skills.length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}><strong>{t('extSoftSkills')}</strong><TagList items={ex.soft_skills} /></div>
                  )}
                  {Array.isArray(ex.must_have_requirements) && ex.must_have_requirements.length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}><strong>{t('extMustHave')}</strong><TagList items={ex.must_have_requirements} /></div>
                  )}
                  {Array.isArray(ex.nice_to_have) && ex.nice_to_have.length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}><strong>{t('extNiceToHave')}</strong><TagList items={ex.nice_to_have} /></div>
                  )}
                  {Array.isArray(ex.keywords_for_ats) && ex.keywords_for_ats.length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}><strong>{t('extATSKeywords')}</strong><TagList items={ex.keywords_for_ats} /></div>
                  )}
                  {Array.isArray(ex.responsibilities) && ex.responsibilities.length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}><strong>{t('extResponsibilities')}</strong><TagList items={ex.responsibilities} /></div>
                  )}
                  {Array.isArray(ex.language_requirements) && ex.language_requirements.length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}><strong>{t('extLanguages')}</strong><TagList items={ex.language_requirements} /></div>
                  )}
                </div>
              }
            />
          );
        })()}
        {data.final_thought && (
          <Section
            title={t('finalThought')}
            content={<div>{data.final_thought}</div>}
          />
        )}
      </div>
    </div>
  );
}
