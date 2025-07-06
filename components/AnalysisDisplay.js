import React from 'react';

export default function AnalysisDisplay({ analysis }) {
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
        Invalid analysis format.<br />
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
        {/* 1. Summary */}
        <Section
          title="Summary"
          content={
            data.summary && typeof data.summary === 'object' ? (
              <div>
                <div><strong>Fit Summary:</strong> {data.summary.fit_summary}</div>
                <div><strong>Cover Letter Recommended:</strong> {data.summary.cover_letter_recommended ? 'Yes' : 'No'}</div>
                <div><strong>Cover Letter Focus:</strong> {data.summary.cover_letter_focus?.join(', ')}</div>
              </div>
            ) : (
              data.summary
            )
          }
        />

        {/* 2. CV Data */}
        <Section
          title="CV Data"
          content={
            <div>
              {Object.entries(data.cv_data || {}).map(([k, v]) => (
                <div key={k}>
                  <strong>{k.replace(/_/g, ' ')}:</strong> {Array.isArray(v) ? v.join(', ') : v}
                </div>
              ))}

              {hasJobMatch && (
                <div style={{ marginTop: '1rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Job Ad Data</h3>
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

        {/* 3. Analysis */}
        <Section
          title="Analysis"
          content={
            <div>
              {hasJobMatch && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Job Match Evaluation</h3>
                  {data.analysis?.overall_score != null && <div><strong>Overall Match Score:</strong> {data.analysis.overall_score}/10</div>}
                  {data.analysis?.ats_score != null && <div><strong>ATS Score:</strong> {data.analysis.ats_score}/10</div>}
                  {Array.isArray(data.analysis?.scenario_tags) && data.analysis.scenario_tags.length > 0 && (
                    <div><strong>Scenarios:</strong> {data.analysis.scenario_tags.join(', ')}</div>
                  )}
                  {data.job_match?.keyword_match !== 'null' && (
                    <div style={{ marginTop: '1rem' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.25rem' }}>Keyword & Skills Analysis</h4>
                      <div><strong>Matches:</strong> {data.job_match.keyword_match}</div>
                      <div><strong>Suggested Additions:</strong> {Array.isArray(data.job_match.inferred_keywords) ? data.job_match.inferred_keywords.join(', ') : data.job_match.inferred_keywords}</div>
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>CV Assessment</h3>
                {data.analysis?.cv_format_analysis && <div><strong>Structure & Length:</strong> {data.analysis.cv_format_analysis}</div>}
                {data.analysis?.style_wording && <div><strong>Writing Style:</strong> {data.analysis.style_wording}</div>}
                {data.analysis?.ats_keywords && <div><strong>ATS Optimization:</strong> {data.analysis.ats_keywords}</div>}
              </div>

              {hasJobMatch && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Applicant Fit</h3>
                  {data.analysis?.cultural_fit && <div><strong>Cultural Fit:</strong> {data.analysis.cultural_fit}</div>}
                  {data.analysis?.overall_commentary && <div><strong>Job Match Commentary:</strong> {data.analysis.overall_commentary}</div>}
                </div>
              )}

              {!hasJobMatch && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>General Assessment</h3>
                  {data.analysis?.cultural_fit && <div><strong>Cultural Fit:</strong> {data.analysis.cultural_fit}</div>}
                  {data.analysis?.overall_commentary && <div><strong>Commentary:</strong> {data.analysis.overall_commentary}</div>}
                  {Array.isArray(data.analysis?.suitable_positions) && <div><strong>Suitable Positions:</strong> {data.analysis.suitable_positions.join(', ')}</div>}
                  {data.analysis?.career_arc && <div><strong>Career Arc:</strong> {data.analysis.career_arc}</div>}
                  {data.analysis?.parallel_experience && <div><strong>Parallel Experience:</strong> {data.analysis.parallel_experience}</div>}
                  {data.analysis?.transferable_skills && <div><strong>Transferable Skills:</strong> {data.analysis.transferable_skills}</div>}
                </div>
              )}

              {Array.isArray(data.analysis?.quick_wins) && (
                <div style={{ marginTop: '1rem' }}>
                  <strong>Quick Wins:</strong>
                  <ul>{data.analysis.quick_wins.map((item, i) => <li key={i}>• {item}</li>)}</ul>
                </div>
              )}
              {Array.isArray(data.analysis?.red_flags) && (
                <div style={{ marginTop: '1rem' }}>
                  <strong>Red Flags:</strong>
                  <ul>{data.analysis.red_flags.map((item, i) => <li key={i}>• {item}</li>)}</ul>
                </div>
              )}
            </div>
          }
        />

        {/* 4. Suggestions */}
        <Section
          title="Suggestions"
          content={
            <div>
              {hasJobMatch && (
                <div>
                  {data.job_match?.positioning_strategy && (
                    <div style={{ marginBottom: '1rem' }}>
                      <strong>Positioning Strategy:</strong> {data.job_match.positioning_strategy}
                    </div>
                  )}
                  {data.job_match?.career_scenario && (
                    <div style={{ marginBottom: '1rem' }}>
                      <strong>Career Scenario:</strong> {data.job_match.career_scenario}
                    </div>
                  )}
                </div>
              )}

              {data.analysis?.action_items && Object.keys(data.analysis.action_items).length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <strong>Action Items:</strong>
                  {Object.entries(data.analysis.action_items).map(([section, categories]) => (
                    <div key={section} style={{ marginTop: '0.5rem' }}>
                      <div style={{ fontWeight: 'bold' }}>
                        {section === 'cv_changes' ? 'CV' : section === 'cover_letter' ? 'Cover Letter' : section}
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

        {data.final_thought && (
          <Section
            title="Final Thought"
            content={<div>{data.final_thought}</div>}
          />
        )}
      </div>
    </div>
  );
}
