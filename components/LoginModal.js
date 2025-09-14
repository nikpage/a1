// components/LoginModal.js
import { useState, useEffect } from 'react';
import BaseModal from './BaseModal';
import { useTranslation } from 'react-i18next';

export default function LoginModal({ onClose, userId }) {
  const { t } = useTranslation('login'); // use the "login" namespace
  const [email, setEmail] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleSendMagicLink = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setIsSending(true);

    try {
      const response = await fetch('/api/auth/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          userId ? { email, user_id: userId, rememberMe } : { email, rememberMe }
        ),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('error.analysisFailed'));
      }

      setMessage(`${t('successPrefix')} ${email}${t('successSuffix')}`);
    } catch (err) {
      console.error("Magic link error:", err);
      setError(err.message || t('error.uploadFailed'));
    } finally {
      setIsSending(false);
    }
  };

  if (!isMounted) {
    return null;
  }

  return (
    <BaseModal onClose={onClose} showCloseButton={true}>
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        {t('heading')}
      </h2>

      <form onSubmit={handleSendMagicLink} className="flex flex-col gap-4">
        <p className="text-gray-600 mb-2">
          {userId ? t('textWithUserId') : t('textWithoutUserId')}
        </p>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('placeholderEmail')}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-lg"
          disabled={isSending}
        />

        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            disabled={isSending}
          />
          {t('rememberMe')}
        </label>

        <button
          type="submit"
          disabled={isSending || !email}
          className="action-btn px-6 py-3 rounded-lg text-white font-semibold transition-colors duration-200"
        >
          {isSending ? t('buttonSending') : t('buttonDefault')}
        </button>
      </form>

      {message && (
        <div className="text-green-600 mt-4 p-3 bg-green-50 rounded-lg">
          {message}
        </div>
      )}

      {error && (
        <div className="text-red-600 mt-4 p-3 bg-red-50 rounded-lg">
          {error}
        </div>
      )}

      <p className="text-xs text-gray-500 mt-4 text-center">
        {t('expiryNotice')}
      </p>
    </BaseModal>
  );
}
