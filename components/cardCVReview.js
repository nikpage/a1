import React from 'react';

export default function CardCVReview({ displayName, feedback }) {
  if (!feedback) return null;

  return (
    <div>
      <h3 style={{ marginTop: '1rem' }}>
        Review {displayName}
      </h3>
      <div style={{
        border: '1px solid #bbb',
        borderRadius: '6px',
        padding: '1rem',
        background: '#f8f8fa',
        marginTop: '0.5rem',
        whiteSpace: 'pre-wrap'
      }}>
        {feedback}
      </div>
    </div>
  );
}
