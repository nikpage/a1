// components/StartFreshModal.js
import React, { useState, useEffect } from 'react'
import StartFreshSelector from './StartFreshSelector'
import StartFreshDbModal from './StartFreshDbModal'
import StartFreshUploadModal from './StartFreshUploadModal'
import StartFreshHeader from './StartFreshHeader'

export default function StartFreshModal({
  user_id,
  onSubmit,
  handleCvUploadFromModal,
  onStartFresh,
  onClose,
}) {
  const [step, setStep] = useState(0)
  const [cvOptions, setCvOptions] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedCvId, setSelectedCvId] = useState('')
  const [jobDescription, setJobDescription] = useState('')

  const fetchCVs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/get-cvs?user_id=${user_id}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        const sortedData = data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const options = sortedData.map(cv => ({
          id: cv.id,
          name: cv.filename,
          uploadedAt: cv.created_at,
          created_at: cv.created_at // Include created_at for API compatibility
        }));
        setCvOptions(options);
        if (options.length > 0) {
          setSelectedCvId(options[0].id);
        } else {
          setSelectedCvId('');
        }
      }
    } catch (error) {
      console.error('Failed to fetch CVs:', error);
      alert('Failed to load CVs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user_id) {
      fetchCVs();
    }
  }, [user_id]);


  // Send payload that matches your existing API expectations
  const handleGenerateAnalysis = async (cvId, jobDesc) => {
    setLoading(true);
    try {
      // Find the selected CV to get its created_at timestamp
      const selectedCv = cvOptions.find(cv => cv.id === cvId);

      const payload = {
        user_id: user_id,
        created_at: selectedCv?.created_at, // Your API uses this to find the specific CV
        file_name: selectedCv?.name || 'Unnamed file'
      };

      if (jobDesc && jobDesc.trim() !== '') {
        payload.jobText = jobDesc.trim();
      }

      const res = await fetch('/api/analyze-cv-job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      console.log('Analysis generated:', data);

      window.dispatchEvent(new CustomEvent('new-analysis', {
        detail: {
          analysis: data.analysis,
          startFresh: true
        }
      }));


      onStartFresh();
      onClose();
    } catch (error) {
      console.error('Error generating analysis:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // This function now correctly handles upload and then triggers analysis
  const handleUploadAndAnalyze = async (jobDesc) => {
    setLoading(true);
    try {
      const newCvId = await handleCvUploadFromModal();
      if (newCvId) {
        await handleGenerateAnalysis(newCvId, jobDesc);
      } else {
        alert('CV upload failed or no new CV ID was returned.');
      }
    } catch (error) {
      console.error('Error uploading CV and generating analysis:', error);
      alert(`Error uploading CV: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {step === 0 && (
        <StartFreshHeader mode="start" onClose={() => { setStep(0); onClose() }}>
          <div className="flex space-x-4 mt-6">
            <button
              className="flex-1 bg-white border border-gray-200 px-4 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              onClick={() => setStep(1)}
            >
              Continue with Uploaded CV
            </button>
            <button
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
              onClick={() => setStep(2)}
            >
              Continue with NEW CV Upload
            </button>
          </div>
        </StartFreshHeader>
      )}

      {step === 1 && (
        <StartFreshDbModal
          user_id={user_id}
          cvOptions={cvOptions}
          selectedCvId={selectedCvId}
          setSelectedCvId={setSelectedCvId}
          jobDescription={jobDescription}
          setJobDescription={setJobDescription}
          loading={loading}
          onSubmit={handleGenerateAnalysis}
          onStartFresh={onStartFresh}
          onBack={() => setStep(0)}
          onClose={() => { setStep(0); onClose() }}
        />
      )}

      {step === 2 && (
        <StartFreshUploadModal
          handleCvUploadFromModal={handleCvUploadFromModal}
          jobDescription={jobDescription}
          setJobDescription={setJobDescription}
          loading={loading}
          onSubmit={handleUploadAndAnalyze}
          onBack={() => setStep(0)}
          onClose={() => { setStep(0); onClose() }}
        />
      )}
    </>
  )
}
