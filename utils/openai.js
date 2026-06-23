// utils/openai.js

import axios from 'axios'
import { Redis } from '@upstash/redis';
import { KeyManager } from './key-manager.js';
import { buildAnalysisPrompt } from '../prompts/analysis.js';
import { buildCvPrompt } from '../prompts/cv-generator.js';
import { buildCoverPrompt } from '../prompts/cover-letter.js';
import { buildJobExtractionPrompt } from '../prompts/job-extraction.js';
import { buildMasterCvPrompt, buildMasterVerifyPrompt } from '../prompts/master-cv.js';
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
const GEMINI_ANALYSIS_MODEL    = 'gemini-2.5-flash-lite';
const GEMINI_GENERATION_MODEL  = 'gemini-2.5-flash-lite';
// Master-CV build/merge: the once-per-user deep pass that every later match reads.
// Kept on flash-lite for dev; this is the call to raise to gemini-2.5-pro (higher
// reasoning_effort) for production output quality — its cost amortises over reuse.
const GEMINI_MASTER_MODEL      = 'gemini-2.5-flash-lite';

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

// Transient server-side failures worth retrying — chiefly Gemini 503 (model
// overloaded), plus the other transient 5xx and bare network errors.
const TRANSIENT_STATUSES = new Set([500, 502, 503, 504]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Pull Gemini's real error message out of the axios error so it isn't hidden
// behind the generic "Request failed with status code 503".
function geminiErrorMessage(error) {
  const d = error.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.error?.message) return d.error.message;
    try { return JSON.stringify(d); } catch { /* fall through */ }
  }
  return error.message || 'unknown error';
}

async function callGemini(model, messages, options = {}) {
  const totalKeys = keyManager.keys.filter(k => k !== null).length;
  // Up to 6 attempts with exponential backoff so a transient 503 (model
  // overloaded) is ridden out. The heavy callers (master build/verify, analysis)
  // run in the 15-min background function, so generous waits are safe there.
  const maxAttempts = Math.max(totalKeys, 6);
  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
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
      lastError = error;
      const status = error.response?.status;

      // 429: this key is rate-limited — rotate to the next key immediately.
      if (status === 429) {
        logger.warn(`[callGemini] Key rate-limited (429), trying next key (${attempt + 1}/${maxAttempts})`);
        continue;
      }

      // Transient server/network error (e.g. Gemini 503 overload): exponential
      // backoff with jitter, then retry. Log Gemini's actual message so a
      // deterministic failure (not real overload) is visible, not hidden.
      const isTransient = TRANSIENT_STATUSES.has(status) || !error.response;
      const detail = geminiErrorMessage(error);
      if (isTransient && attempt < maxAttempts - 1) {
        const backoff = Math.min(10000, 500 * 2 ** attempt) + Math.floor(Math.random() * 250);
        logger.warn(`[callGemini] ${model} transient ${status || error.code || 'network'}: "${detail}" — retry ${attempt + 1}/${maxAttempts} in ${backoff}ms`);
        await sleep(backoff);
        continue;
      }

      logger.error(`[callGemini] ${model} failed (status ${status || error.code || 'network'}): ${detail}`);
      // Surface Gemini's real reason instead of the opaque axios message.
      const surfaced = new Error(`Gemini ${status || ''} ${detail}`.trim());
      surfaced.status = status;
      surfaced.isRateLimit = error.isRateLimit;
      throw surfaced;
    }
  }

  // Attempts exhausted.
  if (lastError?.response?.status === 429) {
    const rateLimitErr = new Error('All Gemini API keys are rate-limited. Try again later.');
    rateLimitErr.isRateLimit = true;
    throw rateLimitErr;
  }
  throw lastError || new Error('Gemini request failed');
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

function stripJsonFences(raw) {
  let s = raw || '';
  if (s.includes('```json')) {
    s = s.replace(/```json\s*/, '').replace(/\s*```$/, '');
  } else if (s.includes('```')) {
    s = s.replace(/```\s*/, '').replace(/\s*```$/, '');
  }
  return s.trim();
}

// Normalise whitespace so a verbatim check tolerates wrapping/spacing differences.
const normWs = (s) => String(s || '').replace(/\s+/g, ' ').trim();

// Deterministic verbatim guard: keep only voice_samples that actually appear in
// the source (or were already trusted from a prior merge). Cheap models sometimes
// paraphrase a "verbatim" quote; this drops any that aren't real substrings.
function pruneVoiceSamples(master, sourceText, trustedMaster) {
  if (!Array.isArray(master.voice_samples)) return master;
  const haystack = normWs(sourceText);
  const trusted = new Set((trustedMaster?.voice_samples || []).map(normWs));
  master.voice_samples = master.voice_samples.filter((q) => {
    const n = normWs(q);
    return n && (haystack.includes(n) || trusted.has(n));
  });
  return master;
}

// Apply the targeted verifier's corrections to the master, deterministically.
function applyVerifyCorrections(master, corr) {
  if (!corr || typeof corr !== 'object') return master;

  if (typeof corr.country === 'string' && corr.country.trim()) {
    master.identity = master.identity || {};
    master.identity.country = corr.country.trim();
  }

  const removeGaps = new Set((corr.remove_gaps || []).map(normWs));
  if (Array.isArray(master.gaps) && removeGaps.size) {
    master.gaps = master.gaps.filter((g) => !removeGaps.has(normWs(g)));
  }

  const badSkills = new Set((corr.unsupported_skills || []).map(normWs));
  const badMetrics = new Set((corr.unsupported_metrics || []).map(normWs));
  if ((badSkills.size || badMetrics.size) && Array.isArray(master.experience)) {
    for (const role of master.experience) {
      for (const a of role.achievements || []) {
        if (badSkills.size && Array.isArray(a.skills_utilized)) {
          a.skills_utilized = a.skills_utilized.filter((s) => !badSkills.has(normWs(s)));
        }
        if (badMetrics.size && a.metric && badMetrics.has(normWs(a.metric))) {
          a.metric = '';
        }
      }
    }
  }
  return master;
}

// Targeted verify pass — see buildMasterVerifyPrompt. Mutates+returns the master
// with corrections applied; returns the verify call's usage (null if it failed,
// which is non-fatal — the unverified master is still usable).
export async function verifyMaster(master, sourceText, trustedMaster = null) {
  try {
    pruneVoiceSamples(master, sourceText, trustedMaster);
    const messages = buildMasterVerifyPrompt({ master, sourceText, trustedMaster });
    const data = await callGemini(GEMINI_MASTER_MODEL, messages, { reasoning_effort: 'low' });
    const gemini_usage = geminiUsage('master-cv verify', data, GEMINI_MASTER_MODEL);
    const corr = JSON.parse(stripJsonFences(data.choices?.[0]?.message?.content || '{}'));
    applyVerifyCorrections(master, corr);
    trackDailySpend(gemini_usage.costUsd);
    return { master, gemini_usage };
  } catch (e) {
    logger.error('master-cv verify failed (using unverified master):', e.message);
    return { master, gemini_usage: null };
  }
}

// Build (or merge into) the per-user MASTER CV — the persisted source-of-truth.
//   buildOrMergeMaster(rawInput)                  → fresh build from raw/unstructured input
//   buildOrMergeMaster(rawInput, existingMaster)  → fold new input into an existing master
// Every build/merge is followed by a targeted verify pass (runs each time the CV
// is updated). Returns { output, usage, gemini_usage (build/merge call),
// usages: [build/merge, verify] for cost logging }.
export async function buildOrMergeMaster(rawInput, existingMaster = null, overrides = []) {
  const mode = existingMaster ? 'merge' : 'build';
  const messages = buildMasterCvPrompt({ mode, rawInput, existingMaster, overrides });
  const data = await callGemini(GEMINI_MASTER_MODEL, messages, { reasoning_effort: 'low' });
  const gemini_usage = geminiUsage(`master-cv ${mode}`, data, GEMINI_MASTER_MODEL);

  const jsonOutput = stripJsonFences(data.choices?.[0]?.message?.content || '');
  let output;
  try {
    output = JSON.parse(jsonOutput);
  } catch (e) {
    logger.error(`Invalid JSON from master-cv ${mode}:`, e.message);
    throw new Error('Master CV build returned invalid JSON');
  }
  trackDailySpend(gemini_usage.costUsd);

  const { gemini_usage: verifyUsage } = await verifyMaster(output, rawInput, existingMaster);

  const usages = [gemini_usage, verifyUsage].filter(Boolean);
  return { output, usage: data.usage, gemini_usage, usages };
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
