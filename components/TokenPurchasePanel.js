// path: components/TokenPurchasePanel.js
import { useState } from 'react';

export default function TokenPurchasePanel({ onClose }) {
  const [loading, setLoading] = useState(false);

  const handlePurchase = async (quantity) => {
    setLoading(true);
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert('Failed to initiate purchase.');
    } catch (err) {
      console.error(err);
      alert('Something went wrong.');
    }
    setLoading(false);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: '#fff',
        padding: 30,
        borderRadius: 12,
        textAlign: 'center',
        maxWidth: 400,
        width: '90%'
      }}>
        <h2>Not enough tokens</h2>
        <p>You need at least 1 token to download. Buy more below.</p>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 10,
          marginTop: 20
        }}>
          <button onClick={() => handlePurchase(1)} disabled={loading}>1 for €6</button>
          <button onClick={() => handlePurchase(2)} disabled={loading}>2 for €8</button>
          <button onClick={() => handlePurchase(10)} disabled={loading}>10 for €23</button>
          <button onClick={() => handlePurchase(30)} disabled={loading}>30 for €42</button>
        </div>
        <button
          onClick={onClose}
          style={{
            marginTop: 20,
            padding: '10px 20px',
            background: 'none',
            border: 'none',
            color: '#888',
            cursor: 'pointer'
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
