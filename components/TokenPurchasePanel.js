// components/TokenPurchasePanel.js
import { useState } from 'react';

export default function TokenPurchasePanel({ onClose, mode = "tokens", user_id, tokensRemaining }) {
  const [loading, setLoading] = useState(false);

  const handlePurchase = async (quantity) => {
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity, user_id }),
      });
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
      } else {
        alert('Failed to initiate purchase.');
      }
    } catch (err) {
      console.error(err);
      alert('Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const pricingOptions = [
    { quantity: 1, price: 6,  label: '1 Download',  description: 'Perfect for trying out' },
    { quantity: 2, price: 8,  label: '2 Downloads', description: 'CV + Cover Letter', popular: true }, // ✅ pill here
    { quantity: 10, price: 23, label: '10 Downloads', description: 'Best for job hunting' },
    { quantity: 30, price: 42, label: '30 Downloads', description: 'Professional package' },
  ];


  // 🔑 Corrected display logic
  const showGenerationsMsg = mode === "generations" && tokensRemaining > 0;
  const showPurchasePanel = mode === "tokens" || tokensRemaining === 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">

        {/* Out of generations message */}
        {showGenerationsMsg && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-light text-slate-800">You are out of free generations</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-slate-500">Please download your document to continue.</p>
          </div>
        )}

        {/* Purchase panel */}
        {showPurchasePanel && (
          <>
            {/* Header */}
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-light text-slate-800">Purchase Downloads</h2>
                <p className="text-slate-500 mt-1">You need at least 1 download to save your documents</p>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" disabled={loading} aria-label="Close">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Pricing Options */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {pricingOptions.map((option) => (
                <div
                  key={option.quantity}
                  className={`relative border-2 rounded-xl p-6 transition-all duration-200 hover:shadow-lg ${
                    option.popular
                      ? 'border-[#41b4a2] bg-[#41b4a2] bg-opacity-5'
                      : 'border-gray-200 hover:border-[#41b4a2]'
                  }`}
                >
                  {option.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-[#41b4a2] text-white text-xs font-semibold px-3 py-1 rounded-full">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-slate-800 mb-2">{option.label}</h3>
                    <div className="mb-3">
                      <span className="text-3xl font-light text-[#41b4a2]">€{option.price}</span>
                      <span className="text-slate-500 text-sm ml-1">
                        (€{(option.price / option.quantity).toFixed(2)} each)
                      </span>
                    </div>
                    <p className="text-slate-600 text-sm mb-4">{option.description}</p>

                    <button
                      onClick={() => handlePurchase(option.quantity)}
                      disabled={loading}
                      className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                        option.popular
                          ? 'bg-[#41b4a2] text-white hover:bg-[#369185] shadow-md'
                          : 'bg-gray-100 text-slate-700 hover:bg-gray-200'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {loading ? 'Processing…' : 'Purchase Now'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Info */}
            <div className="px-6 pb-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-slate-800 mb-3">What you get:</h4>
                <ul className="space-y-2 text-slate-600 text-sm">
                  <li className="flex items-start">
                    <span className="text-[#41b4a2] mr-2 mt-0.5">✓</span>
                    Download your optimized CV and cover letter
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#41b4a2] mr-2 mt-0.5">✓</span>
                    Multiple file formats (PDF, DOCX)
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#41b4a2] mr-2 mt-0.5">✓</span>
                    Unlimited generations and previews
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#41b4a2] mr-2 mt-0.5">✓</span>
                    Professional ATS-optimized formatting
                  </li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 text-center">
              <p className="text-xs text-slate-500">
                Secure payment processed by Stripe. No subscription required.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
