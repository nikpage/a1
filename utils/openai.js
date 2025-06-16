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
  const systemMessage = {
    role: 'system',
    content: 'You are a senior CEE HR specialist with deep ATS knowledge. Analyze CVs for the Central/Eastern European tech market (Czechia, Poland, Hungary, Romania, Slovakia, Ukraine). Provide: 1) Overall score (1-10), 2) Top 3 strengths, 3) Top 2 weaknesses, 4) ATS optimization tips. Be brutally honest but constructive.'
  };

  const userMessage = {
    role: 'user',
    content: jobText
      ? `Analyze this CV for the following job:\n\nJOB DESCRIPTION:\n${jobText}\n\nCV:\n${cvText}`
      : `Analyze this CV for general CEE tech roles:\n\n${cvText}`
  };

  console.log('PROMPT:', JSON.stringify([systemMessage, userMessage], null, 2));

  try {
    const { data } = await axios.post(process.env.DEEPSEEK_API_URL, {
      model: 'deepseek-chat',
      messages: [systemMessage, userMessage],
      temperature: 0.3,
      max_tokens: 8000,
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY_1}`,
        'Content-Type': 'application/json'
      }
    });

    logTokenUsage(data);
    console.log('RESPONSE:', data); // already here
    return data;
  } catch (error) {
    console.error('DeepSeek API Error:', error.response?.data || error.message);
    throw new Error('Failed to analyze CV');
  }
}
