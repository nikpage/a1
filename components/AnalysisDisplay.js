import { useState } from 'react';
import CV_Cover_Display from './CV-Cover-Display';

export default function AnalysisDisplay({ analysisText, user_id }) {
  if (analysisText === null) return null;
  if (!analysisText || typeof analysisText !== 'string' || analysisText.trim() === '') {

    return <div style={{ marginTop: '2em', color: 'red' }}>No analysis available.</div>;
  }

  const fileNameMatch = analysisText.match(/^### FILE ANALYZED: (.+)$/m);
  const fileName = fileNameMatch ? fileNameMatch[1] : 'unknown.pdf';
  const fileLabel = `Analyzed File: ${fileName}`;
  const [showBuilder, setShowBuilder] = useState(false);

  if (!showBuilder) {
    return (
      <div style={{ marginTop: '2em' }}>
        <div className="formatted-analysis">
          <div style={{ fontWeight: 'bold', marginBottom: '1em' }}>{fileLabel}</div>
          <div dangerouslySetInnerHTML={{ __html: analysisText.replace(/\n/g, '<br/>') }} />
        </div>

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

  return <CV_Cover_Display user_id={user_id} analysis={analysisText} />;
}
