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
    content:`
You must return a strict JSON object only. No markdown tags, no commentary.

  ### Extracted CV Metadata
  - **Full Name:** Extract the applicant’s full name from the CV. Use best guess from heading or first section. Avoid email or initials.
  - **Country:** Extract the most likely country from any part of the CV or context.
  - **Industry:** Extract or infer the main industry from any relevant part of the CV.
  - **Seniority:** Extract or infer the candidate’s likely seniority or experience level.

  ${hasJobText ? `
  ### Extracted Job Metadata
  - **Position/Title:** Extract the most likely job title, even if phrased differently or not explicitly labeled.
  - **Company Name:** Extract the company, organization, or employer—use any reasonable mention, not just explicit "Company Name".
  - **HR Contact:** Extract any named contact, supervisor, or person mentioned—does not need to be labeled as HR.
  - **Country:** Extract the most likely country/location from any relevant context, not just a labeled field.
  - **Industry:** Infer the main industry from context and responsibilities, even if not labeled.
  - **Seniority:** Infer the most likely seniority/level for this job, using any available clues.
  ` : ''}

  ### CV Content:
  ${cvText}

  ${hasJobText ? `
  ### Job Advertisement:
  ${jobText}
  ` : ''}

  ### At a Glance
  - Give a 2–5 sentence summary of the candidate’s fit and what’s needed to get an interview.
  - Always suggest whether a targeted cover letter is recommended. If so, specify exactly what issues should be addressed—highlight strengths, address weaknesses, gaps, age, or any scenario tags present.

  ### Step 1: Scoring
  **Overall Score (1–10):**
  **ATS Compatibility (1–10):**

  ---

  ### Step 2: Scenario Tags
  Identify *all applicable* from the CV. If job ad is present, also consider for pivot/extreme pivot/overqualified.

  **Scenario:**
  - Options: older applicant, career start, returner, gap, normal
  - If job ad is present, add: pivot, extreme pivot, overqualified
  - Multiple tags allowed (e.g., "Older + Gap")
  - Do **not** use pivot/overqualified unless job ad supports it

  ---

  ### Step 3: Context Analysis

  **## Quick Wins**
  **IMPORTANT:**
  - Do NOT use generic rewrite examples (e.g., "Led X..." or "Improved Y%...").
  - Only rewrite actual phrases found in the provided CV.

  3-5 fast, high-impact edits (same as before). Keep this short and punchy.

  **## Red Flags**
  **IMPORTANT:**
  - Do NOT use generic rewrite examples (e.g., "Led X..." or "Improved Y%...").
  - Only rewrite actual phrases found in the provided CV.

  Move all critical concerns here (gaps, formatting, unclear roles, scenario justifications)

  **## Cultural Fit**
  Tips based on country CV & Cover letter  format/style preferences.

  **## Overall Commentary**
  How does this CV come across? Typical, strong, uniquely qualified?
  Summarise tone, clarity, professionalism.

  **## Suitable Positions**
  What roles is the candidate moderately / strongly / uniquely suited for?

  **## Career Arc**
  Summarise the visible trajectory or evolution in 1–4 lines.

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

  ${hasJobText ? `
  ### Step 5: Job Match Analysis

  **## Keyword Match**
  List job-ad skills/keywords and how well the CV aligns.

  **## Inferred Keywords**
  Suggest 5–10 extra keywords the CV should contain.

  **## Job Scenario**
  Compare CV to job. List: normal / pivot / overqualified — only if job ad is present.

  **## Positioning Strategy**
  Suggest any role/title changes or emphasis shifts to better match the job ad.
  ` : ''}

  ---

  ### Tone
  - Be brutally honest, not polite.
  - No filler. Justify all comments and scores.

  ### Output Format
  Return a strict JSON object only. No markdown, headers, or commentary.

  Top-level keys must be:
  - summary
  - cv_data
  - job_data
  - analysis
  - job_match

  Subkey structure and detailed instructions:

  cv_data:
    - Name: Replace "full name" label with "Name" (capitalized).
    - Order fields as: Name, Seniority, Industry, Country.
    - Values extracted directly from CV.

  job_data:
    - If job data is missing, omit entire job_data section.
    - Order fields as: Position, Seniority, Company, Industry, Country, HR Contact.
    - Values extracted directly from job ad.

  analysis:
    - overall_score (number 1–10)
    - ats_score (number 1–10)
    - scenario_tags (array of strings)
    - quick_wins (array of 3 specific phrase rewrites from CV)
    - red_flags (array of specific CV issues)
    - cultural_fit: Describe CV formatting style advice relevant to candidate's country (e.g., EU vs US formats). No personal commentary.
    - overall_commentary: Concise summary of CV tone and clarity.
    - suitable_positions: List roles directly extracted from CV content only.
    - career_arc: Concise factual career trajectory.
    - parallel_experience: List specific activities like speaking, mentoring; no commentary.
    - style_wording: Specific formatting, tone, phrasing, grammar suggestions relevant to CV. Avoid generic comments.
    - ats_keywords: Extract explicit skills and close synonyms from CV. If job ad present, include full and near-exact matches. Suggest realistic additions only.
    - action_items:
        - Separate CV and Cover Letter lists if relevant.
        - Each item specifies exact, actionable change.
        - Tag items: [Critical], [Advised], [Optional].
        - Example: "[Critical] Clarify employment gaps 2017–2019 with explanation in Cover Letter."

  job_match:
    - keyword_match: List concrete matched keywords.
    - inferred_keywords: List realistic suggested keywords.
    - career_scenario: Factual positioning summary.
    - positioning_strategy: 1–2 specific sentences with actionable advice.

  Return only valid JSON parsable by JSON.parse().
  Do not rename or omit any keys.


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
