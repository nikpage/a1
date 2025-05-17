import React, { useState } from 'react';

export default function DownloadPay({ cvHTML, coverLetterHTML, tokens, onPurchase }) {
  const [showModal, setShowModal] = useState(false);

  const handleDownload = async (type) => {
    if (tokens === 0) {
      setShowModal(true);
      return;
    }

    const endpoint = '/api/download';
    const payload = { html: type === 'cv' ? cvHTML : coverLetterHTML, type };
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = type === 'cv' ? 'CV.docx' : 'CoverLetter.docx';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  };

  return (
    <div className="download-pay">
      <button onClick={() => handleDownload('cv')}>Download CV (.docx)</button>
      <button onClick={() => handleDownload('coverLetter')}>Download Cover Letter (.docx)</button>
      {showModal && (
        <div className="payment-modal">
          <div className="modal-content">
            <h2>Out of Tokens</h2>
            <p>You have 0 tokens. Please purchase tokens to download.</p>
            <button onClick={() => onPurchase()}>Buy Tokens</button>
            <button onClick={() => setShowModal(false)}>Maybe Later</button>
          </div>
        </div>
      )}
    </div>
  );
}
