// path: components/BaseModal.js

export default function BaseModal({ onClose, children, showCloseButton = false }) {
  const handleContentClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div onClick={handleContentClick} className="bg-white p-10 rounded-xl max-w-lg w-full shadow-2xl text-center relative">
        {children}
        {showCloseButton && (
          <button onClick={onClose} className="mt-6 px-4 py-2 bg-gray-800 text-white rounded">
            Close
          </button>
        )}
      </div>
    </div>
  );
}
