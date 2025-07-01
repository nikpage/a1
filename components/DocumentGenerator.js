// path: components/DocumentGenerator.js
import { useState } from 'react';
import ToneDocModal from './ToneDocModal';
import TokenPurchasePanel from './TokenPurchasePanel';
import BaseModal from './BaseModal';

export default function DocumentGenerator({ user_id, analysis }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [docs, setDocs] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showTokenPanel, setShowTokenPanel] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [gensLeft, setGensLeft] = useState(null);
  const [tokens, setTokens] = useState(null);

  const handleSubmit = async ({ tone, type }) => {
    if (!analysis) return;
    setLoading(true);
    setError(null);
    setDocs(null);

    try {
      const tokenCheck = await fetch(`/api/tokens?user_id=${user_id}`);
      const tokenData = await tokenCheck.json();
      setGensLeft(tokenData.generations_left);
      setTokens(tokenData.tokens);

      if (tokenData.generations_left <= 0) {
        setShowLimitModal(true);
        setLoading(false);
        return;
      }

      const res = await fetch('/api/generate-cv-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id, analysis, tone, type }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || 'Generation failed');
      } else {
        setDocs(data.docs);
      }
    } catch (err) {
      setError('Error: ' + err.message);
    }

    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <button
        onClick={() => setShowModal(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded"
        disabled={loading}
      >
        {loading ? 'Generating…' : 'Write Now'}
      </button>

      {error && <div style={{ color: 'red' }}>{error}</div>}

      {docs && docs.map((doc, i) => (
        <div key={i} className="border p-3 rounded bg-white shadow">
          <h3 className="font-bold uppercase">{doc.type}</h3>
          <pre className="whitespace-pre-wrap mt-2">{doc.content}</pre>
        </div>
      ))}

      {showModal && (
        <ToneDocModal
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
        />
      )}

      {showLimitModal && (
        <BaseModal onClose={() => setShowLimitModal(false)}>
          <div className="p-6 text-center space-y-4">
            <h2 className="text-lg font-semibold">You’ve used all your generations.</h2>
            <div className="flex justify-center gap-4">
              <button
                className="px-4 py-2 bg-gray-700 text-white rounded"
                onClick={() => setShowLimitModal(false)}
              >
                Download Documents
              </button>
              {tokens === 0 && (
                <button
                  className="px-4 py-2 bg-green-600 text-white rounded"
                  onClick={() => {
                    setShowLimitModal(false);
                    setShowTokenPanel(true);
                  }}
                >
                  Buy More Tokens
                </button>
              )}
            </div>
          </div>
        </BaseModal>
      )}

      {showTokenPanel && (
        <TokenPurchasePanel onClose={() => setShowTokenPanel(false)} />
      )}
    </div>
  );
}
