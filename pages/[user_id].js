// path: pages/[user_id].js

import { useState, useEffect } from 'react'
import Header from '../components/Header'
import TabbedViewer from '../components/TabbedViewer'

export default function UserPage({ user_id }) {
  const [analysis, setAnalysis] = useState(null)

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        const res = await fetch('/api/get-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id }),
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
    <>
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-10">
        {analysis && (
          <div className="border border-gray-200 rounded-lg shadow-sm p-6 bg-white">
            <TabbedViewer user_id={user_id} analysisText={analysis} />
          </div>
        )}
      </main>
    </>
  )
}

export async function getServerSideProps(context) {
  const { user_id } = context.params
  return {
    props: { user_id },
  }
}
