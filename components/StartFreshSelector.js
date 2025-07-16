// components/StartFreshSelector.js
import React from 'react'
import StartFreshHeader from './StartFreshHeader'

export default function StartFreshSelector({ onChooseDb, onChooseUpload, onClose }) {
  return (
    <StartFreshHeader mode="select" onClose={onClose}>
      <div className="mb-6 text-left">
        <p className="font-medium mb-2">What happens when you start fresh:</p>
        <ul className="space-y-2">
          <li className="flex items-center">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
            All current analyses will be deleted
          </li>
          <li className="flex items-center">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
            Your CV and cover letter will be removed
          </li>
          <li className="flex items-center">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
            You'll start with a clean slate for your new job application
          </li>
          <li className="flex items-center">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
            <strong>Your Uploaded CV will not be Affected</strong>
          </li>
        </ul>
      </div>
      <div className="flex space-x-4">
        <button
          className="flex-1 bg-white border border-gray-200 px-4 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          onClick={onChooseDb}
        >
          Continue with Uploaded CV
        </button>
        <button
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
          onClick={onChooseUpload}
        >
          Continue with NEW CV Upload
        </button>
      </div>
    </StartFreshHeader>
  )
}
