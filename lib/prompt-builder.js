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

  // Detect all career scenarios explicitly
  const careerScenarios = detectCareerScenarios(jobDetails, metadata, originalCv);

  // Add scenario-specific analysis instructions
  promptBase += buildScenarioInstructions(careerScenarios, jobDetails);

  // Existing tone handling (unchanged)
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

  // Handle career scenarios with priority order
  if (careerScenarios.includes('recent_grad')) {
    promptBase += handleRecentGraduate(jobDetails, metadata);
  } else if (careerScenarios.includes('career_returner')) {
    promptBase += handleCareerReturner(jobDetails, metadata);
  } else if (careerScenarios.includes('pivot')) {
    promptBase += handleCareerPivot(jobDetails, metadata);
  } else if (careerScenarios.includes('older_applicant')) {
    promptBase += handleOlderApplicant(jobDetails, metadata);
  } else {
    promptBase += handleCareerProgression(jobDetails, metadata);
  }

  // Add additional scenario modifiers
  if (careerScenarios.includes('overqualified')) {
    promptBase += handleOverqualified(jobDetails, metadata);
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

// Enhanced career scenario detection
function detectCareerScenarios(jobDetails, metadata, originalCv) {
  const scenarios = [];

  if (detectRecentGraduate(metadata)) scenarios.push('recent_grad');
  if (detectCareerReturner(metadata)) scenarios.push('career_returner');
  if (detectCareerPivot(jobDetails, metadata, originalCv)) scenarios.push('pivot');
  if (detectOlderApplicant(metadata)) scenarios.push('older_applicant');
  if (detectOverqualified(jobDetails, metadata)) scenarios.push('overqualified');

  return scenarios;
}

// Enhanced pivot detection
function detectCareerPivot(jobDetails, metadata, originalCv) {
  if (!jobDetails) return false;

  // Industry change detection
  if (metadata?.current_industry && jobDetails.target_industry) {
    if (metadata.current_industry !== jobDetails.target_industry) return true;
  }

  // Role function change detection
  if (metadata?.current_role_type && jobDetails.role_type) {
    if (metadata.current_role_type !== jobDetails.role_type) return true;
  }

  // Explicit pivot keywords in job details
  const pivotKeywords = ['transition', 'career change', 'switching to', 'moving into', 'pivot'];
  const jobText = `${jobDetails.title || ''} ${jobDetails.description || ''}`.toLowerCase();
  if (pivotKeywords.some(keyword => jobText.includes(keyword))) return true;

  // Skill mismatch analysis
  if (Array.isArray(jobDetails.keywords) && Array.isArray(metadata?.primary_skills)) {
    try {
      const jobSkills = jobDetails.keywords.map(k => String(k).toLowerCase());
      const candidateSkills = metadata.primary_skills.map(s => String(s).toLowerCase());
      const overlap = jobSkills.filter(skill => candidateSkills.includes(skill));

      // If less than 30% skill overlap, likely a pivot
      if (jobSkills.length > 0 && overlap.length / jobSkills.length < 0.3) return true;
    } catch (e) {
      // Skip skill analysis if data is malformed
    }
  }

  return false;
}

// Detect recent graduate (enhanced)
function detectRecentGraduate(metadata) {
  if (!metadata) return false;

  // Original logic with safety checks
  const yearsExp = Number(metadata.years_experience) || 0;
  if (yearsExp <= 2 || metadata.seniority === 'Entry') return true;

  // Enhanced detection with graduation year
  if (metadata.graduation_year) {
    try {
      const currentYear = new Date().getFullYear();
      const gradYear = Number(metadata.graduation_year);
      if (!isNaN(gradYear) && currentYear - gradYear <= 2) return true;
    } catch (e) {
      // Skip graduation year analysis if invalid
    }
  }

  // Pattern detection: lots of internships, limited full-time experience
  const internshipCount = Number(metadata.internship_count) || 0;
  const fullTimeRoles = Number(metadata.full_time_roles) || 0;
  if (internshipCount >= 2 && fullTimeRoles <= 1) return true;

  // Infer from career span if available
  if (metadata.career_start_year) {
    try {
      const currentYear = new Date().getFullYear();
      const startYear = Number(metadata.career_start_year);
      if (!isNaN(startYear) && currentYear - startYear <= 3) return true;
    } catch (e) {
      // Skip if invalid
    }
  }

  return false;
}

// Detect career returner (enhanced)
function detectCareerReturner(metadata) {
  if (!metadata) return false;

  // Original logic with safety check
  const gapMonths = Number(metadata.employment_gap_months) || 0;
  if (gapMonths >= 12) return true;

  // Enhanced detection with career break reason
  if (metadata.career_break_reason) {
    try {
      const breakReasons = ['parental leave', 'family care', 'education', 'personal reasons', 'maternity', 'paternity', 'sabbatical'];
      const reason = String(metadata.career_break_reason).toLowerCase();
      if (breakReasons.some(br => reason.includes(br))) return true;
    } catch (e) {
      // Skip if invalid
    }
  }

  return false;
}

// New: Detect older applicant
function detectOlderApplicant(metadata) {
  if (!metadata) return false;

  // Direct experience-based detection
  const yearsExp = Number(metadata.years_experience) || 0;
  if (yearsExp >= 20) return true;

  // Direct age indicator if available
  const age = Number(metadata.age) || 0;
  if (age >= 50) return true;

  // Infer age from career span
  if (metadata.career_start_year) {
    try {
      const currentYear = new Date().getFullYear();
      const startYear = Number(metadata.career_start_year);
      if (!isNaN(startYear) && currentYear - startYear >= 20) return true;
    } catch (e) {
      // Skip if invalid
    }
  }

  // Infer age from education dates (assume graduated around age 22-25)
  if (metadata.education_start_year || metadata.graduation_year) {
    try {
      const currentYear = new Date().getFullYear();
      const educationYear = Number(metadata.education_start_year || metadata.graduation_year);
      if (!isNaN(educationYear)) {
        const estimatedAge = currentYear - educationYear + 22; // Assume started college at ~18, graduated at ~22
        if (estimatedAge >= 50) return true;
      }
    } catch (e) {
      // Skip if invalid
    }
  }

  // Multiple senior roles indicator
  const seniorRoleCount = Number(metadata.senior_role_count) || 0;
  if (seniorRoleCount >= 3) return true;

  return false;
}

// New: Detect overqualified candidate
function detectOverqualified(jobDetails, metadata) {
  if (!jobDetails || !metadata) return false;

  // Seniority mismatch detection
  if (jobDetails.seniority && metadata.seniority) {
    try {
      const seniorityLevels = ['Entry', 'Junior', 'Mid', 'Senior', 'Lead', 'Principal', 'Director', 'VP', 'C-Level'];
      const targetLevel = seniorityLevels.indexOf(String(jobDetails.seniority));
      const candidateLevel = seniorityLevels.indexOf(String(metadata.seniority));

      // If candidate is 2+ levels above target role
      if (targetLevel >= 0 && candidateLevel >= 0 && candidateLevel - targetLevel >= 2) {
        return true;
      }
    } catch (e) {
      // Skip seniority analysis if invalid
    }
  }

  // Management experience for non-management role
  if (metadata.has_management_experience === true && jobDetails.requires_management === false) {
    return true;
  }

  // Years of experience significantly higher than typical for role level
  const yearsExp = Number(metadata.years_experience) || 0;
  const typicalYears = Number(jobDetails.typical_years_experience) || 0;
  if (typicalYears > 0 && yearsExp > typicalYears * 1.5) return true;

  return false;
}

// Build scenario-specific instructions
function buildScenarioInstructions(scenarios, jobDetails) {
  let instructions = `\n\n🎯 CAREER SCENARIO ANALYSIS:\n`;

  if (scenarios.includes('pivot')) {
    instructions += `🔄 CAREER PIVOT DETECTED: This candidate is transitioning between fields/industries.\n`;
    instructions += `PIVOT STRATEGY: Focus on TRANSFERABLE skills. Reframe experience to show relevance to ${jobDetails.title || 'target role'}. Remove industry-specific jargon. Position as transitioning INTO new field.\n\n`;
  }

  if (scenarios.includes('recent_grad')) {
    instructions += `🎓 RECENT GRADUATE: Limited professional experience detected.\n`;
  }

  if (scenarios.includes('career_returner')) {
    instructions += `↩️ CAREER RETURNER: Employment gap detected.\n`;
  }

  if (scenarios.includes('older_applicant')) {
    instructions += `👔 EXPERIENCED PROFESSIONAL: Extensive career history detected.\n`;
  }

  if (scenarios.includes('overqualified')) {
    instructions += `⚡ OVERQUALIFIED CANDIDATE: High-level experience for target role.\n`;
  }

  if (scenarios.length === 0) {
    instructions += `📈 CAREER PROGRESSION: Standard career advancement scenario.\n`;
  }

  instructions += `CRITICAL: Use only real information from their CV. Never invent experience. Reframe and recontextualize actual experience strategically.\n`;

  return instructions;
}

// Handle recent graduate (unchanged function name/signature)
function handleRecentGraduate(jobDetails, metadata) {
  let gradText = `\n\n🎓 RECENT GRADUATE STRATEGY:\n\n`;

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

// Handle career returner (unchanged function name/signature)
function handleCareerReturner(jobDetails, metadata) {
  let returnerText = `\n\n🔄 CAREER RETURNER STRATEGY:\n\n`;

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

// New: Handle career pivot
function handleCareerPivot(jobDetails, metadata) {
  let pivotText = `\n\n🔄 CAREER PIVOT STRATEGY:\n\n`;

  pivotText += `PIVOT INSTRUCTIONS:
1. **Transferable Skills Focus**: Identify and emphasize skills that apply to the new field
2. **Reframe Experience**: Present past roles through the lens of the target industry
3. **Remove Jargon**: Eliminate industry-specific terminology that doesn't translate
4. **Bridge the Gap**: Explain how previous experience provides unique value in new field
5. **Show Intentionality**: Position the change as strategic, not desperate

`;

  if (jobDetails.title) {
    pivotText += `Pivoting to: ${jobDetails.title}\n`;
    if (metadata?.current_industry && jobDetails.target_industry) {
      pivotText += `Transitioning from ${metadata.current_industry} to ${jobDetails.target_industry}\n`;
    }
    pivotText += `Demonstrate how their background uniquely qualifies them for this new direction.\n`;
  }

  return pivotText;
}

// New: Handle older applicant
function handleOlderApplicant(jobDetails, metadata) {
  let olderText = `\n\n👔 EXPERIENCED PROFESSIONAL STRATEGY:\n\n`;

  olderText += `OLDER APPLICANT INSTRUCTIONS:
1. **Modern Relevance**: Emphasize recent experience and current technology skills
2. **Strategic History**: Include 10-15 years of relevant experience, not entire career
3. **Energy & Adaptability**: Show ongoing learning, flexibility, and enthusiasm
4. **Value Proposition**: Highlight mentorship ability, stability, and deep expertise
5. **Avoid Age Markers**: Remove graduation dates if very old, focus on recent achievements

`;

  if (jobDetails.title) {
    olderText += `Senior-level targeting for: ${jobDetails.title}\n`;
    olderText += `Position extensive experience as an asset, not a liability.\n`;
  }

  return olderText;
}

// New: Handle overqualified candidate
function handleOverqualified(jobDetails, metadata) {
  let overqualText = `\n\n⚡ OVERQUALIFIED CANDIDATE MODIFIER:\n\n`;

  overqualText += `OVERQUALIFIED INSTRUCTIONS:
1. **Right-Size Experience**: De-emphasize higher-level responsibilities that exceed role requirements
2. **Show Genuine Interest**: Explain why this role aligns with their goals (work-life balance, passion for field, etc.)
3. **Avoid Intimidation**: Don't overshadow what the hiring manager can offer
4. **Focus on Fit**: Emphasize cultural alignment and specific role requirements
5. **Address Concerns**: Subtly address flight risk and salary expectations

`;

  return overqualText;
}

// Handle normal career progression (unchanged function name/signature)
function handleCareerProgression(jobDetails, metadata) {
  let progressText = `\n\n📈 CAREER PROGRESSION STRATEGY:\n\n`;

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

  // Add metadata-based enhancements (unchanged)
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
  return `
You are an intelligent extraction assistant.

ONLY output valid minified JSON. No text, no explanation, no code blocks, no formatting.

Return exactly:
{
  "title": "Job title",
  "company": "Company name",
  "seniority": "Entry|Mid|Senior|Executive based on role requirements and responsibilities",
  "hiringManager": "Hiring manager name or null",
  "keywords": ["keyword1", "keyword2", ... up to 6]
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
