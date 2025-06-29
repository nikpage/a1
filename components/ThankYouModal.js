// path: components/ThankYouModal.js
import { useEffect } from 'react';
import BaseModal from './BaseModal';

export default function ThankYouModal({ onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000); // Close after 5 seconds
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <BaseModal onClose={onClose}>
      <h2>🎉 Thank you!</h2>
      <p>Your payment was successful. Downloading now…</p>
    </BaseModal>
  );
}
