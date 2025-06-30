// utils/openai.js

import axios from 'axios'

export async function analyzeCvJob(cvText, jobText, fileName = 'unknown.pdf') {
  // DO NOT REMOVE THIS LINE OR MOVE IT
  const hasJobText = typeof jobText === 'string' && jobText.trim().length > 20;

  const systemMessage = {
    role: 'system',
    content: `You are a senior HR advisor with 15+ years of experience reviewing and optimizing CVs for Central/Eastern European tech roles. Be brutally honest, concise, and highly actionable.`
  }

  const userMessage = {
    role: 'user',
    content:
      `### CV Content:\n` +
      `${cvText}\n\n` +
      (hasJobText ? `### Job Advertisement:\n${jobText}\n\n` : '') +
      `### At a Glance\n` +
      `- 1–2 sentence summary of candidate fit.\n` +
      `- Specify exactly what the cover letter should address — no generic advice.\n\n` +
      `### Extracted CV Data\n` +
      `- **Full Name:**\n` +
      `- **Seniority:**\n` +
      `- **Industry:**\n` +
      `- **Country:**\n\n` +
      (hasJobText
        ? `### Extracted Job Metadata\n` +
          `- **Position/Title:**\n` +
          `- **Seniority:**\n` +
          `- **Company Name:**\n` +
          `- **Industry:**\n` +
          `- **HR Contact:**\n` +
          `- **Country:**\n\n`
        : '') +
      `### Quick Analysis\n` +
      `**Overall Score (1–10):**\n` +
      `**ATS Compatibility (1–10):**\n\n` +
      `**Scenario Tags:**\n` +
      `- Choose from: older, career start, returner, gap, normal\n` +
      `- If job ad present: pivot, overqualified\n` +
      `- Multiple allowed\n\n` +
      `**Quick Wins (3):**\n` +
      `Only rewrite actual phrases from the CV.\n\n` +
      `**Red Flags:**\n` +
      `Gaps, clarity issues, anything critical.\n\n` +
      `**Cultural Fit:**\n` +
      `Formatting/style tips for the CV's country.\n\n` +
      `**Overall Commentary:**\n` +
      `How does this CV come across?\n\n` +
      `**Suitable Positions:**\n` +
      `Strong/moderate/unique fit roles.\n\n` +
      `**Career Arc:**\n` +
      `Summarise growth path in 1–2 lines.\n\n` +
      `**Parallel Experience:**\n` +
      `Side work that boosts credibility.\n\n` +
      `**CV Style & Wording:**\n` +
      `Clarity, structure, tone, grammar.\n\n` +
      `**ATS Keyword Commentary:**\n` +
      `Coverage of relevant keywords.\n\n` +
      `**Action Items:**\n` +
      `All changes, tagged as [Critical], [Advised], or [Optional]\n\n` +
      (hasJobText
        ? `### Job Match Analysis\n` +
          `**Keyword Match:**\n` +
          `CV vs ad skills\n\n` +
          `**Inferred Keywords:**\n` +
          `5–10 extras to add\n\n` +
          `**Career Scenario:**\n` +
          `normal progression / pivot / extreme pivot / overqualified / return from gap >3 months / career start / older applicant\n\n` +
          `**Positioning Strategy:**\n` +
          `Suggest any shifts in role/title.\n` +
          `In 1–3 sentences, explain how to best position the applicant for the role.\n` +
          `Be strictly verifiable and truthful based on the CV content.\n` +
          `If it's an extreme pivot, emphasize transferable skills and allow more inventive but still truthful wording.\n\n`
        : '') +
      `### Tone\n` +
      `Be blunt but constructive. No filler praise.\n` +
      `Justify all ratings/flags.\n\n` +
      `### Output Rules\n` +
      `- Use compact formatting with **no empty lines** between bullet items or label-value pairs.\n` +
      `- Leave **one blank line only** between major sections.\n` +
      `- All sections must be tight, readable, and clean — no repeated blank lines.\n`
  };


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
    console.log('RESPONSE (truncated):', JSON.stringify(data).slice(0, 230) + '…', '| Size:', (JSON.stringify(data).length / 1024).toFixed(2), 'KB');

    return {
      choices: data.choices,
      output: data.choices?.[0]?.message?.content || ''
    }
  } catch (error) {
    console.error('DeepSeek API Error:', error.response?.data || error.message)
    throw error
  }
}
function toneInstructions(tone) {
  switch ((tone || '').toLowerCase()) {
    case 'formal':
      return "Use a professional, reserved style. Avoid slang. Clear and businesslike.";
    case 'friendly':
      return "Warm, approachable, positive. Slightly informal but still professional.";
    case 'confident':
      return "Assertive, self-promoting, positive, but not arrogant. Highlight strengths clearly.";
    case 'cocky':
      return "Borderline arrogant, punchy, use colloquialisms if relevant: 'shit-hot', 'kick-ass', 'rock star', 'BOOM!'. Walk the line between boldness and professionalism.";
    default:
      return "Professional default style.";
  }
}

export async function generateCV({ cv, analysis, tone }) {
  const prompt = `
# Task
Generate a new CV for the candidate in the "${tone}" tone, based ONLY on the provided CV and the analysis data. DO NOT invent or fabricate facts, roles, or skills not supported in the original CV. All claims must be fact-based.

# Rules
- Use the provided analysis to guide structure, emphasis, and keyword usage.
- Match and highlight ATS keywords from the analysis/job.
- Strictly adhere to the target country format and style from analysis.
- DO NOT introduce new work gaps or time gaps.
- Write in the "${tone}" tone: (${toneInstructions(tone)}).
- CV must perform extremely well if re-analyzed by our own analysis engine.
- Style can be creative and personalized (within the chosen tone) but factual accuracy is required.

# Inputs
## CV:
${cv}

## Analysis:
${analysis}

# Output
Return only the full, formatted CV. Do NOT include a cover letter or any extra commentary. No placeholders or fake data.
  `;

  const response = await axios.post(
    process.env.DEEPSEEK_API_URL,
    {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: 'You are an expert in writing professional CVs for CEE tech roles.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY_1}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const data = response.data;
  return data.choices?.[0]?.message?.content || '';
}

export async function generateCoverLetter({ cv, analysis, tone }) {
  const prompt = `
# Task
Write a cover letter in the "${tone}" tone for the following application, using only real facts from the CV and analysis. DO NOT invent or fabricate any information.

# Rules
- Use, IF PRESENT: Job Title, Company Name, HR Contact from the analysis. If missing, skip (no placeholders).
- Letter must sound like a natural, professional application in the selected tone (${toneInstructions(tone)}).
- Directly address critical scenario tags and red flags from the analysis.
- Make best use of the candidate's career arc, parallel experience, and position strategy as found in the analysis.
- No generic filler, no invented claims, no placeholders.
- Use ATS and matched keywords for the job, if provided.
- If the job ad is present, reference specific company and position as appropriate.

# Inputs
## CV:
${cv}

## Analysis:
${analysis}

# Output
Return only the cover letter, no commentary or extra text. Do NOT include the CV. No placeholders or fake data.
  `;

  const response = await axios.post(
    process.env.DEEPSEEK_API_URL,
    {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: 'You are an expert in writing professional cover letters for CEE tech roles.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY_1}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const data = response.data;
  return data.choices?.[0]?.message?.content || '';
}
