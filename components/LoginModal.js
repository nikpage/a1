// path: components/LoginModal.js
import { useState } from 'react';
import BaseModal from './BaseModal';

export default function LoginModal({ onClose, userId, action = null }) {
  const [email, setEmail] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [linkSent, setLinkSent] = useState(false);

  const handleSendLink = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!email) {
      setError('Please enter your email address.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          user_id: userId,
          rememberMe,
          action, // Pass the intended action to the API
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: 'An unknown server error occurred.' }));
        throw new Error(errData.message || `Server error: ${res.status}`);
      }

      setLinkSent(true);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal onClose={onClose}>
      <div className="text-center">
        {!linkSent ? (
          <>
            <h2 className="modal-heading">Log In / Continue</h2>
            <p className="modal-text mb-6">
              Enter your email to get a secure login link.
            </p>
            <form onSubmit={handleSendLink}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
                disabled={loading}
              />
              <div className="flex items-center justify-center mb-4">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-900">
                  Remember me
                </label>
              </div>
              {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
              <button
                type="submit"
                className="button-primary w-full"
                disabled={loading}
              >
                {loading ? 'Sending Link...' : 'Send Login Link'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 className="modal-heading">✅ Check Your Email</h2>
            <p className="modal-text mb-6">
              A secure login link has been sent to <strong>{email}</strong>.
            </p>
            <button
              onClick={onClose}
              className="button-secondary w-full"
            >
              Close
            </button>
          </>
        )}
      </div>
    </BaseModal>
  );
}
