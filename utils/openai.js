import axios from 'axios'

export async function analyzeCvJob(cvText, jobText) {
  const systemMessage = {
    role: 'system',
    content: 'You are a senior CEE HR specialist with deep ATS knowledge. Analyze CVs for the Central/Eastern European tech market (Czechia, Poland, Hungary, Romania, Slovakia, Ukraine). Provide: 1) Overall score (1-10), 2) Top 3 strengths, 3) Top 2 weaknesses, 4) ATS optimization tips. Be brutally honest but constructive.'
  }

  const userMessage = {
    role: 'user',
    content: jobText
      ? `Analyze this CV for the following job:\n\nJOB DESCRIPTION:\n${jobText}\n\nCV:\n${cvText}`
      : `Analyze this CV for general CEE tech roles:\n\n${cvText}`
  }

  try {
    const response = await axios.post(
      process.env.DEEPSEEK_API_URL,
      {
        model: 'deepseek-chat',
        messages: [systemMessage, userMessage]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY_1}`,
          'Content-Type': 'application/json'
        }
      }
    )

    const data = response.data

    console.log('DeepSeek token usage:')
    if (data.usage.prompt_cache_hit_tokens !== undefined)
      console.log('  cache hit tokens:', data.usage.prompt_cache_hit_tokens)
    if (data.usage.prompt_cache_miss_tokens !== undefined)
      console.log('  cache miss tokens:', data.usage.prompt_cache_miss_tokens)
    if (data.usage.completion_tokens !== undefined)
      console.log('  completion tokens:', data.usage.completion_tokens)
    console.log('  total tokens:', data.usage.total_tokens)

    console.log('PROMPT:', JSON.stringify([systemMessage, userMessage], null, 2))
    console.log('RESPONSE:', data)

    return {
  choices: data.choices,
  output: data.choices?.[0]?.message?.content || ''
}
  } catch (error) {
    console.error('DeepSeek API Error:', error.response?.data || error.message)
    throw error
  }
}
export async function generateDocuments({ cv, analysis, tone, type }) {
  const prompt = `Generate a ${type} (CV and/or Cover Letter) in a ${tone} tone for the following candidate:\n\nCV:\n${cv}\n\nAnalysis:\n${analysis}`;

  const response = await axios.post(
    process.env.DEEPSEEK_API_URL,
    {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: 'You are an expert in writing professional CVs and cover letters for CEE tech roles.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY_1}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const data = response.data;
  const output = data.choices?.[0]?.message?.content || '';

  return {
    cv: output.includes('Cover Letter') ? output.split('Cover Letter')[0].trim() : output.trim(),
    cover: output.includes('Cover Letter') ? 'Cover Letter' + output.split('Cover Letter')[1].trim() : null,
  };
}
