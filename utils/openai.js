// utils/openai.js

import axios from 'axios'
import { Redis } from '@upstash/redis';
import { KeyManager } from './key-manager.js';
import { buildAnalysisPrompt } from '../prompts/analysis.js';
import { buildAnalysisTeaserPrompt } from '../prompts/analysis-teaser.js';
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
// Model allocation by task nature (see CLAUDE.md "AI layer"):
//   lite  — extract / classify / check against a schema or source (verifiable;
//           lite ≈ flagship here at a fraction of the cost)
//   flash — strategy + prose (judgment / voice that can't be fully verified)
// Keeping the per-use heavy calls (analysis, generation) on flash also pulls
// them off the overloaded flash-lite pool.
const GEMINI_EXTRACTION_MODEL  = 'gemini-2.5-flash-lite'; // job-ad parsing, verifiable against the ad
const GEMINI_MASTER_MODEL      = 'gemini-3.5-flash';      // master build/merge — backstopped by verify
const GEMINI_VERIFY_MODEL      = 'gemini-2.5-flash-lite'; // master verify — a checker, low creativity
const GEMINI_ANALYSIS_MODEL    = 'gemini-3.5-flash';      // strategic brain that drives every downstream doc
const GEMINI_GENERATION_MODEL  = 'gemini-2.5-flash';      // CV/cover prose — writing quality + voice are visible

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
  const badAchievements = new Set((corr.unsupported_achievements || []).map(normWs));
  // Real role kept, but an invented atomic field reverted to empty (never a guess).
  const roleKey = (r) => `${normWs(r && r.company)} ${normWs(r && r.role)}`;
  const inventedLocations = new Set((corr.invented_locations || []).filter((r) => r && typeof r === 'object').map(roleKey));
  const inventedDates = new Set((corr.invented_dates || []).filter((r) => r && typeof r === 'object').map(roleKey));
  const badRoles = new Set(
    (corr.unsupported_roles || [])
      .filter((r) => r && typeof r === 'object')
      .map((r) => `${normWs(r.company)} ${normWs(r.role)}`)
  );

  if (Array.isArray(master.experience)) {
    // Drop wholly-fabricated roles first (company + role both absent from source).
    if (badRoles.size) {
      master.experience = master.experience.filter(
        (role) => !badRoles.has(`${normWs(role.company)} ${normWs(role.role)}`)
      );
    }
    for (const role of master.experience) {
      if (inventedLocations.size && inventedLocations.has(roleKey(role))) role.location = '';
      if (inventedDates.size && inventedDates.has(roleKey(role))) role.dates = '';
      if (badAchievements.size && Array.isArray(role.achievements)) {
        // Drop wholly-invented achievements (text not evidenced by the source).
        role.achievements = role.achievements.filter((a) => !badAchievements.has(normWs(a.text)));
      }
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

  // Drop transferable_notes whose observation is an invented strength.
  const badNotes = new Set((corr.unsupported_notes || []).map(normWs));
  if (badNotes.size && Array.isArray(master.transferable_notes)) {
    master.transferable_notes = master.transferable_notes.filter(
      (n) => !badNotes.has(normWs(n.observation))
    );
  }
  return master;
}

// Deterministic per-role grounding: every HARD fact (title, dates, location,
// metric) must appear in the SOURCE text of ITS OWN role's section — not merely
// somewhere in the CV. A fact that doesn't ground is removed from the
// authoritative field and parked in `master.needs_confirmation`: never silently
// kept (so nothing fabricated is asserted) and never silently destroyed (the
// original value is preserved for the user to confirm). No AI, no guessing, no
// synonyms. Roles whose company name is nowhere in the CV are pulled out for
// confirmation rather than left to stand as invented jobs.
function groundAtomicFactsPerRole(master, sourceText) {
  if (!master || !Array.isArray(master.experience) || !master.experience.length) return master;

  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const hay = norm(sourceText);
  if (!hay) return master;

  const flag = (entry) => {
    if (!Array.isArray(master.needs_confirmation)) master.needs_confirmation = [];
    master.needs_confirmation.push(entry);
  };

  // 1. Anchor each role to a position in the source by its company name, walking
  //    successive occurrences in master order so two stints at one employer map
  //    to two different blocks.
  const cursorByCompany = new Map();
  const anchored = [];
  const kept = [];
  for (const role of master.experience) {
    const company = norm(role.company);
    if (!company) {
      // No company to anchor on — keep the role but surface it; we can't verify it.
      flag({ kind: 'role', company: role.company || '', role: role.role || '', reason: 'no_company_to_verify' });
      kept.push(role);
      continue;
    }
    const from = cursorByCompany.get(company) || 0;
    let pos = hay.indexOf(company, from);
    if (pos === -1 && from > 0) pos = hay.indexOf(company); // reuse first occurrence if exhausted
    if (pos === -1) {
      // Company appears NOWHERE in the CV → invented job. Pull it for confirmation.
      flag({ kind: 'role', company: role.company || '', role: role.role || '', reason: 'company_not_in_source' });
      continue;
    }
    cursorByCompany.set(company, pos + company.length);
    anchored.push({ role, pos });
    kept.push(role);
  }

  // 2. Block boundaries: each anchored role owns the source text from its company
  //    up to the next anchored role's company.
  const sorted = [...anchored].sort((a, b) => a.pos - b.pos);
  const blockOf = new Map();
  for (let i = 0; i < sorted.length; i++) {
    const end = i + 1 < sorted.length ? sorted[i + 1].pos : hay.length;
    blockOf.set(sorted[i].role, hay.slice(sorted[i].pos, end));
  }

  // 3. Ground each fact against its OWN block only. Ungrounded → blank + park.
  for (const { role } of anchored) {
    const block = blockOf.get(role) || '';
    // Snapshot the role's identity BEFORE any blanking, so every flag for this
    // role still names it even after its own title has been stripped.
    const label = { company: role.company || '', role: role.role || '' };
    const checkField = (field) => {
      const val = norm(role[field]);
      if (val && !block.includes(val)) {
        flag({ kind: 'field', ...label, field, value: role[field] });
        role[field] = '';
      }
    };
    checkField('role');
    checkField('location');

    // dates: every 4-digit year in the value must appear in this role's block.
    if (role.dates) {
      const years = String(role.dates).match(/\d{4}/g) || [];
      if (years.length && years.some((y) => !block.includes(y))) {
        flag({ kind: 'field', ...label, field: 'dates', value: role.dates });
        role.dates = '';
      }
    }

    // metric: each achievement's quantified result must appear in this block.
    for (const a of role.achievements || []) {
      const m = norm(a.metric);
      if (m && !block.includes(m)) {
        flag({ kind: 'field', ...label, field: 'metric', value: a.metric });
        a.metric = '';
      }
    }
  }

  // 4. Keep original order; the invented (company_not_in_source) roles are gone.
  master.experience = kept;
  return master;
}

// Targeted verify pass — see buildMasterVerifyPrompt. Mutates+returns the master
// with corrections applied; returns the verify call's usage (null if it failed,
// which is non-fatal — the unverified master is still usable).
export async function verifyMaster(master, sourceText, trustedMaster = null) {
  try {
    pruneVoiceSamples(master, sourceText, trustedMaster);
    // Deterministic per-role grounding runs FIRST and is authoritative; the AI
    // pass below is only a secondary net over the prose it can't ground.
    groundAtomicFactsPerRole(master, sourceText);
    const messages = buildMasterVerifyPrompt({ master, sourceText, trustedMaster });
    const data = await callGemini(GEMINI_VERIFY_MODEL, messages, { reasoning_effort: 'low' });
    const gemini_usage = geminiUsage('master-cv verify', data, GEMINI_VERIFY_MODEL);
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
    lastData = await callGemini(GEMINI_MASTER_MODEL, messages, { reasoning_effort: 'low' });
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
  const { gemini_usage: verifyUsage } = await verifyMaster(output, rawInput, existingMaster);

  const usages = [...attemptUsages, verifyUsage].filter(Boolean);
  return { output, usage: lastData.usage, gemini_usage, usages };
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

// `teaser` (optional): the parsed teaser object (or its JSON string) already
// produced for this CV. When supplied, the full pass is handed those findings and
// generates ONLY the deep delta, which we merge here — so the second call writes
// roughly half as much. With no teaser, the full schema is generated as before.
export async function analyzeCvJob(cvText, jobText, fileName = 'unknown.pdf', teaser = null) {
  // DO NOT REMOVE THIS LINE OR MOVE IT
  const hasJobText = typeof jobText === 'string' && jobText.trim().length > 20;

  const teaserObj = typeof teaser === 'string' ? JSON.parse(teaser) : teaser;

  const messages = buildAnalysisPrompt(cvText, jobText, hasJobText, teaserObj);

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
    const parsed = JSON.parse(jsonOutput);
    // When a teaser seeded this call, the model returned only the delta — glue
    // the carried teaser fields back on so callers get one complete analysis.
    const finalObj = teaserObj ? mergeTeaserAndDelta(teaserObj, parsed) : parsed;
    const finalOutput = teaserObj ? JSON.stringify(finalObj) : jsonOutput;
    trackDailySpend(gemini_usage.costUsd);
    return { choices: data.choices, output: finalOutput, usage: data.usage, gemini_usage };
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
