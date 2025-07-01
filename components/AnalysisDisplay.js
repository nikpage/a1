// path: components/AnalysisDisplay.js
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

  return (
    <div className="analysis-fix">
      <div className="doc-viewer">
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


        <Section
          title="CV Data"
          content={Object.entries(data.cv_data || {}).map(([k, v]) => (
            <div key={k}>
              <strong>{k.replace(/_/g, ' ')}:</strong> {Array.isArray(v) ? v.join(', ') : v}
            </div>
          ))}
        />

        <Section
          title="Job Data"
          content={Object.entries(data.job_data || {}).map(([k, v]) => (
            <div key={k}>
              <strong>{k.replace(/_/g, ' ')}:</strong> {Array.isArray(v) ? v.join(', ') : v}
            </div>
          ))}
        />

        <Section
          title="Analysis"
          content={
            data.analysis ? (
              <div>
                <div><strong>Overall Score:</strong> {data.analysis.overall_score}</div>
                <div><strong>ATS Score:</strong> {data.analysis.ats_score}</div>
                <div><strong>Scenario Tags:</strong> {data.analysis.scenario_tags?.join(', ')}</div>
                <div><strong>Quick Wins:</strong>
                  <ul>{data.analysis.quick_wins?.map((item, i) => <li key={i}>• {item}</li>)}</ul>
                </div>
                <div><strong>Red Flags:</strong>
                  <ul>{data.analysis.red_flags?.map((item, i) => <li key={i}>• {item}</li>)}</ul>
                </div>
                <div><strong>Cultural Fit:</strong> {data.analysis.cultural_fit}</div>
                <div><strong>Commentary:</strong> {data.analysis.overall_commentary}</div>
                <div><strong>Suitable Positions:</strong> {data.analysis.suitable_positions?.join(', ')}</div>
                <div><strong>Career Arc:</strong> {data.analysis.career_arc}</div>
                <div><strong>Parallel Experience:</strong> {data.analysis.parallel_experience}</div>
                <div><strong>Style & Wording:</strong> {data.analysis.style_wording}</div>
                <div><strong>ATS Keywords:</strong> {data.analysis.ats_keywords}</div>
                <div><strong>Action Items:</strong>
                  <ul>
                    {Object.entries(data.analysis.action_items || {}).map(([tag, items]) =>
                      Array.isArray(items) ? items.map((text, i) => (
                        <li key={`${tag}-${i}`}>[{tag}] {text}</li>
                      )) : null
                    )}
                  </ul>
                </div>
              </div>
            ) : null
          }
        />


        {data.job_match && (
          <Section
            title="Job Match"
            content={
              <div>
                <div><strong>Keyword Match:</strong> {data.job_match.keyword_match}</div>
                <div><strong>Inferred Keywords:</strong> {data.job_match.inferred_keywords?.join(', ')}</div>
                <div><strong>Career Scenario:</strong> {data.job_match.career_scenario}</div>
                <div><strong>Positioning Strategy:</strong> {data.job_match.positioning_strategy}</div>
              </div>
            }
          />
        )}

      </div>
    </div>
  );
}
