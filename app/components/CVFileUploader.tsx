// app/components/CVFileUploader.tsx
'use client'
import { useState, useCallback } from 'react'

interface CVFileUploaderProps {
 onUploadSuccess: (sessionToken: string) => void
}

export default function CVFileUploader({ onUploadSuccess }: CVFileUploaderProps) {
 const [isDragging, setIsDragging] = useState(false)
 const [isUploading, setIsUploading] = useState(false)
 const [error, setError] = useState<string | null>(null)

 const handleDragOver = useCallback((e: React.DragEvent) => {
   e.preventDefault()
   setIsDragging(true)
 }, [])

 const handleDragLeave = useCallback((e: React.DragEvent) => {
   e.preventDefault()
   setIsDragging(false)
 }, [])

 const handleDrop = useCallback((e: React.DragEvent) => {
   e.preventDefault()
   setIsDragging(false)
   const files = Array.from(e.dataTransfer.files)
   if (files.length > 0) {
     handleFileUpload(files[0])
   }
 }, [])

 const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
   const files = e.target.files
   if (files && files.length > 0) {
     handleFileUpload(files[0])
   }
 }

 const handleFileUpload = async (file: File) => {
   setError(null)

   // Validate file type
   if (file.type !== 'application/pdf') {
     setError('Please upload a PDF file only')
     return
   }

   // Validate file size (200KB = 204800 bytes)
   if (file.size > 204800) {
     setError('File size must be less than 200KB')
     return
   }

   setIsUploading(true)

   try {
     const formData = new FormData()
     formData.append('cv', file)

     const response = await fetch('/api/upload-cv', {
       method: 'POST',
       body: formData
     })

     if (!response.ok) {
       throw new Error('Upload failed')
     }

     const data = await response.json()
     console.log('API response:', data)

     if (!data.userId) {
       throw new Error('No user ID received')
     }
     onUploadSuccess(data.userId)
   } catch (err) {
     setError('Upload failed. Please try again.')
   } finally {
     setIsUploading(false)
   }
 }

 return (
   <div className="bg-white rounded-lg shadow-lg p-8">
     <div
       className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
         isDragging
           ? 'border-blue-500 bg-blue-50'
           : 'border-gray-300 hover:border-gray-400'
       }`}
       onDragOver={handleDragOver}
       onDragLeave={handleDragLeave}
       onDrop={handleDrop}
     >
       {isUploading ? (
         <div>
           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
           <p className="text-gray-600">Uploading your CV...</p>
         </div>
       ) : (
         <div>
           <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
           </svg>
           <p className="text-lg font-medium text-gray-900 mb-2">
             Drop your CV here or click to upload
           </p>
           <p className="text-sm text-gray-500 mb-4">
             PDF files only, maximum 200KB
           </p>
           <input
             type="file"
             accept=".pdf"
             onChange={handleFileSelect}
             className="hidden"
             id="cv-upload"
           />
           <label
             htmlFor="cv-upload"
             className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
           >
             Select CV File
           </label>
         </div>
       )}
     </div>
     {error && (
       <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
         <p className="text-red-600 text-sm">{error}</p>
       </div>
     )}
   </div>
 )
}
