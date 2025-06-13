// app/components/JobAdInput.tsx
'use client'

interface JobAdInputProps {
  value: string
  onChange: (value: string) => void
  onAnalyze: () => void
  isAnalyzing: boolean
  disabled: boolean
}

export default function JobAdInput({ value, onChange, onAnalyze, isAnalyzing, disabled }: JobAdInputProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Job Advertisement (Optional)</h2>
      <p className="text-gray-600 mb-4">
        Paste the job description here for personalized optimization recommendations.
      </p>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste job description here..."
        className="w-full h-32 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        disabled={disabled}
      />

      <div className="mt-4">
        <button
          onClick={onAnalyze}
          disabled={isAnalyzing || disabled}
          className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isAnalyzing ? 'Analyzing...' : 'Analyze CV'}
        </button>
      </div>
    </div>
  )
}
