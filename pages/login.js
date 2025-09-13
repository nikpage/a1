// login.js
import { useState } from 'react';
import BaseModal from './BaseModal';
import '../styles/modalStyles.css';
import { useTranslation } from 'react-i18next';

export default function LoginModal({ onClose, userId }) {
  const { t } = useTranslation('login');
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
        body: JSON.stringify({ email, user_id: userId, rememberMe }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('errorDefault'));
      setMessage(`${t('successPrefix')} ${email}${t('successSuffix')}`);
    } catch (err) {
      setError(err.message || t('errorDefault'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <BaseModal onClose={onClose}>
      <h2 className="modal-heading">{t('heading')}</h2>
      <form onSubmit={handleSendMagicLink} className="flex flex-col gap-4">
        <p className="modal-text">
          {userId ? t('textWithUserId') : t('textWithoutUserId')}
        </p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('placeholderEmail')}
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
          {t('rememberMe')}
        </label>
        <button type="submit" disabled={isSending || !email} className="button-primary">
          {isSending ? t('buttonSending') : t('buttonDefault')}
        </button>
      </form>
      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}
      <p className="text-xs text-gray-500 mt-4 text-center">{t('expiryNotice')}</p>
    </BaseModal>
  );
}
