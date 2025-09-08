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
      <div className="modal-container">
        {mode === 'generations' ? (
          <>
            <h3 className="modal-heading">Out of Generations</h3>
            <p className="modal-text">You’ve used all your free generations.</p>
            <p className="modal-text">Download one of your documents to refresh your balance back to 10.</p>
            <button onClick={onClose} className="button-primary">Close</button>
          </>
        ) : success ? (
          <>
            <h2 className="modal-heading">🎉 Thank you!</h2>
            <p className="modal-text">Your payment was successful.</p>
            {tokensBought && <p className="modal-text">You bought {tokensBought} token{tokensBought > 1 ? 's' : ''}.</p>}
            <button
              onClick={() => {
                setSuccess(false);
                setTokensBought(null);
                onClose();
              }}
              className="button-primary"
            >
              Close
            </button>
          </>
        ) : (
          displayBuyOptions && (
            <>
              <h3 className="modal-heading">Buy Tokens</h3>
              <p className="modal-text">Select how many tokens you want:</p>
              <div className="button-primary" style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button onClick={() => buyTokens(1)}>1 for €6</button>
                <button onClick={() => buyTokens(2)}>2 for €8</button>
                <button onClick={() => buyTokens(10)}>10 for €23</button>
                <button onClick={() => buyTokens(30)}>30 for €42</button>
              </div>
              <button onClick={onClose} className="button-primary">Cancel</button>
            </>
          )
        )}
      </div>
    </BaseModal>
  );
}
