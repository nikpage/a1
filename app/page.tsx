// app/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import CVFileUploader from './components/CVFileUploader'

export default function HomePage() {
  const [isUploading, setIsUploading] = useState(false)
  const router = useRouter()

  const handleUploadSuccess = (sessionToken: string) => {
    router.push(`/${sessionToken}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            CV Optimization Platform
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Upload your CV and get AI-powered optimization recommendations
          </p>
          <div className="flex justify-center space-x-8 mb-8">
            <div className="text-center">
              <div className="bg-white rounded-full p-3 shadow-md mb-2">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-sm text-gray-600">Upload CV</p>
            </div>
            <div className="text-center">
              <div className="bg-white rounded-full p-3 shadow-md mb-2">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm text-gray-600">Get Analysis</p>
            </div>
            <div className="text-center">
              <div className="bg-white rounded-full p-3 shadow-md mb-2">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm text-gray-600">Download Optimized</p>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto">
          <CVFileUploader onUploadSuccess={handleUploadSuccess} />
        </div>

        <div className="text-center mt-12">
          <p className="text-sm text-gray-500">
            3 free optimizations per session • PDF files only • Max 200KB
          </p>
        </div>
      </div>
    </div>
  )
}
