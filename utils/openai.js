// utils/openai.js

import axios from 'axios'
import { KeyManager } from './key-manager.js';
import { buildAnalysisPrompt } from '../prompts/analysis.js';
import { buildCvPrompt } from '../prompts/cv-generator.js';
import { buildCoverPrompt } from '../prompts/cover-letter.js';

const keyManager = new KeyManager();

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
// Analysis is the strategic brain that drives every downstream document — it runs on
// the strongest model. Generation executes the blueprint and stays on flash for speed.
const GEMINI_ANALYSIS_MODEL    = 'gemini-3.5-flash';
const GEMINI_GENERATION_MODEL  = 'gemini-2.5-flash';

// Pricing (USD per 1M tokens) — verify at ai.google.dev/gemini-api/docs/pricing
const PRICING = {
  'gemini-2.5-flash-lite': { input: 0.10,  output: 0.40  },
  'gemini-2.5-flash':      { input: 0.30,  output: 2.50  },
  'gemini-2.5-pro':        { input: 1.25,  output: 10.00 },
};

function geminiUsage(label, data, modelHint) {
  const usage        = data.usage || {};
  const servedModel  = data.model || modelHint;
  const rates        = PRICING[servedModel] || PRICING['gemini-2.5-flash-lite'];
  const inputTokens  = usage.prompt_tokens     || 0;
  const outputTokens = usage.completion_tokens || 0;
  const totalTokens  = usage.total_tokens      || (inputTokens + outputTokens);
  const costUsd      = (inputTokens  / 1_000_000) * rates.input
                     + (outputTokens / 1_000_000) * rates.output;
  return { label, model: servedModel, inputTokens, outputTokens, totalTokens, costUsd };
}

export async function analyzeCvJob(cvText, jobText, fileName = 'unknown.pdf') {
  // DO NOT REMOVE THIS LINE OR MOVE IT
  const hasJobText = typeof jobText === 'string' && jobText.trim().length > 20;

  const messages = buildAnalysisPrompt(cvText, jobText, hasJobText);

  const totalKeys = keyManager.keys.filter(k => k !== null).length;
  let lastError;

  for (let attempt = 0; attempt < Math.max(totalKeys, 1); attempt++) {
    try {
      const response = await axios.post(
        GEMINI_URL,
        { model: GEMINI_ANALYSIS_MODEL, messages },
        {
          headers: {
            Authorization: `Bearer ${keyManager.getNextKey()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = response.data;
      const gemini_usage = geminiUsage('analyze CV+job', data, GEMINI_ANALYSIS_MODEL);

      const fullPromptString = JSON.stringify(messages, null, 2);
      console.log('PROMPT (first 500 chars):', fullPromptString.substring(0, 500) + (fullPromptString.length > 500 ? '...' : ''));
      const rawOutputString = data.choices?.[0]?.message?.content || '';
      console.log('RAW JSON OUTPUT (first 500 chars):', rawOutputString.substring(0, 500) + (rawOutputString.length > 500 ? '...' : ''));

      let jsonOutput = rawOutputString;

      if (jsonOutput.includes('```json')) {
        jsonOutput = jsonOutput.replace(/```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonOutput.includes('```')) {
        jsonOutput = jsonOutput.replace(/```\s*/, '').replace(/\s*```$/, '');
      }

      jsonOutput = jsonOutput.trim();

      try {
        JSON.parse(jsonOutput);
        return { choices: data.choices, output: jsonOutput, usage: data.usage, gemini_usage };
      } catch (jsonError) {
        console.error('Invalid JSON returned from API:', jsonError);
        console.error('Cleaned JSON output:', jsonOutput);
        throw new Error('API returned invalid JSON');
      }
    } catch (error) {
      lastError = error;
      if (error.response?.status === 429) {
        console.warn(`[analyzeCvJob] Key ${attempt + 1}/${totalKeys} rate-limited (429), trying next key`);
        continue;
      }
      console.error('Gemini API Error:', error.response?.data || error.message);
      throw error;
    }
  }

  // All keys exhausted on 429s
  const rateLimitErr = new Error('All Gemini API keys are rate-limited. Try again later.');
  rateLimitErr.isRateLimit = true;
  throw rateLimitErr;
}

export async function generateCV({ cv, analysis, tone }) {
  const messages = buildCvPrompt(cv, analysis, tone);

  const response = await axios.post(
    GEMINI_URL,
    {
      model: GEMINI_GENERATION_MODEL,
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
    gemini_usage: geminiUsage('generate CV', data, GEMINI_GENERATION_MODEL)
  };
}
export async function generateCoverLetter({ cv, analysis, tone }) {
  const messages = buildCoverPrompt(cv, analysis, tone);

  const response = await axios.post(
    GEMINI_URL,
    {
      model: GEMINI_GENERATION_MODEL,
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
  const gemini_usage = geminiUsage('generate cover letter', data, GEMINI_GENERATION_MODEL);

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
