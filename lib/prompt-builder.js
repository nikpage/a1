// File: js/prompt-builder.js

export const JSON_ONLY = 'Respond with valid, minified JSON.';

// ---- STUBS to prevent runtime crashes ----
const industryTemplates = { general: { norms: "General formatting norms", metrics: ["impact", "growth"] } };
const countryNorms = { us: "Use US-style formatting" };
const internationalPointers = {
  general: () => "Use clear formatting and localization best practices.",
  us: "Avoid including photos, age or marital status."
};
const europassGuidance = {
  structure: "Follow the Europass format for structure.",
  languages: "List all languages clearly.",
  skills: "Include a skills grid if relevant."
};

// ----------------------------------------------------------------------------
// Builds a prompt for CV generation

export function buildCVPrompt(tone, jobDetails, originalCv = '', metadata = null, feedbackData = null) {
  let promptBase = `You are a professional CV writer. Create a strong CV based on the candidate's real information and experience. `;

  // Add semantic analysis instructions
  promptBase += `
🧠 SEMANTIC ANALYSIS REQUIRED:
Before writing, analyze if this is a career pivot situation:
- Does the target job (${jobDetails.title || 'the role'}) represent a significant career change from their current field?
- Are they moving between fundamentally different industries or job functions?
- Would their current CV sound misaligned if used as-is for this role?
If YES (this is a pivot): Focus on TRANSFERABLE skills and experiences. Reframe their background to show relevance to the new field. Remove industry-specific jargon. Write a professional summary that positions them as transitioning INTO this new field.
If NO (career progression): Optimize their existing narrative for the target role while maintaining their professional trajectory.
CRITICAL: Use only real information from their CV. Never invent experience. But DO reframe and recontextualize their actual experience to show relevance.`;

  // Detect special scenarios
  const isRecentGrad = detectRecentGraduate(metadata);
  const isCareerReturner = detectCareerReturner(metadata);

  switch(tone) {
    case 'formal':
      promptBase += `Use a formal, professional tone with traditional formatting. Avoid contractions and casual language. `;
      break;
    case 'neutral':
      promptBase += `Use a balanced, professional tone that is neither too formal nor too casual. `;
      break;
    case 'casual':
      promptBase += `Use a conversational, approachable tone while maintaining professionalism. Feel free to use contractions and show some personality. `;
      break;
    case 'cocky':
      promptBase += `Use a confident, bold tone bordering on arrogant. Don't be afraid to showcase impact. Use colloquialisms like "kick-ass", "rock-star", "shit-hot", "Badass","dope","sick","legend", "nails", "banging", "off the chain", etc`;
      break;
  }

  // Handle different career scenarios
  if (isRecentGrad) {
    promptBase += handleRecentGraduate(jobDetails, metadata);
  } else if (isCareerReturner) {
    promptBase += handleCareerReturner(jobDetails, metadata);
  } else {
    promptBase += handleCareerProgression(jobDetails, metadata);
  }

  promptBase += `\n\nNEVER invent placeholder data. If name, email, phone, or location are missing, OMIT them. Do NOT use fake names like "John Doe" or addresses like "123 Main Street".`;

  promptBase += `\n\nFormat the CV with clear section headings and bullet points for readability. Include:
1. Professional Summary
2. Work Experience (reverse chronological)
3. Education
4. Skills
5. Any other relevant sections based on the candidate's real background

Keep the writing style consistent with a ${tone} tone. Human-sounding, concise, achievement-focused. Return only the CV — no commentary, no notes.`;

  if (originalCv?.trim()) {
    promptBase += `

---

Here is the candidate's original CV:
${originalCv}

---

Use only this content when writing the CV. Do not invent anything. Do not add any experience not found above.`;
  }

  return promptBase;
}

// Detect recent graduate (limited experience)
function detectRecentGraduate(metadata) {
  if (!metadata) return false;
  return metadata.years_experience <= 2 || metadata.seniority === 'Entry';
}

// Detect career returner (employment gap)
function detectCareerReturner(metadata) {
  if (!metadata) return false;
  return metadata.employment_gap_months >= 12;
}

// Handle recent graduate
function handleRecentGraduate(jobDetails, metadata) {
  let gradText = `\n\n🎓 RECENT GRADUATE DETECTED: Limited professional experience.\n\n`;

  gradText += `RECENT GRAD INSTRUCTIONS:
1. **Education First**: Consider putting education before or alongside experience
2. **Maximize Everything**: Internships, projects, part-time work, volunteering - make it all count
3. **Skills-Based Approach**: Lead with what they can do, not years of experience
4. **Academic Achievements**: Include relevant coursework, projects, GPA if strong (3.5+)
5. **Potential Over Experience**: Focus on learning ability, fresh perspective, energy

`;

  if (jobDetails.title) {
    gradText += `Entry-level targeting for: ${jobDetails.title}\n`;
    gradText += `Show how their education and any experience (however limited) prepares them for this specific role.\n`;
  }

  return gradText;
}

// Handle career returner
function handleCareerReturner(jobDetails, metadata) {
  let returnerText = `\n\n🔄 CAREER RETURNER DETECTED: Employment gap of ${metadata?.employment_gap_months || 'extended'} months.\n\n`;

  returnerText += `CAREER RETURNER INSTRUCTIONS:
1. **Address the Gap**: Brief, positive explanation if context is clear (parental leave, education, care responsibilities)
2. **Emphasize Retained Skills**: Show that core competencies remain strong despite time away
3. **Highlight Relevant Activities**: Any freelancing, volunteering, courses, or projects during the gap
4. **Show Readiness**: Demonstrate enthusiasm and preparedness to return to full-time work
5. **Recent First**: Lead with most recent experience before the gap to show capability level

`;

  if (jobDetails.title) {
    returnerText += `Returning to field as: ${jobDetails.title}\n`;
    returnerText += `Position them as someone bringing fresh perspective after valuable life experience.\n`;
  }

  return returnerText;
}

// Handle normal career progression
function handleCareerProgression(jobDetails, metadata) {
  let progressText = `\n\nOptimize this CV for career progression:\n`;

  if (jobDetails.title || jobDetails.company || (jobDetails.keywords || []).length > 0) {
    if (jobDetails.title) progressText += `Position: ${jobDetails.title}\n`;
    if (jobDetails.company) progressText += `Company: ${jobDetails.company}\n`;
    if (jobDetails.seniority && metadata?.seniority) {
      progressText += `Target Role Level: ${jobDetails.seniority}\n`;
      progressText += `Candidate Current Level: ${metadata.seniority}\n`;
      if (jobDetails.seniority !== metadata.seniority) {
        progressText += `Position this candidate strategically for the level transition while staying truthful to their experience.\n`;
      }
    }
    if ((jobDetails.keywords || []).length > 0) {
      progressText += `Key skills to emphasize: ${jobDetails.keywords.join(', ')}\n`;
      progressText += `Strategically incorporate these key skills throughout the CV where relevant.\n`;
    }
  }

  // Add metadata-based enhancements
  if (metadata) {
    progressText += `\nCareer Narrative Context:\n`;
    if (metadata.career_arcs_summary) {
      progressText += `Career Arc: ${metadata.career_arcs_summary}\n`;
    }
    if (metadata.parallel_experiences_summary) {
      progressText += `Cross-functional Value: ${metadata.parallel_experiences_summary}\n`;
    }
    if (metadata.key_achievements?.length > 0) {
      progressText += `Key Achievements to Highlight: ${metadata.key_achievements.slice(0, 3).join(', ')}\n`;
    }
    progressText += `Use this career narrative to ensure the CV tells a coherent story of professional growth.\n`;
  }

  return progressText;
}

// ----------------------------------------------------------------------------
// Builds a prompt for cover letter generation
export function buildCoverLetterPrompt(tone, jobDetails, originalCv = '', metadata = null, feedbackData = null) {
  let promptBase = `You are a professional cover letter writer. Create a compelling letter based on the candidate's actual experience. `;

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

// ----------------------------------------------------------------------------
// Builds a prompt for extracting job metadata from a job posting
export function buildExtractionPrompt(text) {
  return `You are an intelligent extraction assistant.

ONLY output valid minified JSON. No text, no explanation, no code blocks, no formatting.

Return exactly:
{
  "title": "Job title",
  "company": "Company name",
  "seniority": "Entry|Mid|Senior|Executive based on role requirements and responsibilities",
  "hiringManager": "Hiring manager name or null",
  "keywords": ["keyword1", "keyword2", "... up to 6"]
}

Extract:
- "title": most accurate job title.
- "company": employer's name.
- "seniority": analyze the role requirements, years of experience needed, and level of responsibility to determine Entry/Mid/Senior/Executive level.
- "hiringManager": recruiter's or manager's full name, else null.
- "keywords": important skills, tools, specialties (max 6).

Here is the job description to extract from:
---
${text}
---

Respond ONLY with the JSON object. No comments, no intro, no markdown.
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
  return `Analyze the CV or LinkedIn profile text below with careful, human-like reasoning.
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
**Return ONLY a valid, minified JSON object matching EXACTLY this schema:**
{
  "full_name": "Full name as listed or inferred, or 'Not Found' if missing",
  "phone": "Phone number if found, or 'Not Found'",
  "email": "Email address if found, or 'Not Found'",
  "current_role": "Most recent or representative job title",
  "seniority": "Inferred seniority level (e.g., Entry, Mid, Senior, Executive)",
  "primary_company": "Most recent or primary company name",
  "career_arcs_summary": "Brief narrative describing main career arcs, highlighting growth and transitions",
  "parallel_experiences_summary": "Brief narrative highlighting any notable parallel or crossover experiences",
  "years_experience": "Total years of relevant experience (rounded to nearest 0.5)",
  "employment_gaps": [
    {
      "start": "YYYY-MM (gap start)",
      "end": "YYYY-MM (gap end)",
      "months": 7
    }
    // One entry for each gap of 6+ months, empty array if none
  ],
  "industries": ["List of primary industries, prefix with '*' if inferred"],
  "education": ["Degrees and institutions with focus areas if available"],
  "skills": ["Comprehensive list of technical and soft skills, prefix with '*' if inferred"],
  "languages": ["Languages spoken with proficiency if mentioned"],
  "key_achievements": ["Awards, major projects, publications, or major contributions"],
  "certifications": ["Relevant certifications or licenses, prefix with '*' if inferred"],
  "places": ["Countries or cities mentioned or inferred, prefix with '*' if inferred"],
  "language_codes": ["ISO 639-1 language codes if known (e.g., 'en', 'cs')"],
  "country": "Best guess of candidate's main country of residence or career activity",
  "country_codes": ["ISO 3166-1 country codes if known (e.g., 'cz', 'de')"]
}
**Guidelines:**
- Infer and summarize career progression and transferable skills logically.
- If data is ambiguous, make reasonable assumptions favoring clarity.
- Exclude unrelated work gaps unless contributing valuable skills.
- For employment gaps: Only count significant gaps (6+ months) between professional roles. Ignore gaps due to education, military service, or clearly explained breaks.
- Respond ONLY with the JSON object — no intro, no explanation, no markdown.
---
CV or LinkedIn Profile:
${text}
Respond ONLY in the language used in the CV or LinkedIn profile.
`.trim();
}
