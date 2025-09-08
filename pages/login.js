import { useState } from 'react';
import BaseModal from './BaseModal';
import '../styles/modalStyles.css';

export default function LoginModal({ onClose, userId }) {
  const [email, setEmail] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSendMagicLink = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setIsSending(true);

    try {
      const response = await fetch('/api/auth/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          user_id: userId,
          rememberMe
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send login link');
      }

      setMessage(`Login link sent to ${email}! Check your inbox and click the link to continue.`);
    } catch (err) {
      console.error("Magic link error:", err);
      setError(err.message || 'Failed to send login link. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <BaseModal onClose={onClose}>
      <h2 className="modal-heading">Access Your CV Analysis</h2>

      <form onSubmit={handleSendMagicLink} className="flex flex-col gap-4">
        <p className="modal-text">
          {userId
            ? 'Enter your email to receive a secure login link.'
            : 'Enter your email to log in or create an account.'}
        </p>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          className="input-field"
          disabled={isSending}
        />

        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            disabled={isSending}
          />
          Keep me logged in for 30 days
        </label>

        <button
          type="submit"
          disabled={isSending || !email}
          className="button-primary"
        >
          {isSending ? 'Sending Link...' : 'Send Login Link'}
        </button>
      </form>

      {message && (
        <div className="success-message">
          {message}
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <p className="text-xs text-gray-500 mt-4 text-center">
        The login link will expire in 15 minutes for security.
      </p>
    </BaseModal>
  );
}
