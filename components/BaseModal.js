// path: components/BaseModal.js
import React from 'react';

export default function BaseModal({ onClose, children }) {
  const handleContentClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4"
    >
      <div
        onClick={handleContentClick}
        className="bg-white p-8 sm:p-10 rounded-xl max-w-lg w-full shadow-2xl text-center relative"
      >
        <button
          onClick={onClose}
          className="absolute top-0 right-0 mt-4 mr-4 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close modal"
        >
          <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      style={{ width: '24px', height: '24px' }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
        </button>
        {children}
      </div>
    </div>
  );
}
