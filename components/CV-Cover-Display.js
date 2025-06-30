// path: components/CV-Cover-Display.js

import { useState, useEffect } from 'react';
import DownloadTokenPanel from './DownloadTokenPanel';
import ToneDocModal from './ToneDocModal';
import { supabase } from '../utils/database';

export default function CV_Cover_Display({ user_id, analysis }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [docs, setDocs] = useState(null);
  const [showBuyPanel, setShowBuyPanel] = useState(false);
  const [showModal, setShowModal] = useState(false); // Modal state

  const [selectedTone, setSelectedTone] = useState(null);
  const [selectedTypes, setSelectedTypes] = useState([]);

  useEffect(() => {
    const loadDocs = async () => {
      if (!user_id || !analysis || !selectedTone || !analysis.analysis_id) return;
      const { source_cv_id, analysis_id } = analysis;

      const { data, error } = await supabase
        .from('gen_data')
        .select('type, content')
        .eq('user_id', user_id)
        .eq('source_cv_id', source_cv_id)
        .eq('tone', selectedTone)
        .eq('analysis_id', analysis_id);

      if (error) {
        setError('Error loading documents');
        return;
      }

      setDocs(data);
    };

    loadDocs();
  }, [user_id, analysis, selectedTone]);

  const handleModalSubmit = ({ tone, selected }) => {
    setSelectedTone(tone);
    setSelectedTypes(selected);
  };

  const handleWriteNowClick = () => {
    console.log("showModal set to true");
    setShowModal(true);  // Correctly trigger the modal
  };

  return (
    <div className="space-y-4">
      <button
        onClick={handleWriteNowClick}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        Write Now
      </button>

      {docs && docs.map((doc, i) => (
        <div key={i} className="border p-3 rounded bg-white shadow">
          <h3 className="font-bold uppercase">{doc.type}</h3>
          <pre className="whitespace-pre-wrap mt-2">{doc.content}</pre>
        </div>
      ))}

      {showBuyPanel && <DownloadTokenPanel onClose={() => setShowBuyPanel(false)} />}
      {showModal && (
        <ToneDocModal
          onClose={() => setShowModal(false)}  // Close the modal
          onSubmit={handleModalSubmit}         // Pass the submit handler
        />
      )}
    </div>
  );
}
