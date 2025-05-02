// prompt-builder.js

/**
 * Builds a prompt for CV generation
 * @param {string} tone - Selected tone (formal, neutral, casual, cocky)
 * @param {Object} jobDetails - Job details (title, company, keywords)
 * @return {string} The constructed prompt
 */
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

    // Add formatting instructions
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

/**
 * Builds a prompt for cover letter generation
 * @param {string} tone - Selected tone (formal, neutral, casual, cocky)
 * @param {Object} jobDetails - Job details (title, company, hiringManager, keywords)
 * @return {string} The constructed prompt
 */
export function buildCoverLetterPrompt(tone, jobDetails) {
    let promptBase = `You are a professional cover letter writer. Create a compelling cover letter based on the candidate's information and experience. `;

    // Add tone-specific instructions
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

    // Add job-specific details if available
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

    // Add formatting instructions
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



/**
 * Builds a prompt for translating content
 * @param {string} targetLanguage - Language code to translate to
 * @return {string} The translation prompt
 */
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

/**
 * Builds a prompt for CV feedback analysis
 * @param {string} documentType - Type of document (cv_file, cv_text, linkedin)
 * @param {string} targetIndustry - Industry focus (tech, finance, healthcare, etc.)
 * @param {string} country - Country code for localization (us, uk, de, etc.)
 * @return {string} The constructed prompt
 */
function buildCVFeedbackPrompt(documentType, targetIndustry = 'general', country = 'us') {
    // Industry-specific templates
    const industryTemplates = {
        tech: {
            keywords: ['Agile', 'CI/CD', 'Cloud', 'Python', 'Machine Learning'],
            metrics: ['% efficiency', 'system uptime', 'reduced latency'],
            norms: 'Highlight technical projects and GitHub contributions'
        },
        finance: {
            keywords: ['FP&A', 'ROI', 'Financial Modeling', 'GAAP', 'Due Diligence'],
            metrics: ['$ savings', '% growth', 'deal size'],
            norms: 'Show certifications (CFA, CPA) and deal experience'
        },
        healthcare: {
            keywords: ['HIPAA', 'EMR', 'Patient Care', 'Clinical Trials', 'FDA'],
            metrics: ['patient outcomes', '% accuracy', 'process efficiency'],
            norms: 'Emphasize licenses and compliance experience'
        },
        general: {
            keywords: ['Leadership', 'Project Management', 'Problem Solving'],
            metrics: ['% improvement', 'cost savings', 'team size'],
            norms: 'Focus on transferable skills'
        }
    };

    // Country-specific norms
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

    // ATS scoring thresholds
    const atsThresholds = `(Good: 15+ keywords | Excellent: 25+ keywords)`;

    const industry = industryTemplates[targetIndustry] || industryTemplates.general;
    const countryNorm = countryNorms[country] || countryNorms.us;

    let promptBase = `You're a friendly HR advisor with ${targetIndustry} expertise. Let's optimize this ${documentType === 'linkedin' ? 'LinkedIn profile' : 'CV'} for ${targetIndustry} roles in ${country.toUpperCase()}.`;

    promptBase += `\n\nStart with a warm, encouraging rating (1-5 stars) followed by:\n
✨ [3 Quick Wins] - Easy fixes with big impact\n
🔍 [Deep Dive] - Thoughtful analysis on:\n
1. Formatting (${countryNorm})\n
2. ${industry.norms}\n
3. Keyword optimization ${atsThresholds}\n
4. Achievement phrasing ("${industry.metrics.join('", "')}")\n\n`;

    promptBase += `Suggest improvements like a supportive mentor:\n
"Great start! Here's how to make it shine:\n
• Try adding 2-3 more ${industry.keywords.slice(0,3).join('/')} keywords\n
• Quantify achievements like 'Improved ${industry.metrics[0]} by X%'\n
• Move education higher for ${country} standards"`;

    promptBase += `\n\nKeep it:\n
✅ Encouraging but honest\n
✅ Specific to ${targetIndustry} needs\n
✅ Culturally appropriate for ${country}\n
✅ Actionable within 30 minutes\n
✅ Under 200 words total`;

    return promptBase;
}
