// pages/index.js

import CVUploader from '../components/CVUploader'

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-6 bg-white rounded-2xl shadow-lg flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-center mb-4">CV Optimization MVP</h1>
        <CVUploader />
      </div>
    </div>
  )
}
