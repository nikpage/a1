// pages/[user_id].js

import { useState, useEffect } from 'react'
import AnalysisDisplay from '../components/AnalysisDisplay'
import DocumentGenerator from '../components/DocumentGenerator'
import DashboardDisplay from '../components/DashboardDisplay';

export default function UserPage({ user_id }) {
  const [analysis, setAnalysis] = useState(null)

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        const res = await fetch('/api/get-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id })
        })

        const data = await res.json()
        setAnalysis(data.analysis)
      } catch (err) {
        setAnalysis('Failed to load analysis')
      }
    }
    if (user_id) fetchAnalysis()
  }, [user_id])

  return (
    <div>
      <AnalysisDisplay analysisText={analysis} user_id={user_id} />
  {typeof window !== 'undefined' && window.location.search.includes('success=true') ? (
    <DashboardDisplay />
  ) : (
    analysis && <DocumentGenerator user_id={user_id} />
  )}


    </div>
  )




}

export async function getServerSideProps(context) {
  const { user_id } = context.params
  return {
    props: { user_id },
  }
}
