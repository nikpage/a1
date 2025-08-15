// components/AnalysisDisplay.js
import React from 'react';

// --- Helper Components for a clean structure ---

// Renders a main section with a title (H2)
const Section = ({ title, children, emoji = '' }) => (
  <section style={{ marginBottom: '2rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: '#1a202c' }}>
      {emoji} {title}
    </h2>
    <div style={{ color: '#4a5568', lineHeight: '1.6' }}>{children}</div>
  </section>
);

// Renders a sub-section with a title (H3)
const SubSection = ({ title, children }) => (
  <div style={{ marginBottom: '1.5rem' }}>
    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#2d3748' }}>
      {title}
    </h3>
    {children}
  </div>
);

// Renders a key-value pair, like "Name: John Doe"
const KeyValue = ({ label, value }) => {
  if (!value || (Array.isArray(value) && value.length === 0)) return null;
  const displayValue = Array.isArray(value) ? value.join(', ') : String(value);
  return (
    <div style={{ marginBottom: '0.25rem' }}>
      <strong style={{ color: '#2d3748' }}>{label}:</strong> {displayValue}
    </div>
  );
};

// Renders a bulleted list from an array of strings
const BulletList = ({ items }) => {
  if (!items || !Array.isArray(items) || items.length === 0) return null;
  return (
    <ul style={{ listStyleType: 'none', paddingLeft: '1rem' }}>
      {items.map((item, i) => (
        <li key={i} style={{ marginBottom: '0.25rem' }}>{item}</li>
      ))}
    </ul>
  );
};


// --- Main Display Component ---

export default function AnalysisDisplay({ analysis }) {
  if (!analysis) return null;

  let data;
  try {
    data = typeof analysis === 'string' ? JSON.parse(analysis.trim().replace(/^```json/, '').replace(/```$/, '').trim()) : analysis;
  } catch (e) {
    return (
      <div className="text-red-600">
        Invalid analysis format.<br />
        <pre style={{ whiteSpace: 'pre-wrap', color: '#444', fontSize: '0.85rem' }}>{analysis}</pre>
      </div>
    );
  }

  const hasJobData = data.job_data?.Position !== 'n/a' && data.job_data?.Position;

  return (
    <div>
      <h1 style={{ fontSize: '1.875rem', fontWeight: 800, marginBottom: '2rem', color: '#1a202c' }}>
        CV Analysis Report
      </h1>

      {data.summary && <Section emoji="📝" title="Professional Summary"><p>{data.summary}</p></Section>}

      <Section emoji="📊" title="Candidate & Role Overview">
        <SubSection title="Candidate Details">
          {Object.entries(data.cv_data || {}).map(([key, value]) => (
            <KeyValue key={key} label={key} value={value} />
          ))}
        </SubSection>
        {hasJobData && (
          <SubSection title="Job Details">
            {Object.entries(data.job_data || {}).map(([key, value]) => (
              <KeyValue key={key} label={key} value={value} />
            ))}
          </SubSection>
        )}
      </Section>

      {data.analysis && (
        <Section emoji="🔍" title="In-Depth Analysis">
          {hasJobData && data.job_match && (
            <SubSection title="Job Match Assessment">
              <KeyValue label="Overall Match Score" value={data.job_match.overall_score ? `${data.job_match.overall_score}/10` : null} />
              <KeyValue label="Career Scenario" value={data.job_match.career_scenario} />
              <KeyValue label="Positioning Strategy" value={data.job_match.positioning_strategy} />
              <KeyValue label="Keyword Match" value={data.job_match.keyword_match} />
              <KeyValue label="Inferred Keywords" value={data.job_match.inferred_keywords} />
            </SubSection>
          )}
          <SubSection title="CV Assessment">
            <KeyValue label="Structure & Formatting" value={data.analysis.cv_format_analysis} />
            <KeyValue label="Writing Style & Wording" value={data.analysis.style_wording} />
            <KeyValue label="Career Arc" value={data.analysis.career_arc} />
          </SubSection>
          <SubSection title="Skills Assessment">
            <KeyValue label="Transferable Skills" value={data.analysis.transferable_skills} />
            <KeyValue label="ATS Keywords" value={data.analysis.ats_keywords} />
          </SubSection>
          <SubSection title="General Commentary">
            <KeyValue label="Overall Commentary" value={data.analysis.overall_commentary} />
            <KeyValue label="Cultural Fit" value={data.analysis.cultural_fit} />
            <KeyValue label="Red Flags" value={data.analysis.red_flags} />
            {!hasJobData && <KeyValue label="Suitable Positions" value={data.analysis.suitable_positions} />}
          </SubSection>
        </Section>
      )}

      {data.analysis?.action_items && (
        <Section emoji="🚀" title="Action Plan">
          <SubSection title="CV Changes">
            <div style={{ marginBottom: '0.75rem' }}>
              <h4 style={{ fontWeight: 600, color: '#c53030' }}>Critical</h4>
              <BulletList items={data.analysis.action_items.cv_changes.critical} />
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <h4 style={{ fontWeight: 600, color: '#dd6b20' }}>Advised</h4>
              <BulletList items={data.analysis.action_items.cv_changes.advised} />
            </div>
            <div>
              <h4 style={{ fontWeight: 600, color: '#3182ce' }}>Optional</h4>
              <BulletList items={data.analysis.action_items.cv_changes.optional} />
            </div>
          </SubSection>
          <SubSection title="Cover Letter Guidance">
            <div style={{ marginBottom: '0.75rem' }}>
              <h4 style={{ fontWeight: 600 }}>Points to Address</h4>
              <BulletList items={data.analysis.action_items['Cover Letter']['Points to Address']} />
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <h4 style={{ fontWeight: 600 }}>Narrative Flow</h4>
              <BulletList items={data.analysis.action_items['Cover Letter']['Narrative Flow']} />
            </div>
            <div>
              <h4 style={{ fontWeight: 600 }}>Tone and Style</h4>
              <BulletList items={data.analysis.action_items['Cover Letter']['Tone and Style']} />
            </div>
          </SubSection>
        </Section>
      )}

      {data.final_thought && <Section emoji="💡" title="Final Thought"><p>{data.final_thought}</p></Section>}
    </div>
  );
}
