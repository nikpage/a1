// path: components/CVUploader.js

import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import supabase from '../utils/supabaseClient'
import BaseModal from './BaseModal'
import LoginForm from './LoginForm' // you’ll create this next

export default function CVUploader() {
  const inputRef = useRef()
  const router = useRouter()
  const [file, setFile] = useState(null)
  const [fileName, setFileName] = useState('')
  const [jobText, setJobText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [showLogin, setShowLogin] = useState(false)
  const [session, setSession] = useState(null)

  const fileChosen = !!file

  useEffect(() => {
    const checkSession = async () => {
      const session = supabase.auth.session()
      setSession(session)
    }
    checkSession()
  }, [])

  const handleFileChange = (f) => {
    setError('')
    if (!f || f.type !== 'application/pdf' || f.size > 200 * 1024) {
      setError('PDF only, max 200KB')
      setFile(null)
      setFileName('')
      return
    }
    setFile(f)
    setFileName(f.name)
    console.log("File selected:", f.name, f.size)
  }

  const handleUpload = async () => {
    if (!session) {
      setShowLogin(true)
      return
    }

    if (!file) {
      setError('No file selected')
      alert('No file selected')
      return
    }

    setError('')
    setUploading(true)
    console.log("Uploading file:", file.name)
    const form = new FormData()
    form.append('file', file)
    form.append('jobText', jobText)

    try {
      const res = await fetch('/api/upload-cv', { method: 'POST', body: form })
      const data = await res.json()
      setUploading(false)
      console.log("Upload response (truncated):", JSON.stringify(data).slice(0, 230) + '…', '| Size:', (JSON.stringify(data).length / 1024).toFixed(2), 'KB');
      if (data.user_id) {
        router.push(`/${data.user_id}`)
      } else {
        setError(data.error || 'Upload failed')
        alert(data.error || 'Upload failed')
      }
    } catch (err) {
      setUploading(false)
      setError('Network or server error')
      alert('Network or server error')
      console.error("Fetch error:", err)
    }
  }

  return (
    <>
      <form
        className="flex flex-col gap-4 w-full max-w-md mx-auto"
        onSubmit={e => { e.preventDefault(); handleUpload(); }}
      >
        <div className="flex flex-col">
          <span className="font-semibold mb-1">
            Select your CV (PDF, max 200KB)
          </span>
          <input
            type="file"
            accept="application/pdf"
            ref={inputRef}
            className="hidden real-file-input"
            onChange={e => handleFileChange(e.target.files[0])}
            disabled={uploading}
          />
          <button
            type="button"
            className="w-full py-2 mt-2 rounded-xl bg-blue-600 text-white font-bold"
            onClick={() => inputRef.current.click()}
            disabled={uploading}
          >
            Choose File
          </button>
          {fileName && <div className="text-gray-700 mt-1 text-sm">{fileName}</div>}
        </div>

        <div className="flex flex-col">
          <label className="font-semibold mb-1">Paste Job Description (optional)</label>
          <textarea
            className="w-full mt-2 p-2 rounded-xl border border-gray-300 font-normal"
            placeholder="Paste job ad here"
            value={jobText}
            onChange={e => setJobText(e.target.value)}
            disabled={!fileChosen || uploading}
            rows={4}
          />
        </div>

        <button
          type="submit"
          className="w-full py-2 rounded-xl bg-green-600 text-white font-bold disabled:bg-gray-400"
          disabled={!fileChosen || uploading}
        >
          {uploading ? "Uploading..." : "Upload"}
        </button>

        {error && <div className="text-red-500 text-center w-full">{error}</div>}
      </form>

      {showLogin && (
        <BaseModal show={showLogin} onClose={() => setShowLogin(false)}>
          <LoginForm onLogin={s => { setSession(s); setShowLogin(false); }} />
        </BaseModal>
      )}

      <style jsx>{`
        .real-file-input {
          display: none !important;
          visibility: hidden !important;
          width: 0 !important;
          height: 0 !important;
          position: absolute !important;
          pointer-events: none !important;
        }
      `}</style>
    </>
  )
}
