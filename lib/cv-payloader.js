import {
  buildCVPrompt,
  buildCoverLetterPrompt
} from './prompt-builder.js';

export function buildCVDocumentPrompt({ metadata, parsedCV, tone = 'neutral', outputType = 'cv' }) {
  const jobDetails = {
    title: metadata?.title || metadata?.current_role || '',
    company: metadata?.company || metadata?.primary_company || '',
    hiringManager: metadata?.hiringManager || '',
    keywords: Array.isArray(metadata?.skills) ? metadata.skills.slice(0, 8) : []
  };

  const userProfile = parsedCV?.summary || parsedCV?.body || JSON.stringify(parsedCV || {}, null, 2);

  let prompt = '';

  if (outputType === 'cv') {
    prompt = buildCVPrompt(tone, jobDetails);
  } else if (outputType === 'cover') {
    prompt = buildCoverLetterPrompt(tone, jobDetails);
  } else {
    throw new Error('Invalid outputType');
  }

  prompt += `

------------------------
📄 CANDIDATE BACKGROUND:
${userProfile}
------------------------

Use only the actual background. Do NOT invent details.`;

  return prompt;
}
