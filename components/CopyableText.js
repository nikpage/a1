// components/CopyableText.js
import { useState } from 'react'

export default function CopyableText({ text, label, canDownload, onDownload, tokens }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="relative mt-4">
      <textarea
        className="w-full border rounded-xl p-2 bg-gray-50"
        value={text}
        readOnly
        rows={12}
        style={{ resize: 'vertical' }}
      />
      <div className="flex gap-2 mt-2">
        <button
          className="px-2 py-1 bg-blue-500 text-white rounded-lg"
          onClick={() => {
            navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 1000)
          }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button
          className={`px-2 py-1 rounded-lg font-bold ${tokens > 0 ? 'bg-green-600 text-white' : 'bg-gray-400 text-gray-100 cursor-not-allowed'}`}
          onClick={() => tokens > 0 && onDownload && onDownload(text, label)}
          disabled={tokens < 1}
        >
          {tokens > 0 ? `Download ${label} (1 token)` : 'Not enough tokens'}
        </button>
      </div>
    </div>
  )
}
