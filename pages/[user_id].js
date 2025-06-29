// pages/[user_id].js

import { useState, useEffect } from 'react'
import Header from '../components/Header'
import TabbedViewer from '../components/TabbedViewer'
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
      <Header />
      {analysis && <TabbedViewer user_id={user_id} analysisText={analysis} />}

    </div>
  )
}

export async function getServerSideProps(context) {
  const { user_id } = context.params
  return {
    props: { user_id },
  }
}
