// path: pages/index.js

import { useState } from 'react'
import { useRouter } from 'next/router'
import Header from '../components/Header'
import LoadingModal from '../components/LoadingModal' // Added

export default function IndexPage() {
  const router = useRouter()
  const [file, setFile] = useState(null)
  const [jobText, setJobText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showLoadingModal, setShowLoadingModal] = useState(false) // Added
  const [loadingModalMessage, setLoadingModalMessage] = useState('') // Added
  const [loadingModalTitle, setLoadingModalTitle] = useState('') // Added

  const handleUploadAndAnalyze = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    setShowLoadingModal(true) // Added
    setLoadingModalTitle('Processing your CV and Job Ad') // Added
    setLoadingModalMessage('Uploading your CV and preparing for analysis...') // Added

    try {
      const formData = new FormData()
      formData.append('file', file)

      const uploadRes = await fetch('/api/upload-cv', {
        method: 'POST',
        body: formData,
      })
      const uploadData = await uploadRes.json()

      if (!uploadRes.ok || !uploadData.user_id) {
        throw new Error(uploadData.error || 'Upload failed') // Modified
      }

      setLoadingModalMessage('Analysis in progress...') // Added

      const analyzeRes = await fetch('/api/analyze-cv-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: uploadData.user_id,
          jobText,
          created_at: uploadData.created_at,
        }),
      })

      const analyzeData = await analyzeRes.json()

      if (!analyzeRes.ok || analyzeData.error) {
        throw new Error(analyzeData.error || 'Analysis failed') // Modified
      }

      router.push(`/${uploadData.user_id}`)
    } catch (err) {
      console.error("Upload/Analysis Error:", err) // Added
      setError('Error: ' + err.message)
    } finally { // Added
      setLoading(false) // Moved
      setShowLoadingModal(false) // Added
    } // Added
  }

  return (
     <>
       <Header />
       <main className="mx-auto px-4 py-4 text-center">
         <div className="flex flex-row justify-center items-start mb-6 gap-20">
           <div className="w-[600px] text-4xl font-light text-slate-800 text-center leading-tight">
             Regular CV<br /><em>plus</em> Job Add
           </div>
           <div className="w-[600px] text-4xl font-light text-slate-800 text-center leading-tight">
             Targeted<br />CV & Cover Letter
           </div>
           <div className="w-[600px] text-4xl font-light text-slate-800 text-center leading-tight">
             More Interviews<br />More Offers
           </div>
         </div>
         <div className="mb-8 text-xl text-slate-500 font-normal text-center">
           Because Average CVs Are for Average People.
         </div>

         <form onSubmit={handleUploadAndAnalyze} className="flex flex-col gap-6 items-center">
           <div
             onClick={() => document.getElementById('file-input').click()}
             onDragOver={(e) => e.preventDefault()}
             onDrop={(e) => {
               e.preventDefault()
               const droppedFile = e.dataTransfer.files[0]
               if (droppedFile) setFile(droppedFile)
             }}
             className="w-full max-w-sm border-2 border-dashed border-gray-300 rounded-lg py-6 bg-white cursor-pointer flex flex-col items-center justify-center h-32"
           >
             {file ? file.name : (
               <>
                 <p className="text-black text-base">Drop CV or LinkedIn Profile</p>
                 <p className="text-black text-base mt-1">PDF or Word</p>
               </>
             )}
             <input
               id="file-input"
               type="file"
               accept="application/pdf"
               onChange={(e) => setFile(e.target.files[0])}
               className="hidden"
             />
           </div>

           <textarea
             placeholder="Paste Job Ad (highly recomneded)"
             value={jobText}
             onChange={(e) => setJobText(e.target.value)}
             rows={6}
             className="w-full max-w-sm border border-gray-300 rounded-lg p-3 text-base text-black text-center placeholder-text-black placeholder-opacity-100"
           />

           <button
             type="submit"
             disabled={loading || !file}
             className="action-btn w-full max-w-sm"
           >
             {loading ? 'Uploading & Analyzing…' : 'Upload & Analyze'}
           </button>

           {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
         </form>

         {showLoadingModal && ( // Added
           <LoadingModal // Added
             title={loadingModalTitle} // Added
             message={loadingModalMessage} // Added
             onClose={() => setShowLoadingModal(false)} // Added
           /> // Added
         )}

       </main>
     </>
   )
 }
