// prompts/job-extraction.js
// Cheap synchronous extraction pass — runs before the full analysis to let the
// user confirm and edit job details before we spend the bigger analysis call.

export function buildJobExtractionPrompt(jobText) {
  return [
    {
      role: 'system',
      content: `You are a job-ad parser. Extract structured information from the job description the user provides. Use judgment — job ads have no common structure. Extract ONLY what is explicitly stated. Quote or closely paraphrase the ad's own phrasing. Use empty string for absent scalar fields. Use empty arrays where the ad is silent. Never invent, embellish, or infer values not stated in the ad. Return VALID JSON only — no markdown fences, no extra commentary.`,
    },
    {
      role: 'user',
      content: `Extract the following fields from this job ad. Return VALID JSON only — no markdown, no explanation.\n\nSchema:\n{\n  "position_title": "",\n  "company": "",\n  "hr_contact": "",\n  "location": "",\n  "seniority": "",\n  "employment_type": "",\n  "salary": "",\n  "required_skills": [],\n  "desired_skills": [],\n  "must_have_requirements": [],\n  "nice_to_have": [],\n  "responsibilities": [],\n  "keywords_for_ats": [],\n  "language_requirements": []\n}\n\nJOB AD:\n${jobText}`,
    },
  ];
}
