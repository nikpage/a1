// prompt-builder.js

/**
 * Builds a prompt for CV generation
 * @param {string} tone - Selected tone (formal, neutral, casual, cocky)
 * @param {Object} jobDetails - Job details (title, company, keywords)
 * @return {string} The constructed prompt
 */
function buildCVPrompt(tone, jobDetails) {
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
function buildCoverLetterPrompt(tone, jobDetails) {
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



function buildExtractionPrompt() {
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
function buildTranslationPrompt(targetLanguage) {
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
 * @return {string} The constructed prompt
 */
function buildCVFeedbackPrompt(documentType) {
    let promptBase = `You are a professional HR Manager with extensive experience in tech companies, startups, corporates, legal, banking, government, manufacturing, and other verticals. You also consult on CV and cover letter writing in schools and universities to help students write amazing job seeking documents.`;

    promptBase += `\n\nAnalyze the provided ${documentType === 'linkedin' ? 'LinkedIn profile' : 'CV'} and write a structured commentary of no more than 100 words. Focus on what an HR person would react positively or negatively to.`;

    promptBase += `\n\nProvide specific, actionable feedback on:
1. Overall presentation and structure
2. Professional summary/headline
3. Experience descriptions (achievements vs responsibilities)
4. Skills presentation
5. Most critical improvements needed`;

    promptBase += `\n\nKeep your feedback direct, specific, and actionable. Format as a summary paragraph followed by 3-5 bullet points of key recommendations.`;

    return promptBase;
}
