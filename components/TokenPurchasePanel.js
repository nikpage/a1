// components/TokenPurchasePanel.js
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function TokenPurchasePanel({ onClose, mode = "tokens", user_id, tokensRemaining }) {
  const { t } = useTranslation('tokenPurchasePanel');
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
    { quantity: 1, price: 6, label: '1 Download' },
    { quantity: 2, price: 8, label: '2 Downloads' },
    { quantity: 10, price: 23, label: '10 Downloads', popular: true },
    { quantity: 30, price: 42, label: '30 Downloads' },
  ];

  const showGenerationsMsg = mode === "generations" && tokensRemaining > 0;
  const showPurchasePanel = mode === "tokens" || tokensRemaining === 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">

        {showGenerationsMsg && (
          <div className="p-6 relative text-center">
            <h2 className="text-2xl font-light text-slate-800 mb-2">{t('outOfGenerationsTitle')}</h2>
            <p className="text-slate-500 text-sm">{t('outOfGenerationsMsg')}</p>
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {showPurchasePanel && (
          <>
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div className="flex-1 text-center">
                <h2 className="text-2xl font-light text-slate-800">{t('purchaseTitle')}</h2>
                <p className="text-slate-500 mt-1">{t('purchaseSubtitle')}</p>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600" disabled={loading}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {pricingOptions.map((option) => (
                <div
                  key={option.quantity}
                  className={`relative border-2 rounded-xl p-6 transition-all duration-200 hover:shadow-lg ${
                    option.popular ? 'border-[#41b4a2] bg-[#41b4a2] bg-opacity-5' : 'border-gray-200 hover:border-[#41b4a2]'
                  }`}
                >
                  {option.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-[#41b4a2] text-white text-xs font-semibold px-3 py-1 rounded-full">
                        {t('mostPopular')}
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
                      {loading ? t('processing') : t('purchaseNow')}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-6 pb-6 text-center">
              <p className="text-sm text-slate-500">{t('securePayment')}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
