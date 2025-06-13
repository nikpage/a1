// app/components/DocumentGenerator.tsx
interface DocumentGeneratorProps {
  onGenerate: () => void
  isGenerating: boolean
  hasDocuments: boolean
}

export default function DocumentGenerator({ onGenerate, isGenerating, hasDocuments }: DocumentGeneratorProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Generate Optimized Documents</h2>
      <p className="text-gray-600 mb-4">
        Create an optimized CV and cover letter based on the analysis recommendations.
      </p>

      <button
        onClick={onGenerate}
        disabled={isGenerating}
        className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isGenerating ? 'Generating Documents...' : hasDocuments ? 'Regenerate Documents' : 'Generate Documents'}
      </button>
    </div>
  )
}
