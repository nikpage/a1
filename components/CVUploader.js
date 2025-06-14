import { useRef } from 'react'
import { useRouter } from 'next/router'

export default function CVUploader({ setUploading, setError }) {
  const inputRef = useRef()
  const router = useRouter()

  const handleFile = async (file) => {
    setError('')
    if (!file || file.type !== 'application/pdf' || file.size > 200 * 1024) {
      setError('PDF only, max 200KB')
      return
    }
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/upload-cv', { method: 'POST', body: form })
    const data = await res.json()
    setUploading(false)
    if (data.user_id) router.push(`/${data.user_id}`)
    else setError(data.error || 'Upload failed')
  }

  return (
    <div className="flex flex-col gap-2 items-center">
      <input
        type="file"
        accept="application/pdf"
        ref={inputRef}
        className="hidden"
        onChange={e => handleFile(e.target.files[0])}
      />
      <button
        className="w-full py-2 rounded-xl bg-blue-600 text-white font-bold"
        onClick={() => inputRef.current.click()}
      >Upload CV (PDF, max 200KB)</button>
    </div>
  )
}
