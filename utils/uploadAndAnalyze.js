// path: utils/uploadAndAnalyze.js

export async function uploadAndAnalyze({ file, jobText, user_id, fallbackCvText, fallbackCreatedAt }) {
  let finalUserId = user_id
  let cvText = fallbackCvText || ''
  let createdAt = fallbackCreatedAt || null

  // Upload file if provided
  if (file) {
    const formData = new FormData()
    formData.append('file', file)

    const uploadRes = await fetch('/api/upload-cv', {
      method: 'POST',
      body: formData,
    })

    const uploadData = await uploadRes.json()
    if (!uploadRes.ok || !uploadData.user_id) {
      throw new Error(uploadData.error || 'Upload failed')
    }

    finalUserId = uploadData.user_id
  }

  // Call analysis
  const analyzeRes = await fetch('/api/analyze-cv-job', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: finalUserId,
      jobText,
      cv_data: cvText,
      created_at: createdAt,
    }),
  })

  const analyzeData = await analyzeRes.json()
  if (!analyzeRes.ok || analyzeData.error) {
    throw new Error(analyzeData.error || 'Analysis failed')
  }

  return { user_id: finalUserId, analysis_id: analyzeData.analysis_id }
}
