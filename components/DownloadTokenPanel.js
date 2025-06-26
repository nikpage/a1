// components/DownloadTokenPanel.js
import { useEffect, useState } from 'react';

export default function DownloadTokenPanel({ onClose }) {
  const [success, setSuccess] = useState(false);
  const [tokensBought, setTokensBought] = useState(null);

  useEffect(() => {
    if (window.location.search.includes('success=true')) {
      setSuccess(true);
      const bought = localStorage.getItem('tokensPurchased');
      if (bought) {
        setTokensBought(bought);
        localStorage.removeItem('tokensPurchased');
      }
    }
  }, []);

  const buyTokens = async (quantity) => {
    localStorage.setItem('tokensPurchased', quantity); // for later display
    const res = await fetch('/api/stripe/create-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity, user_id }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      alert('Failed to start checkout.');
    }
  };

  return (
    <div style={{ background: '#fff', padding: 30, borderRadius: 12, maxWidth: 480, textAlign: 'center' }}>
      {success ? (
        <>
          <h2>🎉 Thank you!</h2>
          <p>Your payment was successful.</p>
          {tokensBought && <p>You bought {tokensBought} token{tokensBought > 1 ? 's' : ''}.</p>}
          <button onClick={onClose} style={{ marginTop: 20, padding: '8px 16px' }}>
            Close
          </button>
        </>
      ) : (
        <>
          <h3>Buy Tokens</h3>
          <p>Select how many tokens you want:</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 12 }}>
            <button onClick={() => buyTokens(1)}>1 for €6</button>
            <button onClick={() => buyTokens(2)}>2 for €8</button>
            <button onClick={() => buyTokens(10)}>10 for €23</button>
            <button onClick={() => buyTokens(30)}>30 for €42</button>
          </div>
          <button onClick={onClose} style={{ marginTop: 20, padding: '8px 16px' }}>
            Cancel
          </button>
        </>
      )}
    </div>
  );
}
