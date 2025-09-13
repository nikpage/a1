// components/ThankYouModal.js
import { useEffect } from 'react';
import BaseModal from './BaseModal';
import { useTranslation } from 'react-i18next';

export default function ThankYouModal({ onClose }) {
  const { t } = useTranslation('thankYouModal');

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <BaseModal onClose={onClose}>
      <h2>{t('title')}</h2>
      <p>{t('message')}</p>
    </BaseModal>
  );
}
