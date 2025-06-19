// components/AnalysisDisplay.js
import { useState } from 'react';
import CV_Cover_Display from './CV-Cover-Display';

export default function AnalysisDisplay({ analysisText, user_id }) {
  const [showBuilder, setShowBuilder] = useState(false);

  if (!analysisText || typeof analysisText !== 'string') return null;

  // ─────────  SHOW ANALYSIS  ─────────
  if (!showBuilder) {
    return (
      <div style={{ marginTop: '2em' }}>
        <div
          className="formatted-analysis"
          // keep original formatting
          dangerouslySetInnerHTML={{ __html: analysisText.replace(/\n/g, '<br/>') }}
        />

        {/* Write button */}
        <div style={{ marginTop: '2em', textAlign: 'center' }}>
          <button
            onClick={() => setShowBuilder(true)}
            style={{
              padding: '0.8rem 2.4rem',
              fontSize: '1.1rem',
              borderRadius: 6,
              border: '1px solid #666',
              cursor: 'pointer',
            }}
          >
            Write Now!
          </button>
        </div>
      </div>
    );
  }

  // ─────────  SHOW CV-/Cover-builder (analysis hidden)  ─────────
  return <CV_Cover_Display user_id={user_id} analysis={analysisText} />;
}
