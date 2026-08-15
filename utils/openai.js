// utils/openai.js

import axios from 'axios'
import { Redis } from '@upstash/redis';
import { KeyManager } from './key-manager.js';
import { buildAnalysisPrompt } from '../prompts/analysis.js';
import { buildAnalysisTeaserPrompt } from '../prompts/analysis-teaser.js';
import { buildCvPrompt, buildHeadlinePrompt } from '../prompts/cv-generator.js';
import { buildCoverPrompt } from '../prompts/cover-letter.js';
import { buildJobExtractionPrompt } from '../prompts/job-extraction.js';
import { targetJobBlock } from '../prompts/job-target.js';
import { buildGenerationVerifyPrompt, buildPhraseRepairPrompt } from '../prompts/generation-verify.js';
import { buildVoiceProfilePrompt } from '../prompts/voice-profile.js';
import { buildVoiceRewritePrompt } from '../prompts/voice-check.js';
import { validateCv, validateCoverLetter, validationFeedback, bannedPhraseHits, unsourcedDomainHits, coverShapeFaults, coverBreadthFault } from './cv-validate.js';
import { buildMasterCvPrompt } from '../prompts/master-cv.js';
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
// Model allocation by task nature (see CLAUDE.md "AI layer"):
//   lite  — extract / classify / check against a schema or source (verifiable;
//           lite ≈ flagship here at a fraction of the cost)
//   flash — strategy + prose (judgment / voice that can't be fully verified)
// Keeping the per-use heavy calls (analysis, generation) on flash also pulls
// them off the overloaded flash-lite pool.
const GEMINI_EXTRACTION_MODEL  = 'gemini-2.5-flash-lite'; // job-ad parsing, verifiable against the ad
const GEMINI_MASTER_MODEL      = 'gemini-3.5-flash-lite'; // master build — pure extraction, once per user
const GEMINI_VERIFY_MODEL      = 'gemini-3.5-flash-lite'; // master verify — a checker, low creativity
const GEMINI_ANALYSIS_MODEL    = 'gemini-3.5-flash';      // strategic brain that drives every downstream doc
// Exported so tests can count writing calls without a second copy of the model
// string drifting out of step with this one.
export const GEMINI_GENERATION_MODEL = 'gemini-3.6-flash'; // CV/cover prose — writing quality + voice are visible

// Pricing (USD per 1M tokens) — verify at ai.google.dev/gemini-api/docs/pricing
const PRICING = {
  'gemini-2.5-flash-lite': { input: 0.10,  output: 0.40  },
  'gemini-2.5-flash':      { input: 0.30,  output: 2.50  },
  'gemini-2.5-pro':        { input: 1.25,  output: 10.00 },
  'gemini-3.5-flash':      { input: 1.50,  output: 9.00  },
  'gemini-3.5-flash-lite': { input: 0.30,  output: 2.50  },
  'gemini-3.6-flash':      { input: 0.75,  output: 3.75  },
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

export async function callGemini(model, messages, options = {}) {
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
  const data = await callGemini(GEMINI_EXTRACTION_MODEL, messages, { reasoning_effort: 'low' });
  const gemini_usage = geminiUsage('extract job', data, GEMINI_EXTRACTION_MODEL);

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

// Tolerant JSON parse for cheap-model output. The master build/merge runs on the
// overloaded flash-lite pool, which occasionally wraps its JSON in a one-line
// preamble or a trailing note ("Here is the JSON:" / "Let me know if…"). A strict
// JSON.parse on the whole string then throws, the worker swallows it as "build
// failed", and the user is charged for a master that never gets saved. This first
// tries clean parse, then falls back to the first balanced {...} slice so a stray
// preamble can't throw away a paid build. Throws only if nothing parseable exists.
function parseJsonLoose(raw) {
  const s = stripJsonFences(raw);
  try {
    return JSON.parse(s);
  } catch (_) {
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first !== -1 && last > first) {
      return JSON.parse(s.slice(first, last + 1)); // may throw — caller handles it
    }
    throw new SyntaxError('No JSON object found in model output');
  }
}

// Normalise whitespace so a verbatim check tolerates wrapping/spacing differences.
const normWs = (s) => String(s || '').replace(/\s+/g, ' ').trim();





// Build (or merge into) the per-user MASTER CV — the persisted source-of-truth.
//   buildOrMergeMaster(rawInput)                  → fresh build from raw/unstructured input
//   buildOrMergeMaster(rawInput, existingMaster)  → fold new input into an existing master
// Every build/merge is followed by a targeted verify pass (runs each time the CV
// is updated). Returns { output, usage, gemini_usage (build/merge call),
// usages: [build/merge, verify] for cost logging }.
export async function buildOrMergeMaster(rawInput) {
  const mode = 'build';
  const messages = buildMasterCvPrompt({ rawInput });

  // callGemini retries HTTP failures, but a 200 carrying malformed/truncated JSON
  // slips past it and parseJsonLoose throws — dropping a paid build to a null
  // master_cv. Retry the whole call on a parse failure so a one-off bad payload
  // self-corrects. Every paid attempt is cost-logged via `usages`.
  const MAX_PARSE_ATTEMPTS = 3;
  const attemptUsages = [];
  let output;
  let lastData;
  let parseErr;
  for (let attempt = 1; attempt <= MAX_PARSE_ATTEMPTS; attempt++) {
    // temperature 0: the build is pure extraction, so the same CV text must
    // yield the same record. The endpoint default of 1.0 made nesting vary
    // run to run (six client engagements one run, four the next).
    lastData = await callGemini(GEMINI_MASTER_MODEL, messages, { reasoning_effort: 'low', temperature: 0 });
    const gu = geminiUsage(`master-cv ${mode}`, lastData, GEMINI_MASTER_MODEL);
    attemptUsages.push(gu);
    trackDailySpend(gu.costUsd);
    try {
      output = parseJsonLoose(lastData.choices?.[0]?.message?.content || '');
      parseErr = null;
      break;
    } catch (e) {
      parseErr = e;
      logger.error(`Invalid JSON from master-cv ${mode} (attempt ${attempt}/${MAX_PARSE_ATTEMPTS}):`, e.message);
    }
  }
  if (parseErr) throw new Error('Master CV build returned invalid JSON');

  const gemini_usage = attemptUsages[attemptUsages.length - 1];
  const usages = [...attemptUsages].filter(Boolean);
  return { output, usage: lastData.usage, gemini_usage, usages };
}

// Fold the user's own loose text about work their CV never captured into the
// master record. There is no separate augment prompt and no patch logic: the
// stored record plus the new text are re-extracted together through the ONE
// extraction prompt, so the output is shaped by the same rules that built it.
// That is what places a client engagement dated inside the consultancy's span
// under `fractional_engagements` instead of appending it as a parallel role —
// a patch would have to re-decide that with logic of its own, and drift.
export async function augmentMaster(master, text) {
  const combined = `EXISTING CAREER RECORD (JSON):\n${JSON.stringify(master)}\n\nADDITIONAL INFORMATION THE PERSON HAS SUPPLIED ABOUT THEIR OWN CAREER:\n${text}`;
  return buildOrMergeMaster(combined);
}

// Landing-page TEASER analysis — small, high-impact output on the strong model
// (~$0.02 vs ~$0.05 for the full pass). Hero fields are full quality. The full
// deep analysis runs after sign-up, building on this teaser.
export async function analyzeTeaser(cvText, jobText, layoutNote = '') {
  const hasJobText = typeof jobText === 'string' && jobText.trim().length > 20;
  const messages = buildAnalysisTeaserPrompt(cvText, jobText, hasJobText, layoutNote);
  const data = await callGemini(GEMINI_ANALYSIS_MODEL, messages, { reasoning_effort: 'low' });
  const gemini_usage = geminiUsage('analyze teaser', data, GEMINI_ANALYSIS_MODEL);

  const jsonOutput = stripJsonFences(data.choices?.[0]?.message?.content || '');
  try {
    JSON.parse(jsonOutput);
    trackDailySpend(gemini_usage.costUsd);
    return { output: jsonOutput, usage: data.usage, gemini_usage };
  } catch (e) {
    logger.error('Invalid JSON from teaser analysis:', e.message);
    throw new Error('Teaser analysis returned invalid JSON');
  }
}

// Merge the carried-forward teaser object with the deep DELTA the full pass
// produced. The delta never re-emits the teaser's fields (see prompts/analysis.js),
// so we glue them: top-level keys union, `analysis` and `job_match` merged key-wise
// with the delta winning on shared keys (e.g. red_flags expands from teaser's
// preview to the full list). Teaser-only keys (scores, verdicts, final_thought,
// positioning_strategy) survive untouched.
export function mergeTeaserAndDelta(teaser, delta) {
  return {
    ...teaser,
    ...delta,
    analysis: { ...(teaser.analysis || {}), ...(delta.analysis || {}) },
    job_match: { ...(teaser.job_match || {}), ...(delta.job_match || {}) },
  };
}

// One deep sub-call: run the prompt for `mode` and return its parsed delta.
async function runDeltaPass(cvText, jobText, hasJobText, teaserObj, mode) {
  const messages = buildAnalysisPrompt(cvText, jobText, hasJobText, teaserObj, mode);
  const data = await callGemini(GEMINI_ANALYSIS_MODEL, messages, { reasoning_effort: 'medium' });
  const gemini_usage = geminiUsage(`analyze CV+job (${mode})`, data, GEMINI_ANALYSIS_MODEL);

  const raw = data.choices?.[0]?.message?.content || '';
  logger.debug(`RAW JSON OUTPUT (${mode}, first 500 chars):`, raw.substring(0, 500) + (raw.length > 500 ? '...' : ''));

  const parsed = JSON.parse(stripJsonFences(raw));
  trackDailySpend(gemini_usage.costUsd);
  return { parsed, gemini_usage, usage: data.usage, choices: data.choices };
}

// `teaser` (optional): the parsed teaser object (or its JSON string) already
// produced for this CV. When supplied, the deep pass is SPLIT IN TWO parallel
// calls — 'blueprint' (what the generators execute) and 'review' (what the user
// reads) — so neither half has to share one output budget with the other. Both
// deltas plus the carried teaser fields are merged into one analysis object.
// With no teaser, the full schema is generated in a single call as before.
export async function analyzeCvJob(cvText, jobText, fileName = 'unknown.pdf', teaser = null) {
  // DO NOT REMOVE THIS LINE OR MOVE IT
  const hasJobText = typeof jobText === 'string' && jobText.trim().length > 20;

  const teaserObj = typeof teaser === 'string' ? JSON.parse(teaser) : teaser;

  if (teaserObj) {
    // SETTLED, not all: the two halves are independent products — 'blueprint' is
    // what the generators execute, 'review' is what the user reads. Promise.all
    // meant one flaky call (a 503, or output truncated mid-JSON) threw away the
    // other half's finished, already-paid-for work, and the caller fell all the
    // way back to the teaser. A failed half now costs only that half.
    const [bpRes, rvRes] = await Promise.allSettled([
      runDeltaPass(cvText, jobText, hasJobText, teaserObj, 'blueprint'),
      runDeltaPass(cvText, jobText, hasJobText, teaserObj, 'review'),
    ]);

    const blueprint = bpRes.status === 'fulfilled' ? bpRes.value : null;
    const review = rvRes.status === 'fulfilled' ? rvRes.value : null;
    if (!blueprint) logger.error('Deep analysis blueprint pass failed:', bpRes.reason?.message);
    if (!review) logger.error('Deep analysis review pass failed:', rvRes.reason?.message);

    // Only when BOTH halves failed is there no delta at all — then the caller's
    // teaser fallback is the right answer.
    if (!blueprint && !review) {
      throw new Error(bpRes.reason?.message || 'Deep analysis produced nothing');
    }

    const delta = blueprint && review
      ? mergeTeaserAndDelta(blueprint.parsed, review.parsed)
      : (blueprint || review).parsed;
    const merged = mergeTeaserAndDelta(teaserObj, delta);
    // The ad's own words ride on the analysis record, attached HERE rather than
    // in the Netlify worker so every caller of this function gets them — the
    // worker, the local harness, and anything added later. The cover letter
    // reads them via prompts/job-target.js (rawAdBlock); the extraction stays
    // the fallback for records saved before this existed.
    if (typeof jobText === 'string' && jobText.trim()) merged.job_text = jobText.trim().slice(0, 8000);
    // Cost-log every call that actually completed — see the AI cost logging rule.
    const gemini_usages = [blueprint?.gemini_usage, review?.gemini_usage].filter(Boolean);
    const primary = blueprint || review;

    return {
      choices: primary.choices,
      output: JSON.stringify(merged),
      usage: primary.usage,
      gemini_usage: primary.gemini_usage,
      gemini_usages,
    };
  }

  const messages = buildAnalysisPrompt(cvText, jobText, hasJobText, null);

  const data = await callGemini(GEMINI_ANALYSIS_MODEL, messages, { reasoning_effort: 'medium' });

  const gemini_usage = geminiUsage('analyze CV+job', data, GEMINI_ANALYSIS_MODEL);

  const rawOutputString = data.choices?.[0]?.message?.content || '';
  logger.debug('RAW JSON OUTPUT (first 500 chars):', rawOutputString.substring(0, 500) + (rawOutputString.length > 500 ? '...' : ''));

  const jsonOutput = stripJsonFences(rawOutputString);

  try {
    JSON.parse(jsonOutput);
    trackDailySpend(gemini_usage.costUsd);
    return { choices: data.choices, output: jsonOutput, usage: data.usage, gemini_usage, gemini_usages: [gemini_usage] };
  } catch (jsonError) {
    logger.error('Invalid JSON returned from API:', jsonError.message);
    logger.error('Cleaned JSON output:', jsonOutput);
    throw new Error('API returned invalid JSON');
  }
}

// Apply the verify pass's findings to a generated document — deterministically,
// by EXACT string match. A reported span that isn't literally in the document is
// discarded, so a checker that hallucinates a quote changes nothing. An empty
// replacement deletes the span, and a line left empty (or a bullet left with no
// content) goes with it rather than leaving a stray dash behind.
export function applyGenerationCorrections(document, corrections) {
  let out = document;
  const applied = [];

  for (const c of Array.isArray(corrections) ? corrections : []) {
    const quote = typeof c?.quote === 'string' ? c.quote.trim() : '';
    if (!quote || !out.includes(quote)) continue;
    let replacement = typeof c?.replacement === 'string' ? c.replacement.trim() : '';
    // A DELETION MUST NOT EAT THE SENTENCE BOUNDARY.
    //
    // The checker quotes what it wants gone, and its quote routinely runs to the
    // end of the sentence — punctuation included. Removing it outright welds the
    // next sentence onto the previous one: a real run shipped "…a group of
    // twelve Earlier, at Česká spořitelna…", two sentences with the full stop
    // between them deleted. The span is still cut; only its terminator is kept,
    // and only when the deletion would otherwise leave the sentence unterminated.
    if (!replacement && /[.!?]\s*$/.test(quote)) {
      const terminator = quote.trim().slice(-1);
      const before = out.slice(0, out.indexOf(quote));
      if (!/[.!?]["')\]]?\s*$/.test(before)) replacement = terminator;
    }
    out = out.split(quote).join(replacement);
    applied.push({ quote, replacement, reason: c?.reason || '' });
  }

  if (applied.length) {
    // Drop lines the deletions emptied: a bare bullet ("-", "*", "•") or blank
    // markdown list item left behind by removing all of its text.
    out = out
      .split('\n')
      .filter((line, i, arr) => {
        const t = line.trim();
        if (/^([-*•]|\d+\.)$/.test(t)) return false;
        // collapse a run of blank lines the deletions created
        return !(t === '' && i > 0 && arr[i - 1].trim() === '' && arr[i - 2]?.trim() === '');
      })
      .join('\n');

    // THE PUNCTUATION THE DELETIONS ORPHANED.
    //
    // Corrections are applied by literal string removal, so cutting the tail of
    // a sentence leaves its punctuation and spacing behind. A real run shipped
    // "…product strategy and experience design, ." to the page: a comma, a
    // space and a full stop with nothing between them. It is the removal's own
    // debris, not the model's prose, so it is cleaned deterministically — no
    // second AI call, and nothing here can touch a character the writer wrote
    // except the whitespace and punctuation left stranded around the hole.
    out = out
      // ", ." / " ;." / ",  ," — a separator immediately followed by a
      // terminator or another separator: keep the last one only.
      .replace(/[,;:]\s*(?=[.!?,;:])/g, '')
      // " ." / " ," — space before punctuation, from a cut that ended a clause.
      .replace(/\s+([.!?,;:])/g, '$1')
      // "word  word" — a double space where a span used to be.
      .replace(/[^\S\n]{2,}/g, ' ')
      // ".." / ".?" from cutting a whole sentence out of the middle.
      .replace(/([.!?])[.!?]+/g, '$1')
      // Leading whitespace a cut left at the head of a paragraph.
      .split('\n').map((line) => (line.trim() ? line.replace(/^[^\S\n]+/, '') : line)).join('\n')
      .trim();
  }

  return { content: out, applied };
}

// Verify a GENERATED document against the master record and strip/downgrade the
// claims the master does not support. Non-fatal: any failure returns the
// document untouched, because an unverified CV still beats no CV.
export async function verifyGeneratedDoc({ document, master, docType = 'cv', language = 'auto' }) {
  try {
    if (!document || !master) return { content: document, gemini_usage: null, applied: [] };
    const messages = buildGenerationVerifyPrompt({ docType, document, master, language });
    const data = await callGemini(GEMINI_VERIFY_MODEL, messages, { reasoning_effort: 'low' });
    const gemini_usage = geminiUsage(`verify ${docType}`, data, GEMINI_VERIFY_MODEL);
    const parsed = JSON.parse(stripJsonFences(data.choices?.[0]?.message?.content || '{}'));
    const { content, applied } = applyGenerationCorrections(document, parsed.unsupported);
    if (applied.length) {
      logger.info(`[verify ${docType}] ${applied.length} unsupported claim(s) corrected:`, applied.map((a) => a.reason).join('; '));
    }
    trackDailySpend(gemini_usage.costUsd);
    return { content, gemini_usage, applied };
  } catch (e) {
    logger.error(`generation verify failed (${docType}, using unverified document):`, e.message);
    return { content: document, gemini_usage: null, applied: [] };
  }
}

// One narrow call, only when stock phrasing survived the verify pass, over only
// the spans that carry it. The alternative — a hard validation failure feeding
// the full regeneration — reprints a finished document to fix a clause and can
// come back worse in ways nothing measures. Corrections are applied by the same
// literal-match path, so anything the repair invents is discarded.
export async function repairStockPhrases({ document, docType = 'cv', language = 'auto' }) {
  const hits = bannedPhraseHits(document, language);
  if (!hits.length) return { content: document, gemini_usage: null, applied: [] };

  try {
    const messages = buildPhraseRepairPrompt({ docType, document, hits });
    const data = await callGemini(GEMINI_VERIFY_MODEL, messages, { reasoning_effort: 'low' });
    const gemini_usage = geminiUsage(`repair phrases ${docType}`, data, GEMINI_VERIFY_MODEL);
    const parsed = JSON.parse(stripJsonFences(data.choices?.[0]?.message?.content || '{}'));
    const { content, applied } = applyGenerationCorrections(document, parsed.unsupported);
    trackDailySpend(gemini_usage.costUsd);

    const left = bannedPhraseHits(content, language);
    if (left.length) {
      logger.error(`[repair phrases ${docType}] survived: ${left.join(', ')}`);
    } else {
      logger.info(`[repair phrases ${docType}] ${applied.length} stock phrase(s) removed`);
    }
    return { content, gemini_usage, applied };
  } catch (e) {
    logger.error(`stock-phrase repair failed (${docType}, keeping document):`, e.message);
    return { content: document, gemini_usage: null, applied: [] };
  }
}

// Layer 6, check 23 — the invented industry, REPAIRED rather than reported. The
// letter that named "fintech" over an ad asking for financial advisory is the
// case: the word is in neither the ad nor the master, and no AI pass reaches it,
// because a bare domain noun carries no number, no date and no upgraded verb.
//
// Same machinery as the stock-phrase repair — hits found in code, one narrow
// call, corrections applied by literal string match — because it is the same
// defect class: the app's own writing failing, fixed before delivery instead of
// handed to the candidate as a warning about their own document.
export async function repairUnsourcedDomains({ document, master = '' }) {
  const hits = unsourcedDomainHits(document, { master });
  if (!hits.length) return { content: document, gemini_usage: null, applied: [] };

  try {
    const messages = buildPhraseRepairPrompt({ docType: 'cover', document, hits, kind: 'domain' });
    const data = await callGemini(GEMINI_VERIFY_MODEL, messages, { reasoning_effort: 'low' });
    const gemini_usage = geminiUsage('repair unsourced domain', data, GEMINI_VERIFY_MODEL);
    const parsed = JSON.parse(stripJsonFences(data.choices?.[0]?.message?.content || '{}'));
    const { content, applied } = applyGenerationCorrections(document, parsed.unsupported);
    trackDailySpend(gemini_usage.costUsd);

    const left = unsourcedDomainHits(content, { master });
    if (left.length) {
      logger.error(`[repair domain cover] survived: ${left.join(', ')}`);
    } else {
      logger.info(`[repair domain cover] ${applied.length} invented domain label(s) removed`);
    }
    return { content, gemini_usage, applied };
  } catch (e) {
    logger.error('unsourced-domain repair failed (keeping document):', e.message);
    return { content: document, gemini_usage: null, applied: [] };
  }
}

// ── Voice profile ────────────────────────────────────────────────────────────
//
// Build the profile ONCE, from samples of the user's own writing. Reading prose
// and describing its manner is judgment that cannot be checked against a schema,
// so it runs on the ANALYSIS model rather than lite — and it runs once per user,
// so the quality is close to free.
//
// Throws on failure: unlike the generation passes there is nothing to fall back
// to and nothing already paid for to protect. The caller shows the error and the
// user tries again.
export async function buildVoiceProfile(samples) {
  const messages = buildVoiceProfilePrompt({ samples });
  const data = await callGemini(GEMINI_ANALYSIS_MODEL, messages, { reasoning_effort: 'medium' });
  const gemini_usage = geminiUsage('voice profile', data, GEMINI_ANALYSIS_MODEL);
  trackDailySpend(gemini_usage.costUsd);

  const parsed = JSON.parse(stripJsonFences(data.choices?.[0]?.message?.content || '{}'));

  // Coerce to the stored shape here, so nothing downstream has to guess. A
  // trait with no translation is dropped: an untranslated List B habit must
  // never reach a generator, which is the entire point of the split.
  const list_a = (Array.isArray(parsed.list_a) ? parsed.list_a : [])
    .map((o) => String(o || '').trim())
    .filter(Boolean);
  const list_b = (Array.isArray(parsed.list_b) ? parsed.list_b : [])
    .map((b) => ({
      trait: String(b?.trait || '').trim(),
      translation: String(b?.translation || '').trim(),
    }))
    .filter((b) => b.trait && b.translation);

  return {
    profile: { list_a, list_b, confidence: String(parsed.confidence || '').trim() },
    gemini_usage,
  };
}

// Bring a finished letter back to the author's own voice: ONE call that finds
// where the draft diverges from the profile and rewrites only those parts.
//
// This is where most of the voice actually comes from — a first draft drifts to
// generic business prose however the prompt is written. It runs on the generation
// model because judging cadence and rewriting in a person's manner is prose work,
// not schema-checking.
//
// Non-fatal: any failure returns the document untouched, because a letter in the
// wrong voice still beats no letter. Repairs are applied by literal string match
// (applyGenerationCorrections), so a "repair" quoting text the letter does not
// contain is discarded — which is what keeps a style pass from rewriting the
// document out from under the fact-checker that runs after it.
export async function applyVoice({ document, profile, docType = 'cover', jobText = '', master = '' }) {
  const usages = [];
  const empty = { content: document, gemini_usages: usages, applied: [] };
  if (!document || !profile) return empty;

  // Nothing to match against: no List A, no translated List B, no user lines.
  const hasProfile =
    (Array.isArray(profile.list_a) && profile.list_a.length > 0) ||
    (Array.isArray(profile.list_b) && profile.list_b.some((b) => String(b?.translation || '').trim())) ||
    String(profile.profile_text || '').trim().length > 0;
  if (!hasProfile) return empty;

  // ONE FULL REWRITE, then a SECOND only if the letter is still measurably flat
  // (CV_RULES.md check 24). Capped at two: a third call spends real money to
  // chase a metric, and the second already has the numbers in front of it.
  //
  // Facts are protected by ORDER, not by the size of the edit — this runs before
  // verifyGeneratedDoc, which reads whatever text comes out of here.
  const rewrite = async (draft, faults) => {
    const messages = buildVoiceRewritePrompt({ document: draft, profile, jobText, shapeFaults: faults });
    const data = await callGemini(GEMINI_GENERATION_MODEL, messages, { reasoning_effort: 'medium', temperature: 0.9 });
    const gemini_usage = geminiUsage(`voice rewrite ${docType}`, data, GEMINI_GENERATION_MODEL);
    usages.push(gemini_usage);
    trackDailySpend(gemini_usage.costUsd);
    return String(data.choices?.[0]?.message?.content || '').trim();
  };

  // Shape (check 24) and breadth (Layer 3, depth not coverage) are both faults
  // the rewrite fixes the same way — by cutting — so they travel together.
  const faultsOf = (text) => {
    const faults = coverShapeFaults(text);
    const breadth = coverBreadthFault(text, master);
    return breadth ? [breadth, ...faults] : faults;
  };

  // A rewrite that came back a fragment, an apology or a JSON object is not a
  // letter. The draft is kept rather than shipping wreckage — this is the only
  // judgement made about the rewrite's content, since everything else it could
  // get wrong is caught by the truth passes that follow.
  const usable = (candidate, draft) => {
    if (!candidate || candidate.length < 200) return false;
    if (/^[[{]/.test(candidate)) return false;
    const ratio = candidate.split(/\s+/).length / Math.max(1, draft.split(/\s+/).length);
    return ratio > 0.5 && ratio < 1.6;
  };

  try {
    let content = document;
    let faults = faultsOf(document);

    const first = await rewrite(content, faults);
    if (usable(first, content)) content = first;
    else logger.error(`voice rewrite ${docType}: unusable output, keeping the draft`);

    faults = faultsOf(content);
    if (faults.length) {
      logger.info(`[voice ${docType}] still flat after the rewrite, one more pass: ${faults.length} fault(s)`);
      const second = await rewrite(content, faults);
      if (usable(second, content)) {
        // Keep the second only if it actually improved the shape — a rewrite
        // that trades one flatness for another is churn.
        if (faultsOf(second).length < faults.length) content = second;
      }
    }

    logger.info(`[voice ${docType}] rewritten in the candidate's voice (${usages.length} call(s))`);
    return { content, gemini_usages: usages, applied: [] };
  } catch (e) {
    logger.error(`voice rewrite failed (${docType}, keeping document):`, e.message);
    return { ...empty, gemini_usages: usages };
  }
}

// The CV as it leaves the model, dressed for reading — the counterpart to
// dressLetter.
//
// prompts/cv-generator.js states its template with <!-- BLOCK:START --> /
// <!-- BLOCK:END --> markers around the repeatable parts. They are scaffolding
// for the model's eyes and nothing consumes them. One writing model dropped
// them; another copied them into the document, and they went all the way to the
// page — a CV with HTML comments in it. Which model is in the constant is not
// the question: template punctuation is the prompt's, never the document's, so
// it is removed here for every model, forever.
export function dressCv(rawContent) {
  return String(rawContent || '')
    .replace(/^[^\S\n]*<!--[\s\S]*?-->[^\S\n]*\n?/gm, '') // a comment on its own line: take the line
    .replace(/<!--[\s\S]*?-->/g, '')                      // any that were inline
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function generateCV({ cv, analysis, tone, tweak = '', core = '', language = 'auto' }) {
  const messages = buildCvPrompt(cv, analysis, tone, tweak, core, language);
  // medium effort: 'low' is exactly where a writing model drops the constraints
  // that keep it honest (don't upgrade the verb, don't invent a number); the
  // low temperature holds it to the record's own wording rather than a
  // more-impressive paraphrase of it.
  const data = await callGemini(GEMINI_GENERATION_MODEL, messages, { reasoning_effort: 'medium', temperature: 0.4 });
  const gemini_usage = geminiUsage('generate CV', data, GEMINI_GENERATION_MODEL);
  trackDailySpend(gemini_usage.costUsd);
  const usages = [gemini_usage];

  // Safety net over the prose: strip anything the master doesn't evidence.
  let verified = await verifyGeneratedDoc({
    document: dressCv(data.choices?.[0]?.message?.content || ''),
    master: cv,
    docType: 'cv',
    language,
  });
  if (verified.gemini_usage) usages.push(verified.gemini_usage);

  // Stock phrasing the verify pass missed: repaired in place, never regenerated.
  const cvRepair = await repairStockPhrases({ document: verified.content, docType: 'cv', language });
  if (cvRepair.gemini_usage) usages.push(cvRepair.gemini_usage);
  verified = { ...verified, content: cvRepair.content };

  // Layer 6 — deterministic output validation. Checks 1-4 are hard blocks, so a
  // failing draft is regenerated ONCE with the exact failures fed back; checks
  // 5-9 are warnings that ride out to the caller for the user to see.
  let validation = validateCv(verified.content, { master: cv, analysis, language });
  if (!validation.ok) {
    logger.info(`[validate cv] hard failures, regenerating once: ${validation.hard.join(' | ')}`);
    const retryMessages = [...messages, { role: 'user', content: validationFeedback(validation.hard) }];
    const retry = await callGemini(GEMINI_GENERATION_MODEL, retryMessages, { reasoning_effort: 'medium', temperature: 0.4 });
    const retryUsage = geminiUsage('generate CV (validation retry)', retry, GEMINI_GENERATION_MODEL);
    trackDailySpend(retryUsage.costUsd);
    usages.push(retryUsage);

    const reVerified = await verifyGeneratedDoc({
      // Dressed identically to the draft it may replace — a retry judged on text
      // the candidate would never receive is judged on the wrong document.
      document: dressCv(retry.choices?.[0]?.message?.content || ''),
      master: cv,
      docType: 'cv',
      language,
    });
    if (reVerified.gemini_usage) usages.push(reVerified.gemini_usage);

    // The retry is a fresh draft, so it can reintroduce stock phrasing the first
    // repair removed. Repair it the same way — spans only, never a regeneration.
    const reRepair = await repairStockPhrases({ document: reVerified.content, docType: 'cv', language });
    if (reRepair.gemini_usage) usages.push(reRepair.gemini_usage);

    const revalidated = validateCv(reRepair.content, { master: cv, analysis, language });
    // Keep the retry only if it actually improved on the draft it replaced.
    if (revalidated.hard.length <= validation.hard.length) {
      verified = { ...reVerified, content: reRepair.content };
      validation = revalidated;
    }
    if (!validation.ok) {
      logger.error(`[validate cv] hard failures survived the retry: ${validation.hard.join(' | ')}`);
    }
  }

  return {
    content: verified.content,
    usage: data.usage,
    gemini_usage,
    validation,
    // Every call, for the cost-logging rule (DB row + console line each).
    gemini_usages: usages,
  };
}

// Headline-only regeneration — one short call on the generation model, so the
// re-rolled tagline is written by the same model (and to the same rules) as the
// headline the full CV pass produced.
export async function generateHeadline({ cv, analysis, tone, current = '', language = 'auto' }) {
  const messages = buildHeadlinePrompt(cv, analysis, tone, current, language);
  const data = await callGemini(GEMINI_GENERATION_MODEL, messages, { reasoning_effort: 'low', temperature: 0.6 });
  const gemini_usage = geminiUsage('generate headline', data, GEMINI_GENERATION_MODEL);
  trackDailySpend(gemini_usage.costUsd);

  // The model is told to return the bare line; strip any markdown or quoting it
  // adds anyway so the caller always gets plain headline text.
  const headline = (data.choices?.[0]?.message?.content || '')
    .split('\n').map((l) => l.trim()).find((l) => l !== '') || '';

  return {
    content: headline.replace(/^\*+|\*+$/g, '').replace(/^["'“”]|["'“”]$/g, '').replace(/[.]$/, '').trim(),
    gemini_usage,
    gemini_usages: [gemini_usage],
  };
}

// The letter as it leaves the model, dressed for sending: the model's own date
// line dropped, placeholders removed, today's real date prepended. Shared by the
// first draft and the validation retry, which must be processed identically or
// the retry is judged on text the candidate would never receive.
export function dressLetter(rawContent) {
  // A line that is JUST a date, in any of the forms the model actually emits.
  // The old pattern missed the day-first form ("10 August 2026"), so that line
  // survived and the real date was prepended above it — two dates on the letter.
  // Every month name the product can generate in, not just English: this is an EU
  // product, and a Czech letter dates itself "13. srpna 2026". An unmatched date
  // line survives and today's date is prepended above it — two dates on the page.
  // Czech and Polish names are listed in the GENITIVE, which is the form a date
  // actually uses ("13. srpna", never "13. srpen").
  const MONTH_EN = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t)?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
  const MONTH_CS = 'ledna|února|unora|března|brezna|dubna|května|kvetna|června|cervna|července|cervence|srpna|září|zari|října|rijna|listopadu|prosince';
  const MONTH_PL = 'stycznia|lutego|marca|kwietnia|maja|czerwca|lipca|sierpnia|września|wrzesnia|października|pazdziernika|listopada|grudnia';
  const MONTH = `(?:${MONTH_EN}|${MONTH_CS}|${MONTH_PL})`;
  const leadingDateRegex = new RegExp(
    '^\\s*(?:'
      + '\\d{1,2}\\s*[./-]\\s*\\d{1,2}\\s*[./-]\\s*\\d{2,4}'  // 12/08/2023, 12.08.2023, 13. 8. 2026
      + '|\\d{4}-\\d{1,2}-\\d{1,2}'                    // 2023-08-12
      + `|\\d{1,2}(?:st|nd|rd|th)?\\.?\\s+${MONTH}\\.?\\,?\\s+\\d{4}` // 10 August 2026, 13. srpna 2026
      + `|${MONTH}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?\\,?\\s+\\d{4}` // August 12, 2023
      + `|${MONTH}\\.?\\s+\\d{4}`                      // August 2023
    + ')[.,]?\\s*$',
    'i'
  );

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
  return `${todayString}\n\n${processedContent}`.trim();
}

export async function generateCoverLetter({ cv, analysis, tone, tweak = '', core = '', language = 'auto', voiceProfile = null }) {
  const messages = buildCoverPrompt(cv, analysis, tone, tweak, core, language, new Date(), voiceProfile);
  // See generateCV: medium effort + low temperature keep the letter tied to the
  // record instead of drifting into a better-sounding version of it.
  // The LETTER runs hotter than the CV. A CV is a record and 0.4 keeps it tied to
  // one; a letter at 0.4 converges on the same four safe paragraphs for everyone,
  // which is the flatness the voice pass then has to undo. Facts are protected by
  // the verify pass that follows, not by a cold sampler.
  const data = await callGemini(GEMINI_GENERATION_MODEL, messages, { reasoning_effort: 'medium', temperature: 0.55 });

  const gemini_usage = geminiUsage('generate cover letter', data, GEMINI_GENERATION_MODEL);
  const usages = [gemini_usage];

  const processedContent = dressLetter(data.choices?.[0]?.message?.content || '');

  trackDailySpend(gemini_usage.costUsd);

  // The voice rewrite is a FALLBACK now, not a stage.
  //
  // The writer composes in the candidate's voice from the first sentence
  // (prompts/cover-letter.js), so a second model reshaping its output is a
  // second owner for one document — and reshaping another model's letter is what
  // produced fragments: orphan one-liners, stubs, a weak close. It runs ONLY
  // when the finished letter measures flat or walks half the career, which is
  // the case it was built for.
  //
  // Still before the truth passes, so anything it does is fact-checked after.
  // ONE OWNER. The rewrite is gone from this path entirely.
  //
  // It was kept as a fallback for a draft that measured flat. Run against a real
  // record and a real ad it did the opposite: handed a thin draft, it satisfied
  // the shape measurement literally and produced a five-word orphan paragraph
  // ("Data must drive the algorithm.") — a second model reshaping the first
  // model's letter, which is the defect the writer-owns-the-voice change already
  // established. A flat draft is a writing-prompt problem and it is fixed in
  // prompts/cover-letter.js, not by a call that re-cuts the wreckage.
  //
  // The shape measurements themselves survive as Layer 6 checks — they tell the
  // candidate what the letter is, which is what they were good for.
  const draft = processedContent.trim();
  const voiced = { content: draft, gemini_usages: [], applied: [] };

  // Verify AFTER the date/placeholder cleanup, so the checker sees exactly the
  // text the candidate will send.
  const verified = await verifyGeneratedDoc({
    document: voiced.content,
    master: cv,
    docType: 'cover',
    language,
  });

  // Layer 6 for the letter: the banned-phrase repair, then the letter's own
  // checks (word band, matched pairs, salutation, one objection, numbers).
  const repair = await repairStockPhrases({ document: verified.content, docType: 'cover', language });
  const domainRepair = await repairUnsourcedDomains({ document: repair.content, master: cv });
  usages.push(...(voiced.gemini_usages || []));
  if (verified.gemini_usage) usages.push(verified.gemini_usage);
  if (repair.gemini_usage) usages.push(repair.gemini_usage);
  if (domainRepair.gemini_usage) usages.push(domainRepair.gemini_usage);

  let content = domainRepair.content;
  let validation = validateCoverLetter(content, { master: cv, analysis, language, tweak });

  // The word band is a hard failure, so an over-length letter is regenerated
  // ONCE with the count fed back — the same shape as generateCV's retry, and the
  // retry is kept only if it did not make things worse. The voice pass is not
  // repeated: its fixes are already in the draft the model is asked to shorten,
  // and re-running it on a cut-down letter spends a call to re-learn them.
  if (!validation.ok) {
    logger.info(`[validate cover] hard failures, regenerating once: ${validation.hard.join(' | ')}`);
    const retryMessages = [...messages, { role: 'user', content: validationFeedback(validation.hard, 'cover') }];
    const retry = await callGemini(GEMINI_GENERATION_MODEL, retryMessages, { reasoning_effort: 'medium', temperature: 0.4 });
    const retryUsage = geminiUsage('generate cover letter (validation retry)', retry, GEMINI_GENERATION_MODEL);
    trackDailySpend(retryUsage.costUsd);
    usages.push(retryUsage);

    const reVerified = await verifyGeneratedDoc({
      document: dressLetter(retry.choices?.[0]?.message?.content || ''),
      master: cv,
      docType: 'cover',
      language,
    });
    if (reVerified.gemini_usage) usages.push(reVerified.gemini_usage);

    const reRepair = await repairStockPhrases({ document: reVerified.content, docType: 'cover', language });
    if (reRepair.gemini_usage) usages.push(reRepair.gemini_usage);

    const reDomain = await repairUnsourcedDomains({ document: reRepair.content, master: cv });
    if (reDomain.gemini_usage) usages.push(reDomain.gemini_usage);

    const revalidated = validateCoverLetter(reDomain.content, { master: cv, analysis, language, tweak });
    if (revalidated.hard.length <= validation.hard.length) {
      content = reDomain.content;
      validation = revalidated;
    }
    if (!validation.ok) {
      logger.error(`[validate cover] hard failures survived the retry: ${validation.hard.join(' | ')}`);
    }
  }

  return {
    content,
    usage: data.usage,
    validation,
    gemini_usage,
    // Every call, in order — the cost-logging rule covers the voice passes too.
    gemini_usages: usages,
    voice_fixes: voiced.applied || [],
  };
}
