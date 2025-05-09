// ===== Z4 VERSION =====
// File: js/prompt-builder.js

// ⚡️ Shared constant for clean JSON
export const JSON_ONLY = 'Respond with valid, minified JSON.';

// ----------------------------------------------------------------------------
// Builds a prompt for CV generation
export function buildCVPrompt(tone, jobDetails) {
    let promptBase = `You are a professional CV writer. Create a strong CV based on the candidate's information and experience. `;

    // Add tone-specific instructions
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
            promptBase += `Use a confident, bold tone that showcases achievements with impact. Don't be afraid to use strong language like "kick-ass" when appropriate. `;
            break;
    }

    // Add job-specific details if available
    if (jobDetails.title || jobDetails.company || jobDetails.keywords.length > 0) {
        promptBase += `\n\nOptimize this CV for the following job details:\n`;

        if (jobDetails.title) {
            promptBase += `Position: ${jobDetails.title}\n`;
        }
        if (jobDetails.company) {
            promptBase += `Company: ${jobDetails.company}\n`;
        }
        if (jobDetails.keywords.length > 0) {
            promptBase += `Key skills to emphasize: ${jobDetails.keywords.join(', ')}\n`;
            promptBase += `\nStrategically incorporate these key skills and competencies throughout the CV where relevant to the candidate's experience.`;
        }
    }

    // Formatting instructions
    promptBase += `\n\nFormat the CV with clear section headings and bullet points for readability. Include the following sections:
1. Professional Summary
2. Work Experience (in reverse chronological order)
3. Education
4. Skills
5. Any other relevant sections based on the candidate's background

Make sure the CV sounds human-written, is concise, and highlights the candidate's achievements and value proposition.`;
    promptBase += `\n\nOnly return the CV content — no notes, no instructions, no commentary.`;

    return promptBase;
}
// :contentReference[oaicite:0]{index=0}

// ----------------------------------------------------------------------------
// Builds a prompt for cover letter generation
export function buildCoverLetterPrompt(tone, jobDetails) {
    let promptBase = `You are a professional cover letter writer. Create a compelling cover letter based on the candidate's information and experience. `;

    // Tone instructions
    switch(tone) {
        case 'formal':
            promptBase += `Use a formal, professional tone. Avoid contractions and casual language. `;
            break;
        case 'neutral':
            promptBase += `Use a balanced, professional tone that is neither too formal nor too casual. `;
            break;
        case 'casual':
            promptBase += `Use a conversational, approachable tone while maintaining professionalism. Feel free to use contractions and show some personality. `;
            break;
        case 'cocky':
            promptBase += `Use a confident, bold tone that showcases the candidate's value with impact. Don't be afraid to use strong language like "kick-ass" when appropriate. `;
            break;
    }

    // Job details
    if (jobDetails.title || jobDetails.company || jobDetails.hiringManager || jobDetails.keywords.length > 0) {
        promptBase += `\n\nTarget this cover letter for the following job details:\n`;

        if (jobDetails.title) {
            promptBase += `Position: ${jobDetails.title}\n`;
        }
        if (jobDetails.company) {
            promptBase += `Company: ${jobDetails.company}\n`;
        }
        if (jobDetails.hiringManager) {
            promptBase += `Hiring Manager: ${jobDetails.hiringManager}\n`;
        }
        if (jobDetails.keywords.length > 0) {
            promptBase += `Key skills to emphasize: ${jobDetails.keywords.join(', ')}\n`;
            promptBase += `\nStrategically incorporate these key skills throughout the cover letter where relevant to the candidate's experience.`;
        }
    }

    // Structure instructions
    promptBase += `\n\nStructure the cover letter with:
1. Professional header with candidate's contact information
2. Date and inside address (if provided)
3. Salutation (personalized to the hiring manager if known)
4. Opening paragraph that grabs attention
5. 1-2 body paragraphs highlighting relevant experience and achievements
6. Closing paragraph with call to action
7. Professional closing

Make sure the cover letter sounds human-written, is concise (no more than one page), and demonstrates the candidate's enthusiasm and fit for the position.`;
    promptBase += `

Remove placeholder fields like [Insert Date], [Company Name], or [Company Address] if no value is provided. Omit the full address section entirely in digital use. Format the output for clean screen reading: no unnecessary whitespace, no filler, no generic placeholders.

Only return the cover letter — no notes, no explanations, no commentary.`;

    return promptBase;
}
// :contentReference[oaicite:1]{index=1}

// ----------------------------------------------------------------------------
// Builds a prompt for extracting job metadata from a CV
export function buildExtractionPrompt() {
  return `
You are an intelligent extraction assistant.

ONLY output valid minified JSON. No text, no explanation, no code blocks, no formatting.

Return exactly:
{
  "title": "Job title",
  "company": "Company name",
  "hiringManager": "Hiring manager name or null",
  "keywords": ["keyword1", "keyword2", ... up to 6]
}

Extract:
- "title": most accurate job title.
- "company": employer's name.
- "hiringManager": recruiter's or manager's full name, else null.
- "keywords": important skills, tools, specialties (max 6).

Respond ONLY with JSON object. No comments, no intro, no markdown.`;
}
// :contentReference[oaicite:2]{index=2}

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
// :contentReference[oaicite:3]{index=3}

// ----------------------------------------------------------------------------
// Builds a prompt for CV feedback analysis
export function buildCVFeedbackPrompt(documentType, targetIndustry = 'general', country = 'us') {
    const industryTemplates = {
        tech:    { keywords: ['Agile','CI/CD','Cloud','Python','Machine Learning'], metrics: ['% efficiency','system uptime','reduced latency'], norms: 'Highlight technical projects and GitHub contributions' },
        finance: { keywords: ['FP&A','ROI','Financial Modeling','GAAP','Due Diligence'],         metrics: ['$ savings','% growth','deal size'],               norms: 'Show certifications (CFA, CPA) and deal experience' },
        healthcare:{ keywords: ['HIPAA','EMR','Patient Care','Clinical Trials','FDA'],         metrics: ['patient outcomes','% accuracy','process efficiency'], norms: 'Emphasize licenses and compliance experience' },
        general: { keywords: ['Leadership','Project Management','Problem Solving'],            metrics: ['% improvement','cost savings','team size'],         norms: 'Focus on transferable skills' }
    };
    const countryNorms = {
        us: '1-page preferred, include achievements',
        uk: '2 pages max, include personal statement',
        de: 'Photo expected, detailed work history',
        au: 'Include key selection criteria',
        cz: '2 pages max, include photo and birth date (optional)',
        pl: 'Photo expected, detailed education history',
        ro: 'Include personal details (age, marital status optional)',
        ua: '2-3 pages, include photo and passport details'
    };
    const atsThresholds = `(Good: 15+ keywords | Excellent: 25+ keywords)`;
    const industry = industryTemplates[targetIndustry] || industryTemplates.general;
    const countryNorm = countryNorms[country] || `Use regionally appropriate formatting for ${country || 'the candidate\'s location'}.`;

    let promptBase = `You're a friendly HR advisor with ${targetIndustry} expertise. Let's optimize this ${documentType === 'linkedin' ? 'LinkedIn profile' : 'CV'} for ${targetIndustry} roles in ${country.toUpperCase()}.\n\n`;

    promptBase += `Start with a warm, encouraging rating (1-5 stars) followed by:\n
✨ [3 Quick Wins] - Easy fixes with big impact\n
🔍 [Deep Dive] - Thoughtful analysis on:\n
1. Formatting (${countryNorm})\n
2. ${industry.norms}\n
3. Keyword optimization ${atsThresholds}\n
4. Achievement phrasing ("${industry.metrics.join('", "')}")\n
5. Career Storytelling - Evaluate the coherence of career arcs and how parallel experiences strengthen the candidate’s value proposition.\n\n`;

    promptBase += `**Special Focus**:
- Review the candidate's "Career Arcs Summary" and "Parallel Experiences Summary" provided in the metadata.
- Suggest how to best present their career growth and complementary skills in the CV.
- If helpful, recommend rephrasing or repositioning experiences for greater impact.\n\n`;

    promptBase += `Keep it:\n
✅ Encouraging but honest\n
✅ Specific to ${targetIndustry} needs\n
✅ Culturally appropriate for ${country}\n
✅ Focused on human-like reasoning, not mechanical keyword matching\n
✅ Practical and actionable for immediate improvements
`;

    return promptBase;
}

// ----------------------------------------------------------------------------
export function buildCVMetadataExtractionPrompt(text) {
  return `
Analyze the CV or LinkedIn profile text below with careful, human-like reasoning.

**Your tasks:**
- Identify and summarize the candidate’s primary career arcs (growth paths, role evolutions, industry themes).
- Detect any significant parallel or crossover experiences (career pivots, complementary skill sets across industries).
- Infer seniority level from responsibilities and impact, not just titles.
- Estimate total years of experience accurately, accounting for overlaps or part-time work.
- Infer key industries, skills, achievements, certifications, and language proficiencies.
- Include a list of locations (countries/cities) as "places" based on text clues or reasonable inference.
- Include ISO 639-1 codes in "language_codes" if the language can be matched.


**Important:**
- Focus on contextual relevance and logical growth, not just title or keyword matching.
- When career arcs involve a pivot or parallel skillset, highlight the complementarity (e.g., QA testing skills supporting UX design).

**Return ONLY a valid, minified JSON object matching EXACTLY this schema:**

{
  "current_role": "Most recent or representative job title",
  "seniority": "Inferred seniority level (e.g., Entry, Mid, Senior, Executive)",
  "primary_company": "Most recent or primary company name",
  "career_arcs_summary": "Brief narrative describing main career arcs, highlighting growth and transitions",
  "parallel_experiences_summary": "Brief narrative highlighting any notable parallel or crossover experiences",
  "years_experience": "Total years of relevant experience (rounded to nearest 0.5)",
  "industries": ["List of primary industries, e.g., 'Fintech', 'Healthcare'"],
  "education": ["Degrees and institutions with focus areas if available"],
  "skills": ["Comprehensive list of technical and soft skills"],
  "languages": ["Languages spoken with proficiency if mentioned"],
  "key_achievements": ["Awards, major projects, publications, or major contributions"],
  "certifications": ["Relevant certifications or licenses"],
  "places": ["Countries or cities mentioned or inferred"],
  "language_codes": ["ISO 639-1 language codes if known (e.g., 'en', 'cs')"]
}

**Guidelines:**
- Infer and summarize career progression and transferable skills logically.
- If data is ambiguous, make reasonable assumptions favoring clarity.
- Exclude unrelated work gaps unless contributing valuable skills.
- Respond ONLY with the JSON object — no intro, no explanation, no markdown.

---

CV or LinkedIn Profile:
${text}

${JSON_ONLY}
  `;
}
