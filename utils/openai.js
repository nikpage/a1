// utils/openai.js

import axios from 'axios'

export async function analyzeCvJob(cvText, jobText, fileName = 'unknown.pdf') {

  const systemMessage = {
    role: 'system',
    content: `You are a senior HR advisor with 15+ years of experience reviewing and optimizing CVs for Central/Eastern European tech roles. Be brutally honest, concise, and highly actionable.`
  }

  const hasJobText = typeof jobText === 'string' && jobText.trim().length > 20;
  const jobSection = hasJobText ? `### Step 5: Job Match Analysis

  **## Keyword Match**
  List job-ad skills/keywords and how well the CV aligns.

  **## Inferred Keywords**
  Suggest 5–10 extra keywords the CV should contain.

  **## Job Scenario**
  Compare CV to job. List: normal / pivot / overqualified — only if job ad is present.

  **## Positioning Strategy**
  Suggest any role/title changes or emphasis shifts to better match the job ad.

  **## Job Advertisement:**
  ${jobText}` : ''

  const userMessage = {
    role: 'user',
    content: `### CV Content:\n\n${cvText}

### Step 1: Scoring
**Overall Score (1–10):**
**ATS Compatibility (1–10):**

---

### Step 2: Scenario Tags
Identify *all applicable* from the CV. If job ad is present, also consider for pivot/overqualified.

**Scenario:**
- Options: older applicant, career start, returner, gap, normal
- If job ad is present, add: pivot, overqualified
- Multiple tags allowed (e.g., "Older + Gap")
- Do **not** use pivot/overqualified unless job ad supports it

---

### Step 3: CV Feedback

**## Quick Wins**
**IMPORTANT:**
- Do NOT use generic rewrite examples (e.g., "Led X..." or "Improved Y%...").
- Only rewrite actual phrases found in the provided CV.

3 fast, high-impact edits (same as before). Keep this short and punchy.

**## Red Flags**
**IMPORTANT:**
- Do NOT use generic rewrite examples (e.g., "Led X..." or "Improved Y%...").
- Only rewrite actual phrases found in the provided CV.

Move all critical concerns here (gaps, formatting, unclear roles, scenario justifications)

**## Cultural Fit**
Tips based on country format/style preferences.

**## Overall Commentary**
How does this CV come across? Typical, strong, uniquely qualified?
Summarise tone, clarity, professionalism.

**## Suitable Positions**
What roles is the candidate moderately / strongly / uniquely suited for?

**## Career Arc**
Summarise the visible trajectory or evolution in 1–2 lines.

**## Parallel Experience**
Mention any side projects, speaking, teaching, or advising that enhance credibility.

**## CV Style & Wording**
Review formatting, structure, phrasing, tone, grammar.

**## ATS Keyword Commentary**
Comment on keyword presence, clarity, sectioning, matchability.

---

### Step 4: Action Items
**IMPORTANT:**
- Do NOT use generic rewrite examples (e.g., "Led X..." or "Improved Y%...").
- Only rewrite actual phrases found in the provided CV.
Create a list of ALL specific changes from above.
Each must be tagged: **[Critical]**, **[Advised]**, or **[Optional]**
Keep this list clear and scannable.

---
${jobSection}
${hasJobText ? `\n**## Job Advertisement:**\n${jobText}` : ''}
---

### Tone
Be brutally honest but constructive.
Avoid filler praise. Always justify ratings or concerns.

### Output Format
Use all section headers (###, ##, -, etc) **exactly as shown**.
Do not skip or rename sections. No summary or intro text.`
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
  const prompt = `Generate a ${type} (CV and/or Cover Letter) in a ${tone} tone for the following candidate:\n\nCV:\n${cv}\n\nAnalysis:\n${analysis}`

  const response = await axios.post(
    process.env.DEEPSEEK_API_URL,
    {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: 'You are an expert in writing professional CVs and cover letters for CEE tech roles.'
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
  )

  const data = response.data
  const output = data.choices?.[0]?.message?.content || ''

  return {
    cv: output.includes('Cover Letter') ? output.split('Cover Letter')[0].trim() : output.trim(),
    cover: output.includes('Cover Letter') ? 'Cover Letter' + output.split('Cover Letter')[1].trim() : null
  }
}
