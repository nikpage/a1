// utils/openai.js

import axios from 'axios'
import { KeyManager } from './key-manager.js';
import { buildAnalysisPrompt } from '../prompts/analysis.js';
import { buildCvPrompt } from '../prompts/cv-generator.js';
import { buildCoverPrompt } from '../prompts/cover-letter.js';

const keyManager = new KeyManager();

export async function analyzeCvJob(cvText, jobText, fileName = 'unknown.pdf') {
  // DO NOT REMOVE THIS LINE OR MOVE IT
  const hasJobText = typeof jobText === 'string' && jobText.trim().length > 20;

  const messages = buildAnalysisPrompt(cvText, jobText, hasJobText);

  try {
    const response = await axios.post(
      process.env.DEEPSEEK_API_URL,
      {
        model: 'deepseek-chat',
        messages: messages,
        max_tokens: 8000
      },
      {
        headers: {
          Authorization: `Bearer ${keyManager.getNextKey()}`,
          'Content-Type': 'application/json'
        }
      }
    )

    const data = response.data

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

    // Extract JSON from potential markdown code blocks
    let jsonOutput = data.choices?.[0]?.message?.content || ''

    // Remove markdown code blocks if present
    if (jsonOutput.includes('```json')) {
      jsonOutput = jsonOutput.replace(/```json\s*/, '').replace(/\s*```$/, '')
    } else if (jsonOutput.includes('```')) {
      jsonOutput = jsonOutput.replace(/```\s*/, '').replace(/\s*```$/, '')
    }

    // Trim whitespace
    jsonOutput = jsonOutput.trim()

    // Validate JSON before returning
    try {
      JSON.parse(jsonOutput)
      return {
        choices: data.choices,
        output: jsonOutput,
        usage: data.usage
      }
    } catch (jsonError) {
      console.error('Invalid JSON returned from API:', jsonError)
      console.error('Cleaned JSON output:', jsonOutput)
      throw new Error('API returned invalid JSON')
    }
  } catch (error) {
    console.error('DeepSeek API Error:', error.response?.data || error.message)
    throw error
  }
}

export async function generateCV({ cv, analysis, tone }) {
  const messages = buildCvPrompt(cv, analysis, tone);

  const response = await axios.post(
    process.env.DEEPSEEK_API_URL,
    {
      model: 'deepseek-chat',
      messages: messages
    },
    {
      headers: {
        Authorization: `Bearer ${keyManager.getNextKey()}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const data = response.data;
  console.log('DeepSeek token usage (Generate CV):')
  if (data.usage.prompt_cache_hit_tokens !== undefined)
    console.log('  cache hit tokens:', data.usage.prompt_cache_hit_tokens)
  if (data.usage.completion_tokens !== undefined)
    console.log('  completion tokens:', data.usage.completion_tokens)
  console.log('  total tokens:', data.usage.total_tokens)

  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: data.usage
  };
}

export async function generateCoverLetter({ cv, analysis, tone }) {
  const messages = buildCoverPrompt(cv, analysis, tone);

  const response = await axios.post(
    process.env.DEEPSEEK_API_URL,
    {
      model: 'deepseek-chat',
      messages: messages
    },
    {
      headers: {
        Authorization: `Bearer ${keyManager.getNextKey()}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const data = response.data;
  console.log('DeepSeek token usage (Generate Cover Letter):')
  if (data.usage.prompt_cache_hit_tokens !== undefined)
    console.log('  cache hit tokens:', data.usage.prompt_cache_hit_tokens)
  if (data.usage.completion_tokens !== undefined)
    console.log('  completion tokens:', data.usage.completion_tokens)
  console.log('  total tokens:', data.usage.total_tokens)

  const rawContent = data.choices?.[0]?.message?.content || '';

  // This regex is used to find and remove any line that looks like a date.
  const dateFilterRegex = /(January|February|March|April|May|June|July|August|September|October|November|December)|\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/i;

  // Clean up any stray placeholders and hallucinated dates from the AI.
  let processedContent = rawContent
    .split('\n')
    .filter(line => !line.trim().includes('[Company Address]'))
    .filter(line => !line.trim().includes('[Date]'))
    .filter(line => !dateFilterRegex.test(line.trim())) // Aggressively remove any line that contains a date
    .join('\n');

  // Add just the date value to the very top.
  const todayString = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  processedContent = `${todayString}\n\n${processedContent.trim()}`;

  return {
    content: processedContent.trim(),
    usage: data.usage
  };
}
