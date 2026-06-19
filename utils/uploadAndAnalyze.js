// path: utils/uploadAndAnalyze.js
export async function uploadAndAnalyze({ file, jobText, user_id, fallbackCvText, fallbackCreatedAt, onPing }) {
  let finalUserId = user_id ?? window.localStorage.getItem('user_id')
  let cvText = fallbackCvText || ''
  let createdAt = fallbackCreatedAt || null

  // Upload file if provided
  if (file) {
    const formData = new FormData()
    formData.append('file', file)
    if (finalUserId) formData.append('user_id', finalUserId)

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

  // Call analysis via SSE stream
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

  if (!analyzeRes.ok) {
    // Non-streaming error (rate limit, 4xx before SSE starts)
    const errData = await analyzeRes.json().catch(() => ({}))
    throw new Error(errData.error || `Analysis failed (${analyzeRes.status})`)
  }

  // Read SSE stream
  const reader = analyzeRes.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // Process complete SSE messages (terminated by \n\n)
    const parts = buffer.split('\n\n')
    buffer = parts.pop() // keep incomplete tail

    for (const part of parts) {
      const eventMatch = part.match(/^event:\s*(.+)$/m)
      const dataMatch  = part.match(/^data:\s*(.+)$/m)
      if (!eventMatch || !dataMatch) continue

      const event = eventMatch[1].trim()
      let payload
      try { payload = JSON.parse(dataMatch[1]) } catch { continue }

      if (event === 'ping' && typeof onPing === 'function') {
        onPing(payload)
      } else if (event === 'result') {
        return { user_id: finalUserId, analysis_id: payload.analysis_id }
      } else if (event === 'error') {
        throw new Error(payload.error || 'Analysis failed')
      }
    }
  }

  throw new Error('Analysis stream ended without a result')
}
