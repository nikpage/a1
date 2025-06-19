//  components/Header.js

import Image from 'next/image'

export default function Header({ tokens = null }) {
  return (
    <header className="w-full flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 mb-6">
      <div className="flex items-center">
        <Image src="/logo_cvprp+trans.png" alt="Logo" width={44} height={44} priority />
        <span className="ml-3 text-2xl font-bold text-gray-900">CVPRP</span>
      </div>
      {tokens !== null && (
        <div className="flex items-center text-gray-800 font-medium text-lg">
          <span className="mr-1">Tokens:</span>
          <span className="font-mono">{tokens}</span>
        </div>
      )}
    </header>
  )
}
