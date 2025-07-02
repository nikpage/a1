// utils/openai.js

import axios from 'axios'

export async function analyzeCvJob(cvText, jobText, fileName = 'unknown.pdf') {
  // DO NOT REMOVE THIS LINE OR MOVE IT
  const hasJobText = typeof jobText === 'string' && jobText.trim().length > 20;

  const systemMessage = {
    role: 'system',
    content: `You are a senior HR advisor with 15+ years of experience reviewing and optimizing CVs for Central/Eastern European roles. Be brutally honest, concise, and highly actionable.`
  }

  const userMessage = {
    role: 'user',
    content: `
    You must return a strict JSON object only. No markdown tags, no commentary.

    IMPORTANT: All output (including all commentary, action items, CVs, and cover letters) must be written in the same language as the original CV, regardless of the language of the job ad. Never switch languages or translate unless explicitly instructed.

    IMPORTANT: Never discourage, refuse, or suggest not applying for any reason. Your ONLY task is to maximize the candidate’s application for THIS job, even if a poor fit. Every section (Quick Wins, Action Items, Positioning Strategy, etc.) must provide the most constructive, positive, and actionable advice possible, using only real information from the CV and analysis.

    ### Extracted CV Metadata
    - Full Name: Extract the applicant’s full name from the CV. Use best guess from heading or first section. Avoid email or initials.
    - Country: Extract the country where the candidate is currently based and/or where the majority of their *recent* (last 5–10 years) work experience is located. Ignore early career experience, nationality, or summary location unless all career stages are equally split. Use phone number and address only if recent work locations are unclear.
    - Industry: Extract or infer the main industry from any relevant part of the CV.
    - Seniority: Extract or infer the candidate’s likely seniority or experience level.

    ${hasJobText ? `
    ### Extracted Job Metadata
    - Position/Title: Extract the most likely job title, even if phrased differently or not explicitly labeled.
    - Company Name: Extract the company, organization, or employer—use any reasonable mention, not just explicit "Company Name".
    - HR Contact: Extract any named contact, supervisor, or person mentioned—does not need to be labeled as HR.
    - Country: Extract the most likely country/location from any relevant context, not just a labeled field.
    - Industry: Infer the main industry from context and responsibilities, even if not labeled.
    - Seniority: Infer the most likely seniority/level for this job, using any available clues.
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
    Overall Score (1–10):
    ATS Compatibility (1–10):

    ---

    ### Step 2: Scenario Tags
    Identify *all applicable* from the CV. If job ad is present, also consider for pivot/extreme pivot/overqualified.

    Scenario:
    - Options: normal / return after absence (>3 months) / career start–recent grad / older applicant / overqualified
    - If job ad is present, add: pivot / extreme pivot / overqualified
    - Multiple tags allowed (e.g., "older applicant + extreme pivot")
    - Use "overqualified" only if candidate clearly meets or exceeds all requirements and could do the job, but is much more senior.
    - Use "pivot" or "extreme pivot" when the candidate’s experience/skills are from a different field; use "extreme pivot" if there is zero direct match.
    - Do not use "overqualified" if the candidate cannot do the job due to lack of skills/domain match.

    ---

    ### Step 3: Context Analysis

    ## Quick Wins
    - REQUIRED: Always provide 3–5 actionable, high-impact edits or rewrites, even for extreme pivot/mismatch. If the CV has no directly relevant content for the job, select the strongest, most transferable achievements, skills, or phrasing (leadership, delivery, adaptability, etc.) from the CV.
    - Do NOT use generic rewrite examples (e.g., "Led X..." or "Improved Y%...").
    - Only rewrite actual phrases found in the provided CV.

    ## Suitable Positions
    List roles the candidate is moderately/strongly/uniquely suited for (from CV).

    ## Career Arc
    Summarize the visible trajectory or evolution in 1–4 lines.

    ## Parallel Experience
    Mention any side projects, speaking, teaching, or advising that enhance credibility, or broad soft skills (e.g., leadership, crisis management).

    ## Red Flags
    - Do NOT use generic rewrite examples.
    - Only use facts from the provided CV.
    - Move all critical concerns here (gaps, formatting, unclear roles, scenario justification, excessive length, poor structure).
    - For every red flag, add a corresponding Action Item.

    ## Cultural Fit
    Describe how the candidate would be perceived by a recruiter in the job country/market, including CV and cover letter norms.
    For pivots/extreme pivots, note if the career move is typical/accepted in the relevant country (e.g., US allows midlife pivots).

    ## Positioning Strategy
    Always write 2–4 sentences that make the strongest honest argument for why the candidate’s experience, skills, or motivation could be valuable or unique for this role—even for extreme pivot/mismatch.

    ## Style & Wording
    - REQUIRED: Bullet-point list. Each suggestion is a distinct bullet point, tagged as [Critical], [Advised], or [Optional].
    - Always include [Critical] for CVs over 3 pages (unless academic) and for structure issues.
    - Suggestions must address job relevance, not just generic CV standards. Tailor advice to both the candidate’s field AND the target job field.

    ## ATS Keyword Commentary
    Comment on keyword presence, clarity, sectioning, and matchability.

    ## Overall Commentary
    How does this CV come across? Typical, strong, uniquely qualified? Summarize tone, clarity, professionalism.

    ---

    ### Step 4: Action Items
    - REQUIRED: Always provide a list, never empty.
    - Never suggest “do not apply” or “do not submit a cover letter.” All advice must be positive, focused on how to reframe, reposition, and strengthen the candidate’s application for THIS job.
    - Separate into two sections: "CV Action Items" and "Cover Letter Action Items". An item may appear in both if relevant.
    - Each item must be actionable, clear, and tagged [Critical], [Advised], or [Optional].
    - If no job relevance, give the most strategic/transferable improvement for an extreme pivot—do not skip.
    - Example:
      - CV Action Items:
        - [Critical] Reduce CV to maximum 3 pages.
        - [Advised] Emphasize leadership and adaptability.
        - [Optional] Highlight any cross-industry collaboration.
      - Cover Letter Action Items:
        - [Critical] Explain motivation for industry switch.
        - [Advised] Focus on transferable problem-solving skills.

    ---

    ${hasJobText ? `
    ### Step 5: Job Match Analysis

    ## Keyword Match
    List job-ad skills/keywords and how well the CV aligns.

    ## Inferred Keywords
    Suggest 5–10 extra keywords the CV should contain.

    ## Job Scenario
    Compare CV to job. List: normal / pivot / extreme pivot / overqualified — only if job ad is present.
    - See above for correct use of tags.

    ## Positioning Strategy
    Write 2–4 sentences on how the candidate could maximize their fit, especially for pivot/extreme pivot cases. Be creative, but stick to facts.
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
      - cultural_fit: Describe CV formatting style advice and recruiter perception, including for pivots/extreme pivots in target country.
      - overall_commentary: Concise summary of CV tone and clarity.
      - suitable_positions: List roles directly extracted from CV content only.
      - career_arc: Concise factual career trajectory.
      - parallel_experience: List specific activities like speaking, mentoring, leadership, or other soft skills; no commentary.
      - style_wording: Specific formatting, tone, phrasing, grammar suggestions relevant to CV. Avoid generic comments. Flag excessive length and structure issues as [Critical].
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
      - positioning_strategy: 2–4 specific sentences with actionable advice, including creative reframing for pivots/extreme pivots.

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
  You must return a strict JSON object only. No markdown tags, no commentary.

  IMPORTANT: All output (including all commentary, action items, CVs, and cover letters) must be written in the same language as the original CV, regardless of the language of the job ad. Never switch languages or translate unless explicitly instructed.

  # Task
  Generate a new CV for the candidate in the "${tone}" tone, using ONLY real facts from the original CV and the provided analysis. Do NOT invent or fabricate facts, roles, or skills. All claims must be fact-based.

  # Rules
  - You MUST address and implement every [Critical] and [Advised] Action Item and Red Flag from the analysis.
  - Use the analysis to guide structure, summary content, ATS keyword usage, formatting, tone, country conventions, and positioning strategy.
  - Highlight all Quick Wins and match all ats_keywords from the analysis.
  - Reflect the career_arc and parallel_experience fields in the CV summary or experience as appropriate.
  - Strictly follow formatting, length, and structure recommendations in analysis.style_wording and cultural_fit.
  - DO NOT introduce any new work gaps or time gaps.
  - Write in the "${tone}" tone: (${toneInstructions(tone)}).
  - The generated CV must score highly if re-analyzed by our own analysis engine.
  - No generic filler, no placeholders, no extra commentary, no invented data.

  # Inputs
  ## CV:
  ${cv}

  ## Analysis:
  ${analysis}

  # Output
  Return only the full, formatted CV. No cover letter or extra commentary. No placeholders or fake data.
  `;

  const response = await axios.post(
    process.env.DEEPSEEK_API_URL,
    {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: 'You are an expert in writing professional CVs for CEE  roles.'
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
  You must return a strict JSON object only. No markdown tags, no commentary.

  IMPORTANT: All output (including all commentary, action items, CVs, and cover letters) must be written in the same language as the original CV, regardless of the language of the job ad. Never switch languages or translate unless explicitly instructed.

  # Task
  Write a cover letter in the "${tone}" tone for the following application, using ONLY real facts from the CV and analysis. DO NOT invent or fabricate any information.

  # Rules
  - The cover letter must be under 300 words and no more than 4 short paragraphs.
  - Use short, direct sentences.
  - Focus on 2–3 key achievements most relevant to the job.
  - Include one short, specific anecdote from the candidate’s real experience that highlights a relevant skill or achievement.
  - Directly implement every [Critical] and [Advised] Action Item and address all Red Flags from the analysis.
  - Use Job Title, Company Name, and HR Contact from analysis if present (otherwise skip).
  - Use ATS keywords, Quick Wins, career_arc, parallel_experience, scenario_tags, and positioning_strategy from analysis.
  - Letter must sound like a natural, professional application in the selected tone (${toneInstructions(tone)}), reflecting all style and country recommendations from analysis.
  - Avoid generic filler, invented claims, or placeholders.
  - Avoid repeating details from the CV; focus on unique selling points and motivation.
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
          content: 'You are an expert in writing professional cover letters for CEE roles.'
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
