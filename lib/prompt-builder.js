// lib/prompt-builder.js
const detectCareerScenarios = () => [];

export const JSON_ONLY = 'Respond with valid, minified JSON.';

// ---- STUBS to prevent runtime crashes ----
const industryTemplates = {
  general: {
    norms: "General formatting norms",
    metrics: ["impact", "growth"]
  }
};

const countryNorms = {
  us: "Use US-style formatting"
};

const internationalPointers = {
  general: () => "Use clear formatting and localization best practices.",
  us: "Avoid including photos, age or marital status."
};

const europassGuidance = {
  structure: "Follow the Europass format for structure.",
  languages: "List all languages clearly.",
  skills: "Include a skills grid if relevant."
};

//=====================================================================================
// Tones the Professioanl Summary and Core skills
//=====================================================================================

export function buildToneRewritePrompt(combinedText, tone) {
  return `
Adjust the tone of the following text to be "${tone}" without changing its core meaning or removing any key details. Do not add new details or commentary.

FORMAT:
Professional Summary: <adjusted summary>
Core Skills: <comma-separated adjusted skills>

CONTENT:
${combinedText}

Respond strictly in the specified format.
`.trim();
}



//========================================================================================
//Builds CV
//========================================================================================
export function buildCVPrompt(originalCv, jobDetails, tone, metadata, feedbackData = null) {
  let promptBase = `You are an expert professional CV writer creating a tailored CV for a ${jobDetails.title || 'job'} position.

INSTRUCTIONS:
Use this content as the ONLY source of factual information:
${originalCv}

CRITICAL GUIDELINES:
1. NEVER invent jobs, qualifications, dates, or achievements not found in the source material.
2. DO completely transform the presentation - rewrite descriptions professionally to highlight achievements and impact.
3. Use powerful action verbs and quantify achievements where logical (numbers, percentages, monetary values).
4. Maintain accurate employment dates from the source material - do not create gaps that don't exist.
5. Create a cohesive career narrative that positions the candidate optimally for ${jobDetails.title || 'this role'}.
`;

  switch (tone) {
    case 'formal':
      promptBase += `\nUse a formal tone. Avoid contractions and casual language.`;
      break;
    case 'neutral':
      promptBase += `\nUse a balanced, professional tone.`;
      break;
    case 'casual':
      promptBase += `\nUse a conversational, friendly tone with professionalism.`;
      break;
    case 'cocky':
      promptBase += `\nUse a confident, bold tone bordering on arrogant. Don't be afraid to showcase impact. Use colloquialisms like "kick-ass", "rock-star", "shit-hot", "fan-fuckin-tastic", etc.`;
      break;
    default:
      if (tone) {
        promptBase += `\nTONE: Write in a ${tone} tone while maintaining professionalism.`;
      }
  }

  if (feedbackData) {
    promptBase += `
IMPORTANT FEEDBACK TO IMPLEMENT:
${feedbackData}

You MUST incorporate this feedback when rewriting the CV. Do not skip or ignore these points.`;
  }

  const careerScenarios = detectCareerScenarios(jobDetails, metadata, originalCv);

  if (careerScenarios.includes('recent_grad')) {
    promptBase += `
RECENT GRADUATE STRATEGY:
- Lead with education section and academic achievements
- Highlight relevant coursework, projects, and internships
- Emphasize transferable skills from academic and part-time work
- Transform class projects into professional accomplishments
- Showcase technical skills and digital literacy`;
  }

  if (careerScenarios.includes('pivot')) {
    promptBase += `
CAREER PIVOT STRATEGY:
- Focus 70% on transferable skills and 30% on domain-specific experience
- Translate industry jargon into target field terminology
- Reframe past achievements to show relevance to new field
- Emphasize adaptability, learning capacity, and cross-functional expertise
- Structure CV with skills section before experience to highlight transferable abilities`;
  }

  if (careerScenarios.includes('career_returner')) {
    promptBase += `
CAREER RETURNER STRATEGY:
- Maintain chronological integrity while emphasizing skills currency
- Include relevant activities during career break (volunteering, courses, projects)
- Focus on evergreen skills and enduring achievements
- Emphasize recent professional development and technology familiarity
- Use functional elements to highlight expertise without hiding timeline`;
  }

  if (careerScenarios.includes('older_applicant')) {
    promptBase += `
EXPERIENCED PROFESSIONAL STRATEGY:
- Focus on most recent 10-15 years of experience in detail
- Summarize earlier career achievements without dates if appropriate
- Emphasize adaptability, leadership, and current skills/technologies
- Remove graduation dates if they reveal age unnecessarily
- Highlight mentorship, wisdom, and strategic thinking as advantages`;
  }

  if (careerScenarios.includes('overqualified')) {
    promptBase += `
STRATEGIC POSITIONING STRATEGY:
- Align experience precisely to job requirements without overemphasizing excess qualifications
- Focus on achievements relevant to target role rather than higher-level responsibilities
- Emphasize motivation for this specific role and company
- Highlight adaptability and willingness to apply expertise in new contexts
- Frame extensive experience as bringing valuable perspective to the role`;
  }

  if (metadata) {
    promptBase += `\nCAREER NARRATIVE CONTEXT:`;
    if (metadata.career_arcs_summary) promptBase += `\nCareer Arc: ${metadata.career_arcs_summary}`;
    if (metadata.parallel_experiences_summary) promptBase += `\nParallel Experiences: ${metadata.parallel_experiences_summary}`;
    if (metadata.progression_patterns) promptBase += `\nProgression Pattern: ${metadata.progression_patterns}`;
    if (metadata.skill_evolution) promptBase += `\nSkill Evolution: ${metadata.skill_evolution}`;
    if (metadata.career_trajectory_analysis) promptBase += `\nTrajectory Analysis: ${metadata.career_trajectory_analysis}`;
  }

  if (jobDetails && jobDetails.description) {
    promptBase += `\nTARGET JOB DETAILS:\n${jobDetails.description}`;
  }

  promptBase += `

FORMAT: Create a professional CV with clear sections for  Experience, Education, and any other relevant categories. Use bullet points for achievements and experience. Replace <<SUMMARY_PLACEHOLDER>> and <<CORE_SKILLS_PLACEHOLDER>> in the final CV exactly with the provided, toned Professional Summary and Core Skills text.`;

  return promptBase;
}


//-----------------------------------------------------------------------------
// Builds a prompt for cover letter generation
//-----------------------------------------------------------------------------
export function buildCoverLetterPrompt(originalCv, jobDetails, tone, metadata = null, feedbackData = null) {
  let promptBase = `You are an expert cover letter writer. Write a compelling cover letter that showcases the candidate's qualifications for this specific role.\n\n`;

  switch (tone) {
    case 'formal':
      promptBase += `Use a formal tone. Avoid contractions and casual language. `;
      break;
    case 'neutral':
      promptBase += `Use a balanced, professional tone. `;
      break;
    case 'casual':
      promptBase += `Use a conversational, friendly tone with professionalism. `;
      break;
    case 'cocky':
      promptBase += `Use a confident, bold tone bordering on arrogant. Don't be afraid to showcase impact. Use colloquialisms like "kick-ass", "rock-star", "shit-hot", "fan-fuckin-tastic", etc`;
      break;
  }

  if (jobDetails.title || jobDetails.company || jobDetails.hiringManager || (jobDetails.keywords || []).length > 0) {
    promptBase += `\n\nTarget this letter for the following job:\n`;
    if (jobDetails.title) promptBase += `Position: ${jobDetails.title}\n`;
    if (jobDetails.company) promptBase += `Company: ${jobDetails.company}\n`;
    if (jobDetails.hiringManager) promptBase += `Hiring Manager: ${jobDetails.hiringManager}\n`;
    if ((jobDetails.keywords || []).length > 0) {
      promptBase += `Key skills to emphasize: ${jobDetails.keywords.join(', ')}\n`;
    }
  }

  // Enhanced narrative positioning using metadata
  if (metadata) {
    promptBase += `\n\nCandidate Positioning:\n`;
    if (metadata.career_arcs_summary) {
      promptBase += `Career Story: ${metadata.career_arcs_summary}\n`;
      promptBase += `Use this career progression to show how this role represents a natural next step.\n`;
    }
    if (metadata.parallel_experiences_summary) {
      promptBase += `Unique Value: ${metadata.parallel_experiences_summary}\n`;
      promptBase += `Leverage these cross-functional experiences to differentiate the candidate.\n`;
    }
    if (metadata.key_achievements?.length > 0) {
      promptBase += `Top Achievements: ${metadata.key_achievements.slice(0, 2).join(', ')}\n`;
      promptBase += `Select 1-2 most relevant achievements to highlight in the letter.\n`;
    }
  }

  let name = '', email = '', phone = '', link = '';
  const lines = originalCv.split('\n').map(line => line.trim()).filter(Boolean);
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const line = lines[i];
    if (!name && /^[A-Z][a-z]+\s[A-Z][a-z]+/.test(line)) name = line;
    if (!email && /\S+@\S+\.\S+/.test(line)) email = line;
    if (!phone && /(\+?\d{1,3}[\s.-]?)?(\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/.test(line)) phone = line;
    if (!link && /(linkedin\.com|http|www\.)/.test(line)) link = line;
  }

  const signature = ['\n\nBest regards,', name, phone, email, link]
    .filter(Boolean)
    .map(x => x.trim())
    .join('\n');

  promptBase += `\n\nNEVER use fake names like "Jane Doe" or emails like "jane.doe@email.com". If contact info or personal info is missing, OMIT it completely.`;

  promptBase += `\n\nStructure:
1. Greeting (use manager's name if available)
2. Opening paragraph: show interest and alignment
3. Body: highlight experience and fit for the role
4. Closing: express availability and intent
5. Signature with real contact info only

Keep the writing style consistent with a ${tone} tone. Do not include personal info in the header. Return only the final letter — no instructions or extra text.`;

  if (originalCv?.trim()) {
    promptBase += `

---

Here is the candidate's actual resume:

${originalCv}

---

Use only this content when writing the letter. Do not invent anything. Do not add any experience not found above.`;
  }

  promptBase += signature;

  return promptBase;
}

// ==================================================================================
// Job Ad extraction and career analysist
// ==================================================================================
export function buildExtractionPrompt(cvText, cvKeywords = [], jobText = '', jobKeywords = []) {
  // Ensure input arrays are actually arrays to prevent join errors if undefined/null
  const safeCvKeywords = Array.isArray(cvKeywords) ? cvKeywords : [];
  const safeJobKeywords = Array.isArray(jobKeywords) ? jobKeywords : [];

  return `
You are a professional career pivot and ATS optimization assistant.

Your job is to analyze the provided CV and job description below, and produce a comprehensive list of keywords for ATS optimization and career pivot scenarios, along with key job details.

**Your output must be a valid, minified JSON object matching this exact schema. Do not include any text before or after the JSON object itself:**
{
  "jobTitle": "[Extracted or Inferred Job Title or 'Not Found']",
  "companyName": "[Extracted or Inferred Company Name or 'Not Found']",
  "hrContact": "[Extracted or Inferred HR Contact Info (Name/Email/Title) or 'Not Found']",
  "jobKeywords": ["keyword1", "keyword2", ...],
  "cvKeywords": ["skill1", "skill2", ...],
  "suggestedKeywords": [
    { "keyword": "example1", "confidence": "high", "source": "direct_match" },
    { "keyword": "example2", "confidence": "medium", "source": "related_skill" },
    { "keyword": "core_skill_example", "confidence": "high", "source": "core_skill_match" }
  ],
  "careerAnalysis": {
    "careerDistance": "[Choose ONE: low, medium, or high]",
    "scenarios": ["[List one or more detected scenarios based on Guideline 8]"],
    "positioningStrategy": "[Brief strategic narrative, informed by detected scenarios]",
    "keyNarratives": ["[List 2-3 key themes/stories]"],
    "potentialConcerns": ["[List 1-2 potential concerns]"]
  },
  "rewrittenContent": {
    "Professional Summary": "...",
    "Core Skills": ["core_skill_example", "..."]
  },
  "validationReport": {
    "industryTermsReplaced": ["Original: 'X' → Replacement: 'Y'"],
    "dateReferencesRemoved": ["Example: 25 years"],
    "gapConversions": ["Original: 'X' → Rewrite: 'Y'"]
  }
}

**Guidelines:**
1️⃣ **Analyze Job Details:** Analyze and Understand the Job Description text to infer the Job Title, Company Name, and any HR Contact information. Populate \`jobTitle\`, \`companyName\`, and \`hrContact\`. Use 'Not Found' if information cannot be reasonably identified or inferred.
2️⃣ **Extract Job Keywords:** Extract keywords directly from the job description (explicit and inferred, up to 30).
3️⃣ **Merge Job Keywords:** Merge extracted keywords with provided job keywords for the final \`jobKeywords\` list.
4️⃣ **Use CV Keywords:** Use provided \`cvKeywords\` (if any) as-is (up to 30).
5️⃣ **Generate Suggested Keywords:** Generate \`suggestedKeywords\` by analyzing matches, synonyms, related concepts, and transferable skills between CV and job description.
6️⃣ **Add Transferable Skills:** Immediately add common transferable skills (leadership, teamwork, etc.) to \`suggestedKeywords\` with high confidence and source "transferable_skill".
7️⃣ **Classify Suggested Keywords:** Classify each suggested keyword by confidence ("high", "medium", "low") and source ("direct_match", "synonym", "related_skill", "career_pivot", "transferable_skill", "positioning_strategy", etc.).

8️⃣ **DETECT SCENARIOS:** Carefully compare the CV content/history against the target Job Description. Determine which scenario(s) apply based on these criteria:
    *   **PIVOT:** Detect if there's a significant difference between the candidate's primary historical industry/function (from CV) and the target job's industry/function, OR if the CV requires significant reframing/translation of skills for the target role.
    *   **OLDER APPLICANT:** Detect if the CV indicates a long career history (e.g., work experience spanning > 20-25 years, or graduation dates > 25 years ago). Consider this especially if applying for roles not explicitly requiring that level of seniority.
    *   **RETURNER:** Detect if the CV shows significant, unexplained employment gaps (e.g., **> 3 months**) that need addressing.  // <-- UPDATED HERE
    *   **RECENT GRAD:** Detect if the CV indicates recent graduation (within ~1-2 years) and limited post-graduation full-time professional experience.
    *   **NORMAL PROGRESSION:** If none of the above special scenarios are strongly indicated, assume normal career progression within a field.
    *   **Action:** Populate the \`careerAnalysis.scenarios\` list with the name(s) of ALL detected scenarios (e.g., ["PIVOT", "OLDER APPLICANT"] or ["NORMAL PROGRESSION"]). This determination MUST inform steps 9, 10, and 12.

9️⃣ **Analyze Career Positioning:** Provide strategic insights in the \`careerAnalysis\` object (distance, strategy, narratives, concerns), informed by the scenario(s) detected in step 8.
🔟 **Rewrite Content:** Based ONLY on the CV, target job, and the DETECTED SCENARIO(S) from step 8, rewrite the "Professional Summary" and list "Core Skills" in \`rewrittenContent\`. Apply the appropriate Scenario-Specific Rewriting Strategies. NEVER invent facts.
1️⃣1️⃣ **Synchronize Core Skills:** After generating \`rewrittenContent.Core Skills\`, review \`suggestedKeywords\`. For EACH skill in \`Core Skills\`, ensure it exists in \`suggestedKeywords\` with "high" confidence and source "core_skill_match" (add/update as needed).
1️⃣2️⃣ **Validation Report:** Populate \`validationReport\` based on rewriting actions, paying close attention to actions taken due to detected PIVOT, OLDER APPLICANT, or RETURNER scenarios from step 8.
1️⃣3️⃣ **Final Keyword Validation:** Re-read \`positioningStrategy\`. Ensure ALL key terms/skills mentioned exist in \`suggestedKeywords\` with "high" confidence. Add any missing ones per step 11 logic.
1️⃣4️⃣ **Output:** Output ONLY the final, valid, minified JSON object.

**Scenario-Specific Rewriting Strategies (Apply based on detection in Guideline 8):**
*   **PIVOT:** Replace industry titles with functional ones; translate tech skills; emphasize numeric management achievements; use target job's verbs/nouns.
*   **OLDER APPLICANT:** Use "extensive experience"; focus on recent 10-15 years; add modern skills from job ad; remove outdated tech (unless requested); potentially reframe very senior experience for a less senior role if applicable.
*   **RETURNER:** Address gap proactively (e.g., relevant activities, development); emphasize current skills.
*   **RECENT GRAD:** Lead with education/projects (framed professionally); emphasize internships/part-time work.
*   **NORMAL PROGRESSION:** Show growth, increasing responsibility, consistent skill development.

---
**CV Text:**
${cvText}
---
**CV Keywords Provided:**
${safeCvKeywords.join(', ') || 'None'}
---
**Job Description Text:**
${jobText}
---
**Job Keywords Provided:**
${safeJobKeywords.join(', ') || 'None'}
---
`.trim();
}

// ----------------------------------------------------------------------------
// Builds a prompt for translating content
export function buildTranslationPrompt(targetLanguage) {
  const languages = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    zh: 'Chinese',
  };
  const languageName = languages[targetLanguage] || targetLanguage;
  return `Translate the following text into ${languageName}.
Maintain the same formatting, structure, and professional tone of the original text.
Ensure that the translation sounds natural to native speakers.`;
}

// ----------------------------------------------------------------------------
// Builds a prompt for CV feedback analysis
export function buildCVFeedbackPrompt(documentType, targetIndustry = 'general', country = 'us', language = 'en', metadata = null) {
  const industry = industryTemplates[targetIndustry] || industryTemplates.general;
  const countryNorm = countryNorms[country] || `Use regionally appropriate formatting for ${country || 'the candidate\'s location'}.`;
  const atsThresholds = `(ATS Score: Poor <10 | Good 10-19 | Excellent 20+)`;

  const intlAdvice = typeof internationalPointers.general === 'function'
    ? internationalPointers.general(country)
    : internationalPointers.general;

  let promptBase = `Start with an honest, rigorous rating (1-5 stars - reserve 5 stars for truly exceptional CVs) followed by:\n
✨ [3 Quick Wins] - Easy fixes with big impact\n
🔍 [Deep Dive] - Thoughtful analysis on:\n
1. Formatting (${countryNorm})\n
2. ${industry.norms}\n
3. ATS Compatibility & Keyword optimization ${atsThresholds}\n
4. Achievement phrasing ("${industry.metrics.join('", "')}")\n
5. Career Storytelling - Evaluate the coherence of career arcs and how parallel experiences strengthen the candidate's value proposition.\n
🌍 [International Formatting] - ${
      internationalPointers[country] || intlAdvice
    }\n`;

  if (country === 'europass' || country === 'eu') {
    promptBase += `📋 [Europass Specific] - ${europassGuidance.structure}. ${europassGuidance.languages}. ${europassGuidance.skills}\n`;
  }

  // Enhanced analysis using pre-extracted metadata
  if (metadata) {
    promptBase += `\n**Career Analysis Context** (from metadata extraction):\n`;
    if (metadata.career_arcs_summary) {
      promptBase += `Career Arc: ${metadata.career_arcs_summary}\n`;
    }
    if (metadata.parallel_experiences_summary) {
      promptBase += `Cross-functional Value: ${metadata.parallel_experiences_summary}\n`;
    }
    if (metadata.seniority) {
      promptBase += `Current Seniority Level: ${metadata.seniority} (${metadata.years_experience} years experience)\n`;
    }
    if (metadata.key_achievements?.length > 0) {
      promptBase += `Key Achievements Available: ${metadata.key_achievements.join(', ')}\n`;
    }
    promptBase += `Build your analysis on this context rather than re-analyzing basic career progression. Focus on optimization opportunities.\n\n`;
  } else {
    promptBase += `\n**Special Focus**:
- Review the candidate's "Career Arcs Summary" and "Parallel Experiences Summary" provided in the metadata.
- Suggest how to best present their career growth and complementary skills in the CV.
- If helpful, recommend rephrasing or repositioning experiences for greater impact.\n\n`;
  }

  promptBase += `📋 [Action Points Summary] - Provide a numbered list of concrete next steps\n\n`;

  promptBase += `End with: "Want me to write you a fresh CV and cover letter based on these points?"\n\n`;

  promptBase += `Keep it:\n
✅ Honest and rigorous in scoring\n
✅ Specific to THIS CV (no generic advice)\n
✅ All examples drawn from actual CV content\n
✅ Specific to ${targetIndustry} needs\n
✅ Culturally appropriate for ${country}\n
✅ Focused on human-like reasoning, not mechanical keyword matching\n
✅ Practical and actionable for immediate improvements

IMPORTANT: All advice must be specific to the actual CV content. No generic suggestions.

Also generate (but don't show to user) a JSON object with CV rewriting instructions:
{
  "structure_changes": ["Move experience X to top of page 1", "Combine roles Y and Z into single entry", ...],
  "content_additions": ["Add quantified metric for project A", "Include language proficiency section", ...],
  "content_removals": ["Remove outdated skill X", "Cut detailed description of role Y", ...],
  "keyword_placements": ["Add 'Python' to skills section", "Include 'Agile' in project description for role Z", ...],
  "formatting_updates": ["Add professional photo top-right", "Use bullet points for achievements in role X", ...],
  "country_specific_actions": ["Include DOB for Romanian market", "Translate section headers to Polish", ...],
  "priority_order": ["action 1 - critical", "action 2 - important", "action 3 - nice to have", ...]
}`;

  return promptBase;
}

// ----------------------------------------------------------------------------
// Builds a prompt for CV metadata extraction
export function buildCVMetadataExtractionPrompt(text) {
  return `
Analyze the CV or LinkedIn profile text below with careful, human-like reasoning.
**Your tasks:**
- Identify and summarize the candidate's primary career arcs (growth paths, role evolutions, industry themes).
- Detect any significant parallel or crossover experiences (career pivots, complementary skill sets across industries).
- Infer seniority level from responsibilities and impact, not just titles.
- Estimate total years of experience accurately, accounting for overlaps or part-time work.
- Calculate employment gaps by analyzing dates between roles - look for gaps of 6+ months between jobs.
- Infer key industries, skills, achievements, certifications, and language proficiencies.
- Include a list of locations (countries/cities) as "places" based on text clues or reasonable inference.
- Infer a most-likely country the candidate is based in from recent roles or education.
- Include ISO 639-1 codes in "language_codes" if the language can be matched.
- Extract candidate's name, email, and phone number from contact information.
- Extract or infer graduation year from education details.
- Count internships, full-time roles, and senior-level positions mentioned.
- Infer career start year from earliest professional experience.
- Determine if candidate has management experience from job descriptions and responsibilities.
- Infer age range if possible from career timeline and education dates.
- Extract education start year if mentioned or inferable.
- Analyze career breaks and infer reasons where possible.
**Return ONLY a valid, minified JSON object matching EXACTLY this schema:**
{
  "name": "Full name of the candidate",
  "email": "Email address if mentioned",
  "phone": "Phone number if mentioned",
  "current_role": "Most recent or representative job title",
  "seniority": "Inferred seniority level (e.g., Entry, Mid, Senior, Executive)",
  "primary_company": "Most recent or primary company name",
  "current_industry": "Primary industry of most recent role (e.g., 'Fintech', 'Healthcare')",
  "career_arcs_summary": "Brief narrative describing main career arcs, highlighting growth and transitions",
  "parallel_experiences_summary": "Brief narrative highlighting any notable parallel or crossover experiences",
  "years_experience": "Total years of relevant experience (rounded to nearest 0.5)",
  "employment_gap_months": "Total months of employment gaps (6+ month gaps between roles), 0 if none",
  "career_break_reason": "Inferred reason for career breaks if applicable (e.g., 'Education', 'Family', 'Career transition', 'Unknown')",
  "industries": ["List of primary industries, e.g., 'Fintech', 'Healthcare'"],
  "education": ["Degrees and institutions with focus areas if available"],
  "graduation_year": "Year of most recent or highest degree graduation, null if not available",
  "education_start_year": "Year education started (earliest university/college start), null if not available",
  "skills": ["Comprehensive list of technical and soft skills"],
  "primary_skills": ["Top 5-7 most relevant/frequently mentioned skills"],
  "languages": ["Languages spoken with proficiency if mentioned"],
  "key_achievements": ["Awards, major projects, publications, or major contributions"],
  "certifications": ["Relevant certifications or licenses"],
  "internship_count": "Number of internships mentioned",
  "full_time_roles": "Number of full-time positions held",
  "senior_role_count": "Number of senior-level positions (Senior, Lead, Manager, Director, VP, C-level)",
  "has_management_experience": "Boolean - true if has managed teams or projects, false otherwise",
  "career_start_year": "Year of first professional role or internship",
  "age": "Estimated age range (e.g., '25-30', '30-35') or null if cannot be reasonably inferred",
  "places": ["Countries or cities mentioned or inferred"],
  "language_codes": ["ISO 639-1 language codes if known (e.g., 'en', 'cs')"],
  "country": "Best guess of candidate's main country of residence or career activity",
  "country_codes": ["ISO 3166-1 country codes if known (e.g., 'cz', 'de')"]
}
**Guidelines:**
- Infer and summarize career progression and transferable skills logically.
- If data is ambiguous, make reasonable assumptions favoring clarity.
- Exclude unrelated work gaps unless contributing valuable skills.
- For employment gaps: Only count significant gaps (6+ months) between professional roles. Ignore gaps due to education, military service, or clearly explained breaks.
- For age estimation: Use education timeline, career start date, and experience level to make reasonable inferences.
- For management experience: Look for keywords like "managed", "led team", "supervised", "director", "manager" or similar responsibilities.
- For role counting: Count distinct positions, not companies (same person can have multiple roles at one company).
- Respond ONLY with the JSON object — no intro, no explanation, no markdown.
---
CV or LinkedIn Profile:
${text}
Respond ONLY in the language used in the CV or LinkedIn profile.
`.trim();
}
