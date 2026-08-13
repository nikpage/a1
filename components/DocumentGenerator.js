// path: components/DocumentGenerator.js
import { useState } from 'react';
import { logGemini } from '../utils/log-gemini.js';
import { generateDocuments } from '../utils/generateDocuments.js';
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

  // ToneDocModal hands back one entry per document, each with its own tone and
  // language. Each document is one token, so they run one at a time.
  const handleSubmit = async ({ selected }) => {
    if (!analysis || !selected?.length) return;
    setLoading(true);
    setError(null);
    setDocs(null);

    try {
      const tokenCheck = await fetch(`/api/tokens?user_id=${user_id}`);
      const tokenData = await tokenCheck.json();
      setGensLeft(tokenData.generations_left);
      setTokens(tokenData.tokens);

      if (tokenData.generations_left < selected.length) {
        setShowLimitModal(true);
        setLoading(false);
        return;
      }

      // Sequential: the run holds a per-user gen_lock, so a parallel pair loses
      // the race and one document silently never arrives.
      const written = [];
      for (const { type, tone, language } of selected) {
        const data = await generateDocuments({ analysis, tone, type, language });
        if (data.gemini_usage) logGemini(data.gemini_usage);

        if (!data.ok) {
          setError(data.error || 'Generation failed');
          break;
        }
        const content = data.cv || data.cover;
        if (content) written.push({ type, content });
      }
      if (written.length) setDocs(written);
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
