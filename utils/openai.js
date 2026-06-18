// utils/openai.js

import { KeyManager } from './key-manager.js';
import { buildAnalysisPrompt } from '../prompts/analysis.js';
import { buildCvPrompt } from '../prompts/cv-generator.js';
import { buildCoverPrompt } from '../prompts/cover-letter.js';

const keyManager = new KeyManager();

async function deepseekPost(messages) {
  const res = await fetch(process.env.DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${keyManager.getNextKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'deepseek-chat', messages }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DeepSeek ${res.status}: ${text}`);
  }
  return res.json();
}

export async function analyzeCvJob(cvText, jobText, fileName = 'unknown.pdf') {
  const hasJobText = typeof jobText === 'string' && jobText.trim().length > 20;
  const messages = buildAnalysisPrompt(cvText, jobText, hasJobText);

  const data = await deepseekPost(messages);

  console.log('DeepSeek token usage:')
  if (data.usage.prompt_cache_hit_tokens !== undefined)
    console.log('  cache hit tokens:', data.usage.prompt_cache_hit_tokens)
  if (data.usage.prompt_cache_miss_tokens !== undefined)
    console.log('  cache miss tokens:', data.usage.prompt_cache_miss_tokens)
  if (data.usage.completion_tokens !== undefined)
    console.log('  completion tokens:', data.usage.completion_tokens)
  console.log('  total tokens:', data.usage.total_tokens)

  const fullPromptString = JSON.stringify(messages, null, 2);
  console.log('PROMPT (first 500 chars):', fullPromptString.substring(0, 500) + (fullPromptString.length > 500 ? '...' : ''));
  const rawOutputString = data.choices?.[0]?.message?.content || '';
  console.log('RAW JSON OUTPUT (first 500 chars):', rawOutputString.substring(0, 500) + (rawOutputString.length > 500 ? '...' : ''));

  let jsonOutput = rawOutputString;
  if (jsonOutput.includes('```json')) {
    jsonOutput = jsonOutput.replace(/```json\s*/, '').replace(/\s*```$/, '')
  } else if (jsonOutput.includes('```')) {
    jsonOutput = jsonOutput.replace(/```\s*/, '').replace(/\s*```$/, '')
  }
  jsonOutput = jsonOutput.trim();

  try {
    JSON.parse(jsonOutput);
    return { choices: data.choices, output: jsonOutput, usage: data.usage };
  } catch (jsonError) {
    console.error('Invalid JSON returned from API:', jsonError);
    console.error('Cleaned JSON output:', jsonOutput);
    throw new Error('API returned invalid JSON');
  }
}

export async function generateCV({ cv, analysis, tone }) {
  const messages = buildCvPrompt(cv, analysis, tone);
  const data = await deepseekPost(messages);

  console.log('DeepSeek token usage (Generate CV):')
  if (data.usage.prompt_cache_hit_tokens !== undefined)
    console.log('  cache hit tokens:', data.usage.prompt_cache_hit_tokens)
  if (data.usage.completion_tokens !== undefined)
    console.log('  completion tokens:', data.usage.completion_tokens)
  console.log('  total tokens:', data.usage.total_tokens)

  return { content: data.choices?.[0]?.message?.content || '', usage: data.usage };
}

export async function generateCoverLetter({ cv, analysis, tone }) {
  const messages = buildCoverPrompt(cv, analysis, tone);
  const data = await deepseekPost(messages);

  console.log('DeepSeek token usage (Generate Cover Letter):')
  if (data.usage.prompt_cache_hit_tokens !== undefined)
    console.log('  cache hit tokens:', data.usage.prompt_cache_hit_tokens)
  if (data.usage.completion_tokens !== undefined)
    console.log('  completion tokens:', data.usage.completion_tokens)
  console.log('  total tokens:', data.usage.total_tokens)

  const rawContent = data.choices?.[0]?.message?.content || '';

  const leadingDateRegex = /^\s*(January|February|March|April|May|June|July|August|September|October|November|December|\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},\s*\d{4})\s*$/i;

  let lines = rawContent.split('\n');
  while (lines.length && lines[0].trim() === '') lines.shift();
  while (lines.length && leadingDateRegex.test(lines[0].trim())) lines.shift();
  lines = lines.filter(line => !line.includes('[Company Address]') && !line.includes('[Date]'));

  let processedContent = lines.join('\n').trim();
  if (!processedContent) processedContent = rawContent.trim();

  const todayString = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  processedContent = `${todayString}\n\n${processedContent}`;

  return { content: processedContent.trim(), usage: data.usage };
}
