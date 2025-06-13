// app/components/AnalysisDisplay.tsx
import { CVAnalysis } from '../../types'

interface AnalysisDisplayProps {
  analysis: CVAnalysis
}

export default function AnalysisDisplay({ analysis }: AnalysisDisplayProps) {
  if (!analysis) return <div>No analysis available.</div>
  console.log("ANALYSIS DISPLAY PROPS:", analysis);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-6">CV Analysis Results</h2>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-medium text-gray-900 mb-2">Career Level</h3>
          <p className="text-gray-600 bg-blue-50 px-3 py-2 rounded">{analysis.career_level}</p>
        </div>

        <div>
          <h3 className="font-medium text-gray-900 mb-2">Scenario</h3>
          <p className="text-gray-600 bg-green-50 px-3 py-2 rounded">{analysis.scenario}</p>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="font-medium text-gray-900 mb-3">Key Strengths</h3>
        <ul className="list-disc list-inside space-y-1">
          {analysis.strengths.map((strength, index) => (
            <li key={index} className="text-gray-600">{strength}</li>
          ))}
        </ul>
      </div>

      <div className="mt-6">
        <h3 className="font-medium text-gray-900 mb-3">Skills Identified</h3>
        <div className="flex flex-wrap gap-2">
          {analysis.skills.map((skill, index) => (
            <span key={index} className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
              {skill}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <h3 className="font-medium text-gray-900 mb-3">Areas for Improvement</h3>
        <ul className="list-disc list-inside space-y-1">
          {analysis.gaps.map((gap, index) => (
            <li key={index} className="text-gray-600">{gap}</li>
          ))}
        </ul>
      </div>

      <div className="mt-6">
        <h3 className="font-medium text-gray-900 mb-3">ATS Optimization</h3>
        <ul className="list-disc list-inside space-y-1">
          {analysis.ats_recommendations.map((rec, index) => (
            <li key={index} className="text-gray-600">{rec}</li>
          ))}
        </ul>
      </div>

      {analysis.job_specific_insights && (
        <div className="mt-6">
          <h3 className="font-medium text-gray-900 mb-3">Job-Specific Insights</h3>
          <p className="text-gray-600 bg-yellow-50 p-4 rounded">{analysis.job_specific_insights}</p>
        </div>
      )}
    </div>
  )
}
