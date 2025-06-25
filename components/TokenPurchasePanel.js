// components/TokenPurchasePanel.js

import { useState } from 'react';

export default function TokenPurchasePanel({ onClose }) {
  const [loading, setLoading] = useState(false);
  const handlePurchase = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('Failed to initiate purchase.');
      }
    } catch (err) {
      console.error('Checkout error:', err);
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
        <button
          onClick={handlePurchase}
          disabled={loading}
          style={{
            marginTop: 20,
            padding: '10px 20px',
            background: '#2255aa',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          {loading ? 'Redirecting...' : 'Buy Tokens'}
        </button>
        <div style={{ marginTop: 16 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888' }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
