// path: components/BaseModal.js

export default function BaseModal({ onClose, children, showCloseButton = true }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white p-10 rounded-xl max-w-lg w-full shadow-2xl text-center relative">
        {children}
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            className="mt-6 px-5 py-2 bg-gray-700 text-white rounded hover:bg-gray-900"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
