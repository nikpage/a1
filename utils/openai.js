// utils/openai.js

import axios from 'axios'
import { KeyManager } from './key-manager.js';
const keyManager = new KeyManager();
export async function analyzeCvJob(cvText, jobText, fileName = 'unknown.pdf') {
  // DO NOT REMOVE THIS LINE OR MOVE IT
  const hasJobText = typeof jobText === 'string' && jobText.trim().length > 20;

  const systemMessage = {
    role: 'system',
    content: `You are an expert HR strategist and storyteller. Your role is to analyze a CV and job description, and then craft a narrative that is both an honest critique and an actionable roadmap for the candidate. Your feedback must be insightful, critical where necessary, but always empowering. You will identify weaknesses, but your primary goal is to provide a clear strategy for success. All of your output, including in the "cocky" tone, must be in the same language as the CV. If the job ad is in a different language, the CV's language takes precedence. You must strictly adhere to the provided input and not invent any information.

    NARRATIVE FLOW: Write each section to build the story - summary as engaging TL;DR, cv_data introduces the candidate, job_data shows their target, analysis evaluates their presentation, job_match shows the fit, final_thought provides motivation. Each field should feel like the next chapter in understanding this candidate.

    WRITING QUALITY: Always reference actual CV content, specific phrases, and real experiences. Never use generic examples. Be specific and actionable.`
  }

  //===============================================================================
  //                 Analysis Prompt
  //===============================================================================

  const userMessage = {
    role: 'user',
    content: `

  IMPORTANT: Always provide comprehensive action items, even for extreme career pivots or challenging matches. Focus on strategic reframing of experience.
  You must return a strict JSON object only. No markdown, headers, or commentary. Top-level keys must be:
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
    // Add after the Internal Scenario Assessment section:
    "Extreme Scenario Handling:
    * For EXTREME PIVOTS and challenging matches, you must still provide strategic, actionable advice. Never give up on a candidate.
    * Find creative ways to reframe experience (e.g., tech skills can apply to fishing: project management, problem-solving, equipment maintenance, data analysis for catch optimization).
    Action Items Instructions:
    - cv_changes.critical: List all **[Critical]** changes needed in the CV. ALWAYS provide items even for extreme pivots. Focus on: CV length issues, removing irrelevant sections, emphasizing transferable skills, adding relevant experience. Use actual phrases from the CV, not generic examples.
    - cv_changes.advised: List all **[Advised]** changes to the CV, including suggestions for rewording or adding details that would improve the clarity or impact of the CV. Only use actual phrases found in the CV.
    - cv_changes.optional: List all **[Optional]** improvements for the CV, such as minor style or design suggestions. Refer to actual phrases or sections from the CV.
    - cover_letter.critical: List all **[Critical]** points in the cover letter that must be addressed. Only use exact phrases from the cover letter.
    - cover_letter.advised: List all **[Advised]** improvements for the cover letter. Use actual phrases from the cover letter.
    - cover_letter.optional: List all **[Optional]** suggestions for improving the cover letter. Only refer to actual content in the cover letter.
  Return this JSON structure:

  {
    "summary": "An engaging 1-2 sentence TL;DR of the candidate's fit that makes readers want to dive deeper. Be honest about challenges but frame constructively.",
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
      "cv_format_analysis": "Assessment of CV length, structure, and appropriateness for target role and country. Flag if too long/short."
      "cultural_fit": "Assessment including CV format for target country, potential unconscious bias factors (career gaps, age indicators, name/location bias), market-specific expectations, and alignment with local CV/cover letter norms including length, format, first-page content, and style",
      "red_flags": ["array of critical issues with the CV"],
      "overall_commentary": "Summary of the CV's strengths and weaknesses",
      "suitable_positions": ["array of position types this candidate would suit"],
      "career_arc": "A 1-4 sentence, slightly flattering summary of the candidate's professional journey",
      "parallel_experience": "Mention side projects, speaking, etc., that add value. Include inferred keywords/skills",
      "transferable_skills": "Skills from other roles/industries that apply to target position, especially for career pivots. Reference specific CV experiences.",
      "style_wording": "Review of the CV's tone, clarity, and professionalism",
      "ats_keywords": "Analysis of the CV's optimization for automated systems, including exact matches, close synonyms (e.g., 'Frontend' vs 'FE', 'User Experience' vs 'UX'), and missing critical terms",
      "action_items": {
"cv_changes": {
  "critical": [],
  "advised": [],
  "optional": []
},
"cover_letter": {
  "critical": [],
  "advised": [],
  "optional": []
}
}
    },
    "job_match": {
      "keyword_match": "${hasJobText ? 'Detailed analysis: exact matches, close synonyms (e.g., \"Frontend\" vs \"FE\", \"User Experience\" vs \"UX\"), and missing critical terms from job requirements' : 'null'}",
      "inferred_keywords": "${hasJobText ? 'Array of keywords and synonyms that should be emphasized or added to improve job matching' : 'null'}",
      "career_scenario": "${hasJobText ? 'Normal/Pivot/Overqualified assessment' : 'null'}",
      "positioning_strategy": "${hasJobText ? 'Specific strategy using exact CV content - how to reframe experience, which skills to emphasize, story to tell. Reference actual CV phrases/experiences. For extreme pivot, suggest creative ways to reframe experience.' : 'null'}"
    },
    "final_thought": "Provide a final, encouraging, and actionable thought for the candidate that motivates them to take next steps."
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
          Authorization: `Bearer ${keyManager.getNextKey()}`,
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

    const fullPromptString = JSON.stringify([systemMessage, userMessage], null, 2);
console.log('PROMPT (first 500 chars):', fullPromptString.substring(0, 500) + (fullPromptString.length > 500 ? '...' : ''));
    const rawOutputString = data.choices?.[0]?.message?.content || '';
console.log('RAW JSON OUTPUT (first 500 chars):', rawOutputString.substring(0, 500) + (rawOutputString.length > 500 ? '...' : ''));

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
              JSON.parse(jsonOutput) // THIS LINE IS MOVED HERE FOR VALIDATION
              return {
                choices: data.choices,
                output: jsonOutput,
                usage: data.usage // This line remains if it was previously added
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
- IMPORTANT: Do NOT include any notes, explanations, summaries, or commentary. Your response must ONLY include the candidate's CV in standard CV format, with no trailing comments or remarks of any kind.


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
      Authorization: `Bearer ${keyManager.getNextKey()}`,
      'Content-Type': 'application/json'
    }
  }
);

const data = response.data;
console.log('DeepSeek token usage (Generate CV):')
if (data.usage.prompt_cache_hit_tokens !== undefined)
  console.log('  cache hit tokens:', data.usage.prompt_cache_hit_tokens)
if (data.usage.completion_tokens !== undefined)
  console.log('  completion tokens:', data.usage.completion_tokens)
console.log('  total tokens:', data.usage.total_tokens)

return {
  content: data.choices?.[0]?.message?.content || '',
  usage: data.usage
};
}
//===============================================================================
//         Cover Letter Prompt
//===============================================================================

export async function generateCoverLetter({ cv, analysis, tone }) {
  const todayString = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const prompt = `
# Task
Write a cover letter in the "${tone}" tone for the following application, using only real facts from the CV and analysis. DO NOT invent or fabricate any information.
All of your output, including in the "cocky" tone, must be in the same language as the CV. If the job ad is in a different language, the CV's language takes precedence.

# Rules
- The top of the letter should ONLY contain the date. DO NOT add the applicant's name or contact details (phone, email) at the top of the letter.
- The salutation must be "Dear [First Name] [Last Name]". If the contact name is not available, it must be "Dear Hiring Manager". Do not use titles like Mr., Ms., etc.
- The letter must end with a signature block in this exact format, using data from the CV:
Sincerely,

**[Applicant's Full Name]**
[Applicant's Telephone]
[Applicant's Email]
[Applicant's LinkedIn URL]
- No generic filler, no invented claims, no placeholders like [Company Address].

# Inputs
## CV:
${cv}

## Analysis:
${analysis}

# Output
Return only the cover letter. Start with the date, then the salutation, then the body, and end with the signature block as specified.
`;

  const response = await axios.post(
    process.env.DEEPSEEK_API_URL,
    {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: 'You are an expert in writing professional cover letters for CEE tech roles who follows formatting rules precisely.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    },
    {
      headers: {
        Authorization: `Bearer ${keyManager.getNextKey()}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const data = response.data;
  console.log('DeepSeek token usage (Generate Cover Letter):')
  if (data.usage.prompt_cache_hit_tokens !== undefined)
    console.log('  cache hit tokens:', data.usage.prompt_cache_hit_tokens)
  if (data.usage.completion_tokens !== undefined)
    console.log('  completion tokens:', data.usage.completion_tokens)
  console.log('  total tokens:', data.usage.total_tokens)

  const rawContent = data.choices?.[0]?.message?.content || '';

  // This regex is used to find and remove any line that looks like a date.
  const dateFilterRegex = /(January|February|March|April|May|June|July|August|September|October|November|December)|\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/i;

  // Clean up any stray placeholders and hallucinated dates from the AI.
  let processedContent = rawContent
    .split('\n')
    .filter(line => !line.trim().includes('[Company Address]'))
    .filter(line => !line.trim().includes('[Date]'))
    .filter(line => !dateFilterRegex.test(line.trim())) // Aggressively remove any line that contains a date
    .join('\n');

  // Add just the date value to the very top.
  processedContent = `${todayString}\n\n${processedContent.trim()}`;

  return {
    content: processedContent.trim(),
    usage: data.usage
  };
}
