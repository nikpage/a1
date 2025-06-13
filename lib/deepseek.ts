// lib/deepseek.ts
export async function callDeepSeek(messages: any[]) {
  if (!process.env.DEEPSEEK_API_URL) {
    throw new Error('Missing DEEPSEEK_API_URL environment variable')
  }
  if (!process.env.DEEPSEEK_API_KEY_1) {
    throw new Error('Missing DEEPSEEK_API_KEY_1 environment variable')
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('Messages array is empty or invalid')
  }

  console.log('[DeepSeek] URL:', process.env.DEEPSEEK_API_URL)
  console.log('[DeepSeek] API Key Present:', !!process.env.DEEPSEEK_API_KEY_1)
  console.log('[DeepSeek] Payload:', JSON.stringify({
    model: 'deepseek-chat',
    messages,
    temperature: 0,
    max_tokens: 2000,
  }))

  const response = await fetch(process.env.DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY_1}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',      // <-- FIXED MODEL NAME
      messages,
      temperature: 0,
      max_tokens: 2000,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[DeepSeek] API error:', response.status, errorText)
    throw new Error(`DeepSeek API error: ${response.status} ${errorText}`)
  }

  const body = await response.text()
  return { body }
}
