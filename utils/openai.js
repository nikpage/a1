// utils/openai.js

import axios from 'axios'
import { Redis } from '@upstash/redis';
import { KeyManager } from './key-manager.js';
import { buildAnalysisPrompt } from '../prompts/analysis.js';
import { buildCvPrompt } from '../prompts/cv-generator.js';
import { buildCoverPrompt } from '../prompts/cover-letter.js';
import { buildJobExtractionPrompt } from '../prompts/job-extraction.js';
import { logger } from '../lib/logger.js';

const keyManager = new KeyManager();

let _redis;
function getRedis() {
  if (!_redis) _redis = Redis.fromEnv();
  return _redis;
}

const DAILY_BUDGET = parseFloat(process.env.GEMINI_DAILY_BUDGET_USD || '10');

export async function trackDailySpend(costUsd) {
  const key = `gemini_spend:${new Date().toISOString().slice(0, 10)}`; // YYYY-MM-DD
  try {
    const redis = getRedis();
    const newTotal = await redis.incrbyfloat(key, costUsd);
    await redis.expire(key, 60 * 60 * 26); // 26h TTL — survives midnight briefly
    if (newTotal >= DAILY_BUDGET) {
      logger.error(`[spend-guard] Daily Gemini spend $${newTotal.toFixed(4)} has reached/exceeded budget $${DAILY_BUDGET}`);
    }
  } catch (e) {
    logger.warn('[spend-guard] Could not record spend:', e.message);
  }
}

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
// Analysis is the strategic brain that drives every downstream document. Generation
// writes the actual CV/cover prose, so it gets the same strong model — its output is
// short (~1.5k tokens) so it stays well under the Netlify function timeout.
const GEMINI_ANALYSIS_MODEL    = 'gemini-2.5-flash';
const GEMINI_GENERATION_MODEL  = 'gemini-2.5-flash';

// Pricing (USD per 1M tokens) — verify at ai.google.dev/gemini-api/docs/pricing
const PRICING = {
  'gemini-2.5-flash-lite': { input: 0.10,  output: 0.40  },
  'gemini-2.5-flash':      { input: 0.30,  output: 2.50  },
  'gemini-2.5-pro':        { input: 1.25,  output: 10.00 },
  'gemini-3.5-flash':      { input: 1.50,  output: 9.00  },
};

function geminiUsage(label, data, modelHint) {
  const usage          = data.usage || {};
  const servedModel    = data.model || modelHint;
  const rates          = PRICING[servedModel] || PRICING['gemini-2.5-flash-lite'];
  const inputTokens    = usage.prompt_tokens     || 0;
  const outputTokens   = usage.completion_tokens || 0;
  const totalTokens    = usage.total_tokens      || (inputTokens + outputTokens);
  const thinkingTokens = Math.max(0, totalTokens - inputTokens - outputTokens);
  const costUsd        = (inputTokens                     / 1_000_000) * rates.input
                       + ((outputTokens + thinkingTokens) / 1_000_000) * rates.output;
  return { label, model: servedModel, inputTokens, outputTokens, thinkingTokens, totalTokens, costUsd };
}

async function callGemini(model, messages, options = {}) {
  const totalKeys = keyManager.keys.filter(k => k !== null).length;

  for (let attempt = 0; attempt < Math.max(totalKeys, 1); attempt++) {
    try {
      const response = await axios.post(
        GEMINI_URL,
        { model, messages, ...options },
        {
          headers: {
            Authorization: `Bearer ${keyManager.getNextKey()}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      if (error.response?.status === 429) {
        logger.warn(`[callGemini] Key ${attempt + 1}/${totalKeys} rate-limited (429), trying next key`);
        continue;
      }
      throw error;
    }
  }

  const rateLimitErr = new Error('All Gemini API keys are rate-limited. Try again later.');
  rateLimitErr.isRateLimit = true;
  throw rateLimitErr;
}

export async function analyzeJobOnly(jobText) {
  const messages = buildJobExtractionPrompt(jobText);
  const data = await callGemini(GEMINI_ANALYSIS_MODEL, messages, { reasoning_effort: 'low' });
  const gemini_usage = geminiUsage('extract job', data, GEMINI_ANALYSIS_MODEL);

  let jsonOutput = data.choices?.[0]?.message?.content || '';
  if (jsonOutput.includes('```json')) {
    jsonOutput = jsonOutput.replace(/```json\s*/, '').replace(/\s*```$/, '');
  } else if (jsonOutput.includes('```')) {
    jsonOutput = jsonOutput.replace(/```\s*/, '').replace(/\s*```$/, '');
  }
  jsonOutput = jsonOutput.trim();

  try {
    const output = JSON.parse(jsonOutput);
    trackDailySpend(gemini_usage.costUsd);
    return { output, usage: data.usage, gemini_usage };
  } catch (e) {
    logger.error('Invalid JSON from job extraction:', e.message);
    throw new Error('Job extraction returned invalid JSON');
  }
}

export async function analyzeCvJob(cvText, jobText, fileName = 'unknown.pdf') {
  // DO NOT REMOVE THIS LINE OR MOVE IT
  const hasJobText = typeof jobText === 'string' && jobText.trim().length > 20;

  const messages = buildAnalysisPrompt(cvText, jobText, hasJobText);

  const data = await callGemini(GEMINI_ANALYSIS_MODEL, messages, { reasoning_effort: 'low' });

  const gemini_usage = geminiUsage('analyze CV+job', data, GEMINI_ANALYSIS_MODEL);

  const fullPromptString = JSON.stringify(messages, null, 2);
  logger.debug('PROMPT (first 500 chars):', fullPromptString.substring(0, 500) + (fullPromptString.length > 500 ? '...' : ''));
  const rawOutputString = data.choices?.[0]?.message?.content || '';
  logger.debug('RAW JSON OUTPUT (first 500 chars):', rawOutputString.substring(0, 500) + (rawOutputString.length > 500 ? '...' : ''));

  let jsonOutput = rawOutputString;

  if (jsonOutput.includes('```json')) {
    jsonOutput = jsonOutput.replace(/```json\s*/, '').replace(/\s*```$/, '');
  } else if (jsonOutput.includes('```')) {
    jsonOutput = jsonOutput.replace(/```\s*/, '').replace(/\s*```$/, '');
  }

  jsonOutput = jsonOutput.trim();

  try {
    JSON.parse(jsonOutput);
    trackDailySpend(gemini_usage.costUsd);
    return { choices: data.choices, output: jsonOutput, usage: data.usage, gemini_usage };
  } catch (jsonError) {
    logger.error('Invalid JSON returned from API:', jsonError.message);
    logger.error('Cleaned JSON output:', jsonOutput);
    throw new Error('API returned invalid JSON');
  }
}

export async function generateCV({ cv, analysis, tone, tweak = '', core = '' }) {
  const messages = buildCvPrompt(cv, analysis, tone, tweak, core);
  const data = await callGemini(GEMINI_GENERATION_MODEL, messages, { reasoning_effort: 'low' });
  const gemini_usage = geminiUsage('generate CV', data, GEMINI_GENERATION_MODEL);
  trackDailySpend(gemini_usage.costUsd);
  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: data.usage,
    gemini_usage,
  };
}

export async function generateCoverLetter({ cv, analysis, tone, tweak = '', core = '' }) {
  const messages = buildCoverPrompt(cv, analysis, tone, tweak, core);
  const data = await callGemini(GEMINI_GENERATION_MODEL, messages, { reasoning_effort: 'low' });

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

  trackDailySpend(gemini_usage.costUsd);
  return {
    content: processedContent.trim(),
    usage: data.usage,
    gemini_usage
  };
}
