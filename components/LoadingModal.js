// path: components/LoadingModal.js
import BaseModal from './BaseModal';

export default function LoadingModal({ message, title, onClose }) {
  return (
    <BaseModal onClose={onClose} showCloseButton={!!onClose}>
      <div className="flex flex-col items-center justify-center py-8">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mb-4"></div>
        {title && <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>}
        <p className="text-lg text-gray-600 text-center">{message}</p>
        <p className="text-sm text-gray-500 mt-2">This may take 30-120 seconds.</p>
      </div>
    </BaseModal>
  );
}
