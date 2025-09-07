// path: components/DownloadTokenPanel.js

import { useEffect, useState } from 'react';
import BaseModal from './BaseModal';

export default function DownloadTokenPanel({ onClose, user_id, mode = 'tokens', forceShowBuy = false }) {
  const [success, setSuccess] = useState(false);
  const [tokensBought, setTokensBought] = useState(null);
  const [displayBuyOptions, setDisplayBuyOptions] = useState(false);

  useEffect(() => {
    if (window.location.search.includes('success=true')) {
      setSuccess(true);
      window.history.replaceState({}, document.title, window.location.pathname);
      const bought = localStorage.getItem('tokensPurchased');
      if (bought) {
        setTokensBought(bought);
        localStorage.removeItem('tokensPurchased');
      }
      setDisplayBuyOptions(false);
    } else {
      setDisplayBuyOptions(forceShowBuy);
    }
  }, [forceShowBuy]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        onClose();
        setSuccess(false);
        setTokensBought(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, onClose]);

  const buyTokens = async (quantity) => {
    localStorage.setItem('tokensPurchased', quantity);
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
    <BaseModal onClose={onClose}>
      <div style={{ background: '#fff', padding: 30, borderRadius: 12, maxWidth: 480, textAlign: 'center' }}>
        {mode === 'generations' ? (
          <>
            <h3>Out of Generations</h3>
            <p>You’ve used all your free generations.</p>
            <p>Download one of your documents to refresh your balance back to 10.</p>
            <button onClick={onClose} style={{ marginTop: 20, padding: '8px 16px' }}>
              Close
            </button>
          </>
        ) : success ? (
          <>
            <h2>🎉 Thank you!</h2>
            <p>Your payment was successful.</p>
            {tokensBought && <p>You bought {tokensBought} token{tokensBought > 1 ? 's' : ''}.</p>}
            <button
              onClick={() => {
                setSuccess(false);
                setTokensBought(null);
                onClose();
              }}
              style={{ marginTop: 20, padding: '8px 16px' }}
            >
              Close
            </button>
          </>
        ) : (
          displayBuyOptions && (
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
          )
        )}
      </div>
    </BaseModal>
  );
}
