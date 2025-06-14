// utils/openai.js
import axios from 'axios'

function logTokenUsage(data) {
  if (!data || !data.usage) return
  console.log('DeepSeek token usage:')
  if (data.usage.prompt_cache_hit_tokens !== undefined)
    console.log('  cache hit tokens:', data.usage.prompt_cache_hit_tokens)
  if (data.usage.prompt_cache_miss_tokens !== undefined)
    console.log('  cache miss tokens:', data.usage.prompt_cache_miss_tokens)
  if (data.usage.completion_tokens !== undefined)
    console.log('  output tokens:', data.usage.completion_tokens)
  if (data.usage.total_tokens !== undefined)
    console.log('  total tokens:', data.usage.total_tokens)
}

export async function analyzeCV(cvText, jobText = '') {
  const messages = [
    { role: 'system', content: 'You are a professional CV analyst.' },
    { role: 'user', content: 'CV:\n' + cvText + (jobText ? '\nJob Description:\n' + jobText : '') }
  ]
  const { data } = await axios.post(process.env.DEEPSEEK_API_URL, {
    model: 'deepseek-chat',
    messages,
    stream: false
  }, {
    headers: {
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY_1}`,
      'Content-Type': 'application/json'
    }
  })
  logTokenUsage(data)
  return data
}

export async function generateCVAndCover(cvText, jobText) {
  const messages = [
    { role: 'system', content: 'You are a professional CV and cover letter writer.' },
    { role: 'user', content: 'CV:\n' + cvText + '\nJob Description:\n' + jobText }
  ]
  const { data } = await axios.post(process.env.DEEPSEEK_API_URL, {
    model: 'deepseek-chat',
    messages,
    stream: false
  }, {
    headers: {
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY_1}`,
      'Content-Type': 'application/json'
    }
  })
  logTokenUsage(data)
  return data
}
