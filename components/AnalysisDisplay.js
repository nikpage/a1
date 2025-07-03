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

  // Custom function to check and display country-specific recommendations
  const checkAndDisplayNorms = (country, cvLength) => {
    const norms = {
      CZ: "1-2 pages is recommended. Consider trimming sections like [specific section] to meet this.",
      PL: "CV length should be 1-2 pages. Consider removing unnecessary job details.",
      HU: "Photo is typically included in the top-right corner. CV length should be concise (1-2 pages).",
      RO: "Photo is often included. CV should be 1-2 pages. Consider trimming experience sections.",
      US: "Avoid photo, CV length should be concise (1-2 pages).",
      DE: "Photo is optional, CV length should be concise (1-2 pages).",
      UA: "Photo is expected, especially for traditional roles. CV length should be 1-2 pages.",
    };

    const recommendation = norms[country] || norms['US'];  // Default to US norms
    if (cvLength > 2) {
      return `Your CV is ${cvLength} pages; in ${country}, ${recommendation}`;
    }
    return '';
  };

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

                {/* Action Items Tree Structure */}
                <div className="action-items-container">
                  <h3>Action Items</h3>

                  {/* CV Changes */}
                  <div className="category">
                    <h4>CV Action Items</h4>
                    <ul className="priority-list">
                      {Object.entries(data.analysis.action_items?.cv_changes || {}).map(([priority, items]) => (
                        <li key={`cv-${priority}`} className="priority-item">
                          <span className={`priority-badge ${priority}`}>{priority.toUpperCase()}</span>
                          <ul className="item-list">
                            {items.map((item, i) => (
                              <li key={`cv-${priority}-${i}`} className="action-item">
                                <span className="bullet">•</span> {item}
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Cover Letter Changes */}
                  <div className="category">
                    <h4>Cover Letter Action Items</h4>
                    <ul className="priority-list">
                      {Object.entries(data.analysis.action_items?.cover_letter || {}).map(([priority, items]) => (
                        <li key={`cl-${priority}`} className="priority-item">
                          <span className={`priority-badge ${priority}`}>{priority.toUpperCase()}</span>
                          <ul className="item-list">
                            {items.map((item, i) => (
                              <li key={`cl-${priority}-${i}`} className="action-item">
                                <span className="bullet">•</span> {item}
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Add CV Length Feedback */}
                <div>
                  <li>{checkAndDisplayNorms(data.job_data?.Country || data.cv_data?.Country, data.cv_data?.Length)}</li>
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
                <div><strong>Inferred Keywords:</strong> {(Array.isArray(data.job_match.inferred_keywords) ? data.job_match.inferred_keywords : []).join(', ')}</div>
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
