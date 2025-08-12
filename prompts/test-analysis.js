export function buildAnalysisPrompt(cvText, jobText, hasJobText) {
  const systemMessage = {
    role: 'system',
    content: `You are an expert HR strategist. Your task is to analyze a CV and job description, providing an honest critique and an actionable roadmap. Use only the provided content. The language of your entire output must match the detected language of the CV.`
  };

  const userMessage = {
    role: 'user',
    content: `
Analyze the provided CV and Job Ad to produce a single, strictly valid JSON object.

### Data Extraction and Classification
1.  **Language:** Detect the CV's language and use it for all output.
2.  **Job History:** Parse all employment experiences (title, company, dates, location, responsibilities) and list them chronologically (most recent first).
3.  **Career Scenario:** Classify the candidate's situation with readable tags (e.g., career pivot, standard progression, employment gap present).

### Strategic Analysis and Content Generation
1.  **Critique:** Perform a strategic analysis of the CV against the job description.
2.  **Action Items:** The 'action_items' object must summarize ALL actionable advice. Merge the 'master_plan' concept into 'cv_changes' based on priority. Rename 'cover_letter_guidance' to 'Cover Letter' and its internal keys as specified ('Points to Address', 'Narrative Flow').
3.  **Formatting:** All bullet points in string values must use the "•" character.

### JSON Output Rules
1.  **Strict JSON:** The final output must be a single, valid JSON object matching the required structure precisely.
2.  **No Markdown:** Do not use markdown formatting (like bold or code blocks) inside any JSON string values.
3.  **Completeness Rule:** Every key in the final JSON object must have a value. If data is not available for a field, use "n/a" or an empty array `[]` as appropriate for the schema. **Do not leave any value blank or incomplete.**

// REQUIRED JSON OUTPUT STRUCTURE:
{
  "summary": "...",
  "cv_data": { ... },
  "job_data": { ... },
  "jobs_extracted": [ { ... } ],
  "analysis": {
    ...,
    "action_items": {
      "cv_changes": { "critical": [], "advised": [], "optional": [] },
      "Cover Letter": { "Points to Address": [], "Narrative Flow": [], "Tone and Style": [] }
    }
  },
  "job_match": { ... },
  "final_thought": "...",
  "generation_framework": { ... }
}

// PROVIDED DATA:
CV Content:
${cvText}

${hasJobText ? `Job Advertisement:\n${jobText}` : ''}
`
  };

  return [systemMessage, userMessage];
}
