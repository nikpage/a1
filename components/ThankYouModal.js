// path: components/ThankYouModal.js

import BaseModal from './BaseModal';

export default function ThankYouModal({ onClose }) {
  return (
    <BaseModal onClose={onClose}>
      <h2>🎉 Thank you!</h2>
      <p>Your payment was successful. Downloading now…</p>
    </BaseModal>
  );
}
