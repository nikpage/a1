// utils/openai.js

import axios from 'axios'
import { KeyManager } from './key-manager.js';
import { buildAnalysisPrompt } from '../prompts/analysis.js';
import { buildCvPrompt } from '../prompts/cv-generator.js';
import { buildCoverPrompt } from '../prompts/cover-letter.js';

const keyManager = new KeyManager();

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const GEMINI_MODEL = 'gemini-2.5-flash-lite';

// Gemini 2.5 Flash Lite pricing — verify at ai.google.dev/gemini-api/docs/pricing
const GEMINI_INPUT_COST_PER_M  = 0.10;   // USD per 1M input tokens
const GEMINI_OUTPUT_COST_PER_M = 0.40;   // USD per 1M output tokens

function geminiUsage(label, data) {
  const usage        = data.usage || {};
  const servedModel  = data.model || GEMINI_MODEL;
  const inputTokens  = usage.prompt_tokens     || 0;
  const outputTokens = usage.completion_tokens || 0;
  const totalTokens  = usage.total_tokens      || (inputTokens + outputTokens);
  const costUsd      = (inputTokens  / 1_000_000) * GEMINI_INPUT_COST_PER_M
                     + (outputTokens / 1_000_000) * GEMINI_OUTPUT_COST_PER_M;
  return { label, model: servedModel, inputTokens, outputTokens, totalTokens, costUsd };
}

export async function analyzeCvJob(cvText, jobText, fileName = 'unknown.pdf') {
  // DO NOT REMOVE THIS LINE OR MOVE IT
  const hasJobText = typeof jobText === 'string' && jobText.trim().length > 20;

  const messages = buildAnalysisPrompt(cvText, jobText, hasJobText);

  try {
    const response = await axios.post(
      GEMINI_URL,
      {
        model: GEMINI_MODEL,
        messages: messages
      },
      {
        headers: {
          Authorization: `Bearer ${keyManager.getNextKey()}`,
          'Content-Type': 'application/json'
        }
      }
    )

    const data = response.data

    const gemini_usage = geminiUsage('analyze CV+job', data);

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
        usage: data.usage,
        gemini_usage
      }
    } catch (jsonError) {
      console.error('Invalid JSON returned from API:', jsonError)
      console.error('Cleaned JSON output:', jsonOutput)
      throw new Error('API returned invalid JSON')
    }
  } catch (error) {
    console.error('Gemini API Error:', error.response?.data || error.message)
    throw error
  }
}

export async function generateCV({ cv, analysis, tone }) {
  const messages = buildCvPrompt(cv, analysis, tone);

  const response = await axios.post(
    GEMINI_URL,
    {
      model: GEMINI_MODEL,
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
  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: data.usage,
    gemini_usage: geminiUsage('generate CV', data)
  };
}
export async function generateCoverLetter({ cv, analysis, tone }) {
  const messages = buildCoverPrompt(cv, analysis, tone);

  const response = await axios.post(
    GEMINI_URL,
    {
      model: GEMINI_MODEL,
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
  const gemini_usage = geminiUsage('generate cover letter', data);

  const rawContent = data.choices?.[0]?.message?.content || '';

  // Regex to detect lines that are *just* a date (e.g. "August 12, 2023" or "12/08/2023")
  const leadingDateRegex = /^\s*(January|February|March|April|May|June|July|August|September|October|November|December|\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},\s*\d{4})\s*$/i;

  // Split into lines and remove only leading date lines (not any line anywhere)
  let lines = rawContent.split('\n');

  // drop starting empty lines
  while (lines.length && lines[0].trim() === '') lines.shift();

  // remove only consecutive leading lines that are pure dates
  while (lines.length && leadingDateRegex.test(lines[0].trim())) lines.shift();

  // remove placeholders anywhere
  lines = lines.filter(line => !line.includes('[Company Address]') && !line.includes('[Date]'));

  // Rejoin
  let processedContent = lines.join('\n').trim();

  // If cleaning removed everything, fall back to rawContent (trimmed)
  if (!processedContent) {
    processedContent = rawContent.trim();
  }

  // Ensure we always prepend today's real date (de-DE format like before)
  const todayString = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  processedContent = `${todayString}\n\n${processedContent}`;

  return {
    content: processedContent.trim(),
    usage: data.usage,
    gemini_usage
  };
}
