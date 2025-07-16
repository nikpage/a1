import { useEffect, useState } from 'react';

export default function DownloadTokenPanel({ onClose, user_id, forceShowBuy = false }) {
  const [success, setSuccess] = useState(false);
  const [tokensBought, setTokensBought] = useState(null);
  const [displayBuyOptions, setDisplayBuyOptions] = useState(false); // New state to control what is displayed

  useEffect(() => {
    // Check for success parameter in URL when the component mounts or forceShowBuy changes
    if (window.location.search.includes('success=true')) {
      setSuccess(true);
      // Immediately clean the URL to prevent re-triggering on refresh/re-render
      window.history.replaceState({}, document.title, window.location.pathname);

      const bought = localStorage.getItem('tokensPurchased');
      if (bought) {
        setTokensBought(bought);
        localStorage.removeItem('tokensPurchased'); // Clear local storage after reading
      }
      setDisplayBuyOptions(false); // Ensure buy options are NOT shown when displaying success
    } else {
      // If no success parameter in URL, then show buy options based on the forceShowBuy prop
      setDisplayBuyOptions(forceShowBuy);
    }
  }, [forceShowBuy]); // Dependency array: re-run this effect if 'forceShowBuy' changes

  // Effect to automatically close the modal after displaying the success message
  useEffect(() => {
    if (success) { // Only run this effect when the internal 'success' state is true
      const timer = setTimeout(() => {
        onClose(); // Call the onClose prop from the parent (TabbedViewer) to close the modal
        // Reset states in this component to prepare for potential future re-opening
        setSuccess(false);
        setTokensBought(null);
      }, 3000); // Display the 'Thank you' message for 3 seconds

      return () => clearTimeout(timer); // Clean up the timer when the component unmounts or if 'success' changes
    }
  }, [success, onClose]); // Dependencies: re-run if 'success' state or 'onClose' prop changes

  const buyTokens = async (quantity) => {
    localStorage.setItem('tokensPurchased', quantity); // Store quantity for display after redirect
    const res = await fetch('/api/stripe/create-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity, user_id }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url; // Redirect to Stripe checkout page
    } else {
      alert('Failed to start checkout.');
    }
  };

  return (
    <div style={{ background: '#fff', padding: 30, borderRadius: 12, maxWidth: 480, textAlign: 'center' }}>
      {success ? ( // Render the "Thank you" section if 'success' state is true
        <>
          <h2>🎉 Thank you!</h2>
          <p>Your payment was successful.</p>
          {tokensBought && <p>You bought {tokensBought} token{tokensBought > 1 ? 's' : ''}.</p>}
          {/* Button to allow manual close, even if auto-close is pending */}
          <button
            onClick={() => {
              setSuccess(false);
              setTokensBought(null);
              onClose(); // Manually close and reset states
            }}
            style={{ marginTop: 20, padding: '8px 16px' }}
          >
            Close
          </button>
        </>
      ) : (
        // Only render the "Buy Tokens" section if 'displayBuyOptions' is true
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
  );
}
