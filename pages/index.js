import { useState } from 'react'
import CVUploader from '../components/CVUploader'

export default function Home() {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-6 bg-white rounded-2xl shadow-lg flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-center">CV Optimization MVP</h1>
        <CVUploader setUploading={setUploading} setError={setError} />
        {uploading && <div className="text-center">Uploading...</div>}
        {error && <div className="text-red-500 text-center">{error}</div>}
      </div>
    </div>
  )
}
