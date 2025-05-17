import React from 'react';

export default function DocPreview({ cvHTML, coverLetterHTML, watermarkText }) {
  const renderProtected = (htmlContent) => {
    const paragraphs = htmlContent.split(/\n{2,}/).map((p, i) => (
      <div
        key={i}
        className="preview-card"
        style={{
          userSelect: 'none',
          position: 'relative',
          background: 'rgba(255,255,255,0.8)',
          margin: '1em',
          padding: '1em',
          borderRadius: '4px'
        }}
      >
        <div dangerouslySetInnerHTML={{ __html: p }} />
        <span
          style={{
            position: 'absolute',
            bottom: '4px',
            right: '8px',
            fontSize: '8px',
            opacity: 0.3
          }}
        >
          {watermarkText}
        </span>
      </div>
    ));

    return (
      <div
        className="preview-column"
        style={{
          position: 'relative',
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><text x='0' y='15' fill='rgba(0,0,0,0.05)' font-size='14' transform='rotate(-30)'>${encodeURIComponent(
            watermarkText
          )}</text></svg>")`,
          backgroundRepeat: 'repeat'
        }}
      >
        {paragraphs}
      </div>
    );
  };

  return (
    <div className="doc-preview" style={{ display: 'flex', gap: '2em' }}>
      <div style={{ flex: 1 }}>
        <h3>CV Preview</h3>
        {renderProtected(cvHTML)}
      </div>
      <div style={{ flex: 1 }}>
        <h3>Cover Letter Preview</h3>
        {renderProtected(coverLetterHTML)}
      </div>
    </div>
  );
}
