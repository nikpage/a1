// utils/openai.js

import axios from 'axios'

export async function analyzeCvJob(cvText, jobText, fileName = 'unknown.pdf') {
  // DO NOT REMOVE THIS LINE OR MOVE IT
  const hasJobText = typeof jobText === 'string' && jobText.trim().length > 20;

  const systemMessage = {
    role: 'system',
    content: `You are an expert HR strategist and storyteller. Your role is to analyze a CV and job description, and then craft a narrative that is both an honest critique and an actionable roadmap for the candidate. Your feedback must be insightful, critical where necessary, but always empowering. You will identify weaknesses, but your primary goal is to provide a clear strategy for success. All of your output, including in the "cocky" tone, must be in the same language as the CV. If the job ad is in a different language, the CV's language takes precedence. You must strictly adhere to the provided input and not invent any information.`
  }

  //===============================================================================
  //                 Analysis Prompt
  //===============================================================================

  const userMessage = {
    role: 'user',
    content: `
  You must return a strict JSON object only. No markdown, headers, or commentary. All of your output, including in the "cocky" tone, must be in the same language as the CV. If the job ad is in a different language, the CV's language takes precedence.Top-level keys must be:
  - summary
  - cv_data
  - job_data
  - analysis
  - job_match

  CV Content:
  ${cvText}

  ${hasJobText ? `
  Job Advertisement:
  ${jobText}
  ` : ''}

  Analysis Instructions

  Internal Scenario Assessment (Do not output this section):
  * Assess the candidate and job (if present) to determine the following internal tags: older applicant, career start, returner, gap, normal, pivot, overqualified, extreme pivot.
  * An applicant can have multiple tags (e.g., older & pivot).
  * overqualified means the applicant has significantly more skills or experience than the job requires.
  * extreme pivot is for candidates making a major career change (e.g., from finance to fishing). This tag will allow for more creative advice later.
  * Assess the country based on job locations (cities or states):
    - If the CV mentions cities or job locations, flag the corresponding country.
    - If there are mixed countries (e.g., US cities in early career and other countries in recent experience), prioritize the most recent or frequent country based on job history.

  Return this JSON structure:

  {
    "summary": "A 1-2 sentence summary of the candidate's fit. Be honest, even if it's a poor match, but always frame it constructively.",
    "cv_data": {
      "Name": "Full name from CV",
      "Seniority": "Junior/Mid/Senior/Lead/Principal etc.",
      "Industry": "Tech/Finance/Healthcare etc.",
      "Country": "Country from CV"
    },
    "job_data": {
      "Position": "${hasJobText ? 'Position title from job ad' : 'null'}",
      "Seniority": "${hasJobText ? 'Junior/Mid/Senior/Lead/Principal etc.' : 'null'}",
      "Company": "${hasJobText ? 'Company name from job ad' : 'null'}",
      "Industry": "${hasJobText ? 'Industry from job ad' : 'null'}",
      "Country": "${hasJobText ? 'Country from job ad' : 'null'}",
      "HR Contact": "${hasJobText ? 'HR contact name if mentioned, otherwise null' : 'null'}"
    },
    "analysis": {
      "overall_score": "0-10",
      "ats_score": "0-10",
      "scenario_tags": ["array of applicable tags from internal assessment"],
      "quick_wins": ["array of immediate improvements"],
      "cultural_fit": "Assessment of cultural fit for target market, including CV and cover letter norms for the job country (if available) or the country inferred from the CV. This includes expectations on length, format, first-page content, and style typical for the country. Ensure the CV and cover letter align with the norms and expectations of the respective job market.",
      "red_flags": ["array of critical issues with the CV"],
      "overall_commentary": "Summary of the CV's strengths and weaknesses",
      "suitable_positions": ["array of position types this candidate would suit"],
      "career_arc": "A 1-4 sentence, slightly flattering summary of the candidate's professional journey",
      "parallel_experience": "Mention side projects, speaking, etc., that add value. Include inferred keywords/skills",
      "style_wording": "Review of the CV's tone, clarity, and professionalism",
      "ats_keywords": "Analysis of the CV's optimization for automated systems",
      "action_items": {
        "cv_changes": {
          "critical": [
            "List all **[Critical]** changes needed in the CV. These should be actual phrases or sections in the CV that require improvement, such as formatting errors, missing skills, or important experience omissions. Do not use generic examples. Include exact phrases found in the CV."
          ],
          "advised": [
            "List all **[Advised]** changes to the CV, including suggestions for rewording or adding details that would improve the clarity or impact of the CV. Only use actual phrases found in the CV."
          ],
          "optional": [
            "List all **[Optional]** improvements for the CV, such as minor style or design suggestions. Again, refer to actual phrases or sections from the CV."
          ]
        },
        "cover_letter": {
          "critical": [
            "List all **[Critical]** points in the cover letter that must be addressed. These could include lack of personalization, missing important details, or errors in structure. Do not use generic rewrite examples. Only use exact phrases from the cover letter."
          ],
          "advised": [
            "List all **[Advised]** improvements for the cover letter, such as suggestions for rephrasing or additional content that could make it stronger. Use actual phrases from the cover letter."
          ],
          "optional": [
            "List all **[Optional]** suggestions for improving the cover letter, such as style improvements or formatting changes. Only refer to actual content in the cover letter."
          ]
        }
      }
    },
    "job_match": {
      "keyword_match": "${hasJobText ? 'Analysis of how well CV keywords match job requirements' : 'null'}",
      "inferred_keywords": "${hasJobText ? 'Array of keywords that should be emphasized' : 'null'}",
      "career_scenario": "${hasJobText ? 'Normal/Pivot/Overqualified assessment' : 'null'}",
      "positioning_strategy": "${hasJobText ? 'Creative, actionable advice for positioning. For extreme pivot, suggest how to reframe experience' : 'null'}"
    },
    "final_thought": "Provide a final, encouraging, and actionable thought for the candidate."
  }
  `
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
    console.log('RAW JSON OUTPUT:', data.choices?.[0]?.message?.content)

    // Extract JSON from potential markdown code blocks
    let jsonOutput = data.choices?.[0]?.message?.content || ''

    // Remove markdown code blocks if present
    if (jsonOutput.includes('```json')) {
      jsonOutput = jsonOutput.replace(/```json\s*/, '').replace(/\s*```$/, '')
    } else if (jsonOutput.includes('```')) {
      jsonOutput = jsonOutput.replace(/```\s*/, '').replace(/\s*```$/, '')
    }

    // Trim whitespace
    jsonOutput = jsonOutput.trim()

    // Validate JSON before returning
    try {
      JSON.parse(jsonOutput) // This will throw if invalid JSON
      return {
        choices: data.choices,
        output: jsonOutput
      }
    } catch (jsonError) {
      console.error('Invalid JSON returned from API:', jsonError)
      console.error('Cleaned JSON output:', jsonOutput)
      throw new Error('API returned invalid JSON')
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
///===============================================================================
//                 CV Prompt
//===============================================================================
export async function generateCV({ cv, analysis, tone }) {
  const prompt = `
# Task
Generate a new CV for the candidate in the "${tone}" tone, based ONLY on the provided CV and the analysis data. DO NOT invent or fabricate facts, roles, or skills not supported in the original CV. All claims must be fact-based.
All of your output, including in the "cocky" tone, must be in the same language as the CV. If the job ad is in a different language, the CV's language takes precedence.

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
//===============================================================================
//                 Cover Letter Prompt
//===============================================================================
export async function generateCoverLetter({ cv, analysis, tone }) {
  const prompt = `
# Task
Write a cover letter in the "${tone}" tone for the following application, using only real facts from the CV and analysis. DO NOT invent or fabricate any information.
All of your output, including in the "cocky" tone, must be in the same language as the CV. If the job ad is in a different language, the CV's language takes precedence.
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
