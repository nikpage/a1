// utils/openai.js

import axios from 'axios'
import { KeyManager } from './key-manager.js';
import { buildAnalysisPrompt } from '../prompts/analysis.js';
import { buildCareerProfilePrompt } from '../prompts/career-profile.js';
import { timelineBlock } from './master-timeline.js';
import { buildCvPrompt, buildCvSlotsPrompt, buildHeadlinePrompt } from '../prompts/cv-generator.js';
import { buildSkeleton, skeletonSlots } from '../prompts/cv-skeleton.js';
import { assembleCv } from '../prompts/cv-assemble.js';
import { buildCoverPrompt } from '../prompts/cover-letter.js';
import { buildLetterPickPrompt } from '../prompts/letter-pick.js';
import { assembleCover } from '../prompts/letter-assemble.js';
import { buildJobExtractionPrompt } from '../prompts/job-extraction.js';
import { targetJobBlock } from '../prompts/job-target.js';
import { buildLetterPlanPrompt } from '../prompts/letter-plan.js';
import { buildProsePassPrompt } from '../prompts/prose-pass.js';
import { buildGenerationVerifyPrompt, buildPhraseRepairPrompt } from '../prompts/generation-verify.js';
import { buildVoiceProfilePrompt } from '../prompts/voice-profile.js';
import { buildVoiceRewritePrompt } from '../prompts/voice-check.js';
import { validateCv, validateCoverLetter, validationFeedback, bannedPhraseHits, unsourcedDomainHits, unevidencedKeywordHits, splitProvenKeywords, stripDuplicateSentences, coverShapeFaults, coverBreadthFault } from './cv-validate.js';
import { buildMasterCvPrompt } from '../prompts/master-cv.js';
import { costUsdFor } from './pricing.js';
import { assertAttributed, meterGeminiCall } from './ai-meter.js';
import { logger } from '../lib/logger.js';

const keyManager = new KeyManager();

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

// RETRIEVAL. Not a writing model — it turns a piece of the record, or one of an
// ad's requirements, into a vector so the two can be matched. Owner-authorised
// 2026-08-27 (.claude/gemini-unlock). $0.15/1M input, verified at
// ai.google.dev/gemini-api/docs/pricing; no output tokens, so no output rate.
export const GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001';

// The model returns 3072 dimensions and supports Matryoshka truncation to the
// officially recommended 768 — which is what cv_chunks stores. A truncated
// Matryoshka vector must be RE-NORMALISED before cosine comparison; skipping
// that quietly degrades every similarity score, so normalise() below is not
// optional tidying.
export const EMBEDDING_DIMENSIONS = 768;

function geminiUsage(label, data, modelHint) {
  const usage          = data.usage || {};
  const servedModel    = data.model || modelHint;
  const inputTokens    = usage.prompt_tokens     || 0;
  const outputTokens   = usage.completion_tokens || 0;
  const totalTokens    = usage.total_tokens      || (inputTokens + outputTokens);
  const thinkingTokens = Math.max(0, totalTokens - inputTokens - outputTokens);
  // A model with no rate is REPORTED, never priced off a stand-in. Substituting
  // flash-lite's rates here understated a flash call by 20x and looked normal.
  const costUsd        = costUsdFor({ model: servedModel, inputTokens, outputTokens, thinkingTokens });
  if (costUsd === null) logger.error(`[pricing] no rate recorded for model "${servedModel}" — add it to utils/pricing.js`);
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

// `label` names the step in the cost ledger ('generate CV', 'verify cover', …).
// It is pulled OUT of the options here so it never reaches the request body.
export async function callGemini(model, messages, { label, ...options } = {}) {
  // No context, no call. Every Gemini call is claimed by a user, a surface or a
  // named script before a single token is spent.
  assertAttributed(model);

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
      // METER FIRST, RETURN SECOND. Gemini bills the moment it responds, so the
      // call is recorded before anything that could throw — a parse, a
      // validation retry that gets discarded, a caller that gives up. Everything
      // downstream is free to fail without making the spend invisible.
      await meterGeminiCall(geminiUsage(label || `call ${model}`, response.data, model));

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

// The embeddings endpoint. A SECOND URL, and it lives here for the same reason
// the first one does: utils/openai.js is the only door to Gemini, guarded by
// __tests__/ai-spend-containment.test.js. A retrieval helper that fetched this
// itself would spend money the ledger never sees.
const GEMINI_EMBED_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/embeddings';

// Unit-length, so cosine similarity is a dot product and a Matryoshka-truncated
// vector compares correctly against the others.
function normalise(vec) {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return norm > 0 ? vec.map((v) => v / norm) : vec;
}

/**
 * Embed a batch of strings for retrieval.
 *
 * Same three guarantees as callGemini: no call without an AI cost context, the
 * spend is metered the moment Gemini responds, and keys rotate on 429.
 *
 * @param {string[]} inputs - texts to embed (chunks, or an ad's requirements)
 * @param {object}   opts   - { label } for the cost ledger
 * @returns {Promise<{vectors: number[][], gemini_usage: object}>}
 */
export async function embedTexts(inputs, { label = 'embed' } = {}) {
  const texts = (Array.isArray(inputs) ? inputs : []).map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean);
  // Nothing to embed is not a failure and must not spend: an empty record and an
  // ad with no extracted requirements both land here.
  if (!texts.length) return { vectors: [], gemini_usage: null };

  // No context, no call — identical contract to callGemini.
  assertAttributed(GEMINI_EMBEDDING_MODEL);

  const maxAttempts = Math.max(keyManager.keys.filter((k) => k !== null).length, 6);
  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await axios.post(
        GEMINI_EMBED_URL,
        { model: GEMINI_EMBEDDING_MODEL, input: texts, dimensions: EMBEDDING_DIMENSIONS },
        {
          headers: {
            Authorization: `Bearer ${keyManager.getNextKey()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // METER FIRST, RETURN SECOND — see callGemini.
      const gemini_usage = geminiUsage(label, response.data, GEMINI_EMBEDDING_MODEL);
      await meterGeminiCall(gemini_usage);

      // Returned in request order, but `index` is authoritative: a reordered
      // response would silently attach every chunk's text to another chunk's
      // vector, and no downstream check could see it.
      const rows = Array.isArray(response.data?.data) ? response.data.data : [];
      const vectors = texts.map((_, i) => {
        const row = rows.find((r) => r?.index === i) || rows[i];
        const vec = Array.isArray(row?.embedding) ? row.embedding : null;
        return vec ? normalise(vec) : null;
      });

      return { vectors, gemini_usage };
    } catch (error) {
      lastError = error;
      const status = error.response?.status;

      if (status === 429) {
        logger.warn(`[embedTexts] Key rate-limited (429), trying next key (${attempt + 1}/${maxAttempts})`);
        continue;
      }

      const isTransient = TRANSIENT_STATUSES.has(status) || !error.response;
      const detail = geminiErrorMessage(error);
      if (isTransient && attempt < maxAttempts - 1) {
        const backoff = Math.min(10000, 500 * 2 ** attempt) + Math.floor(Math.random() * 250);
        logger.warn(`[embedTexts] transient ${status || error.code || 'network'}: "${detail}" — retry ${attempt + 1}/${maxAttempts} in ${backoff}ms`);
        await sleep(backoff);
        continue;
      }

      logger.error(`[embedTexts] failed (status ${status || error.code || 'network'}): ${detail}`);
      const surfaced = new Error(`Gemini ${status || ''} ${detail}`.trim());
      surfaced.status = status;
      throw surfaced;
    }
  }

  throw lastError || new Error('Gemini embedding request failed');
}

export async function analyzeJobOnly(jobText) {
  const messages = buildJobExtractionPrompt(jobText);
  const data = await callGemini(GEMINI_EXTRACTION_MODEL, messages, { reasoning_effort: 'low', label: 'extract job' });
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
    lastData = await callGemini(GEMINI_MASTER_MODEL, messages, { reasoning_effort: 'low', temperature: 0, label: `master-cv ${mode}` });
    const gu = geminiUsage(`master-cv ${mode}`, lastData, GEMINI_MASTER_MODEL);
    attemptUsages.push(gu);
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

// ONE PASS: scenario, selection and framing for this job (see prompts/analysis.js).
//
// This used to be a teaser plus two delta calls ('blueprint' and 'review'). The
// review half critiqued a document the app regenerates from the master record
// every run, so nobody could act on it; the teaser existed for landing-page
// visitors who no longer exist. Both are gone (2026-08-16) and the whole schema
// comes back in one call. `teaser` is accepted and ignored so older callers do
// not break.
// THE CAREER PROFILE — the job-agnostic half of the analysis, built ONCE per
// master record and reused by every later application. See
// prompts/career-profile.js for why it exists: none of it changes when the ad
// changes, so re-deriving it per job burned money to print the same red flags.
//
// Keyed by recordFingerprint(master) in the caller: rebuild only on mismatch.
// Every "present" keyword is proven against the record here, deterministically,
// exactly as analyzeCvJob does it — an unproven quote is not evidence.
export async function buildCareerProfile(cvText, master = null) {
  const messages = buildCareerProfilePrompt(cvText, master);
  const data = await callGemini(GEMINI_ANALYSIS_MODEL, messages, { reasoning_effort: 'medium', label: 'career profile' });
  const gemini_usage = geminiUsage('career profile', data, GEMINI_ANALYSIS_MODEL);

  const parsed = JSON.parse(stripJsonFences(data.choices?.[0]?.message?.content || ''));
  const { proven } = splitProvenKeywords(parsed.proven_keywords, cvText);
  parsed.proven_keywords = proven;
  // The timeline is COUNTED IN CODE (utils/master-timeline.js) and stored with
  // the profile, so the per-job pass gets the same authoritative numbers without
  // recomputing anything or re-reading the record for them.
  if (master) parsed.timeline = timelineBlock(master);
  return { profile: parsed, gemini_usage };
}

export async function analyzeCvJob(cvText, jobText, fileName = 'unknown.pdf', teaser = null, careerProfile = null) {
  // DO NOT REMOVE THIS LINE OR MOVE IT
  const hasJobText = typeof jobText === 'string' && jobText.trim().length > 20;

  const messages = buildAnalysisPrompt(cvText, jobText, hasJobText, null, 'blueprint', new Date(), careerProfile);

  const data = await callGemini(GEMINI_ANALYSIS_MODEL, messages, { reasoning_effort: 'medium', label: 'analyze CV+job' });

  const gemini_usage = geminiUsage('analyze CV+job', data, GEMINI_ANALYSIS_MODEL);

  const rawOutputString = data.choices?.[0]?.message?.content || '';
  logger.debug('RAW JSON OUTPUT (first 500 chars):', rawOutputString.substring(0, 500) + (rawOutputString.length > 500 ? '...' : ''));

  const jsonOutput = stripJsonFences(rawOutputString);

  try {
    const parsed = JSON.parse(jsonOutput);
    // The ad's own words ride on the analysis record, attached HERE rather than
    // in the Netlify worker so every caller of this function gets them — the
    // worker, the local harness, and anything added later. The cover letter
    // reads them via prompts/job-target.js (rawAdBlock); the extraction stays
    // the fallback for records saved before this existed.
    if (typeof jobText === 'string' && jobText.trim()) {
      parsed.job_text = jobText.trim().slice(0, 8000);
    }
    // EVERY "PRESENT" KEYWORD MUST BE PROVEN BY THE RECORD, DETERMINISTICALLY.
    //
    // The model quotes the phrase that earns each term; this checks the quote
    // against the master here, at the single point every caller passes through
    // (the worker, scripts/test-generate.mjs, anything added later). A term
    // whose quote the record does not carry is not evidence, so it leaves
    // ats_keywords_present — which bars it from skills_to_highlight — and joins
    // ats_keywords_missing, which is the deny-list checks 24/26 enforce.
    // THE SETTLED HALF IS COPIED ON, NOT ASKED FOR.
    //
    // With a career profile present the prompt no longer requests the arc, the
    // parallel experience, the transferable skills, the base scenario or the
    // proof-quoted keyword inventory — the model would only re-derive what was
    // already decided from this same record. Everything downstream still reads
    // those exact fields (prompts/analysis-brief.js, cv-generator.js,
    // cv-validate.js), so they are restored here, from the profile, before the
    // record leaves this function. The shape a caller receives is identical
    // either way.
    if (parsed?.analysis && careerProfile) {
      const a = parsed.analysis;
      a.career_arc = careerProfile.career_arc || '';
      a.parallel_experience = careerProfile.parallel_experience || '';
      a.transferable_skills = careerProfile.transferable_skills || '';
      const settled = Array.isArray(careerProfile.base_scenario_tags) ? careerProfile.base_scenario_tags : [];
      const jobRelative = Array.isArray(a.scenario_tags) ? a.scenario_tags.filter(Boolean) : [];
      // Base first: it is the read a recruiter makes before the ad exists. The
      // Layer 4 cap of two is applied downstream, as it always was.
      a.scenario_tags = [...new Set([...settled, ...jobRelative])];
      // The model returned TERMS chosen from the proven list; the proof quotes
      // stay in the profile, already checked against the record when it was
      // built. Rejoin them so ats_keywords_present keeps its { term, proof }
      // shape — a term with no match in the proven list is not evidence and is
      // dropped, which is exactly what splitProvenKeywords would have done.
      const provenList = Array.isArray(careerProfile.proven_keywords) ? careerProfile.proven_keywords : [];
      const chosen = Array.isArray(a.keywords_for_this_job) ? a.keywords_for_this_job : [];
      const byTerm = new Map(provenList.map((k) => [String(k?.term || k).toLowerCase(), k]));
      // A chosen term that IS on the settled list keeps that list's checked
      // proof. One that is NOT is a domain the job-agnostic pass never had a
      // reason to name — crypto, fintech, the employer's own field — and it
      // arrives with its own verbatim quote, which splitProvenKeywords checks
      // against the record immediately below. Dropping these was why a record
      // holding three crypto engagements and six blockchain talks produced a
      // ten-term inventory with no domain in it, and a CV for a Bitcoin company
      // with not one crypto skill on it.
      const picked = chosen
        .map((t) => {
          const term = String(t?.term || t);
          const settledMatch = byTerm.get(term.toLowerCase());
          if (settledMatch) return settledMatch;
          const proof = typeof t?.proof === 'string' ? t.proof.trim() : '';
          return proof ? { term, proof } : null;
        })
        .filter(Boolean);
      // No ad, or the model picked nothing: the whole proven inventory stands.
      a.ats_keywords_present = picked.length ? picked : provenList;
      delete a.keywords_for_this_job;
    }
    if (parsed?.analysis) {
      const { proven, unproven } = splitProvenKeywords(parsed.analysis.ats_keywords_present, cvText);
      parsed.analysis.ats_keywords_present = proven;
      // With no job ad there is no target, so ats_keywords_missing stays empty
      // (prompts/analysis.js); the term is simply dropped.
      if (unproven.length && hasJobText) {
        const missing = parsed.analysis.ats_keywords_missing;
        const list = Array.isArray(missing)
          ? missing
          : String(missing || '').split(/[,;\n]/).map((t) => t.trim()).filter((t) => t && t.toLowerCase() !== 'n/a');
        parsed.analysis.ats_keywords_missing = [...list, ...unproven];
      }
    }
    return {
      choices: data.choices,
      output: JSON.stringify(parsed),
      usage: data.usage,
      gemini_usage,
      gemini_usages: [gemini_usage],
    };
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
    const data = await callGemini(GEMINI_VERIFY_MODEL, messages, { reasoning_effort: 'low', label: `verify ${docType}` });
    const gemini_usage = geminiUsage(`verify ${docType}`, data, GEMINI_VERIFY_MODEL);
    const parsed = JSON.parse(stripJsonFences(data.choices?.[0]?.message?.content || '{}'));
    const { content, applied } = applyGenerationCorrections(document, parsed.unsupported);
    if (applied.length) {
      logger.info(`[verify ${docType}] ${applied.length} unsupported claim(s) corrected:`, applied.map((a) => a.reason).join('; '));
    }
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
  // THE BLOCKLIST IS A FLOOR, NOT THE CHECK. It can only hold phrases somebody
  // already read and wrote down, so a writing model simply produces the next
  // one — the Sudolabs letter (2026-08-19) was consultant-speak end to end and
  // hit the list nowhere. On the LETTER the repair therefore runs every time,
  // with the listed hits when there are any and on shape alone when there are
  // none. On the CV it stays hit-driven: a bullet is a fact or it is not, and
  // the abstraction shape this looks for is a prose defect.
  // HIT-DRIVEN, both documents. The always-on 'stock' variant hunted the SHAPE of
  // a sentence rather than a listed phrase, which is a second model rewriting the
  // first model's letter — the defect the writer-owns-the-voice change settled.
  // A flat or abstract letter is a WRITING-PROMPT problem.
  const kind = 'phrase';
  if (!hits.length) return { content: document, gemini_usage: null, applied: [] };

  try {
    const messages = buildPhraseRepairPrompt({ docType, document, hits, kind });
    const data = await callGemini(GEMINI_VERIFY_MODEL, messages, { reasoning_effort: 'low', label: `repair phrases ${docType}` });
    const gemini_usage = geminiUsage(`repair phrases ${docType}`, data, GEMINI_VERIFY_MODEL);
    const parsed = JSON.parse(stripJsonFences(data.choices?.[0]?.message?.content || '{}'));
    const { content, applied } = applyGenerationCorrections(document, parsed.unsupported);

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
    const data = await callGemini(GEMINI_VERIFY_MODEL, messages, { reasoning_effort: 'low', label: 'repair unsourced domain' });
    const gemini_usage = geminiUsage('repair unsourced domain', data, GEMINI_VERIFY_MODEL);
    const parsed = JSON.parse(stripJsonFences(data.choices?.[0]?.message?.content || '{}'));
    const { content, applied } = applyGenerationCorrections(document, parsed.unsupported);

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

// A requirement the record cannot answer, asserted anyway (Layer 6, check 24).
//
// The terms come from `analysis.ats_keywords_missing`, which the analysis
// already computes and shows the candidate — so this repair is driven by a list
// the pipeline produced, not by a model's opinion. Like the domain repair it
// does not warn: the app wrote the claim, so the app removes it before delivery.
export async function repairUnevidencedRequirements({ document, master = '', analysis = null }) {
  const hits = unevidencedKeywordHits(document, { master, analysis });
  if (!hits.length) return { content: document, gemini_usage: null, applied: [] };

  try {
    const messages = buildPhraseRepairPrompt({ docType: 'cover', document, hits, kind: 'requirement' });
    const data = await callGemini(GEMINI_VERIFY_MODEL, messages, { reasoning_effort: 'low', label: 'repair unevidenced requirement' });
    const gemini_usage = geminiUsage('repair unevidenced requirement', data, GEMINI_VERIFY_MODEL);
    const parsed = JSON.parse(stripJsonFences(data.choices?.[0]?.message?.content || '{}'));
    const { content, applied } = applyGenerationCorrections(document, parsed.unsupported);

    const left = unevidencedKeywordHits(content, { master, analysis });
    if (left.length) {
      // Not necessarily a failure: the repair is told to leave a term the
      // letter only DISCLAIMS ("not the classic B2B salesperson"), which is a
      // mention the deterministic check cannot tell from a claim.
      logger.info(`[repair requirement cover] left in place (claim or disclaimer): ${left.join(', ')}`);
    } else {
      logger.info(`[repair requirement cover] ${applied.length} unevidenced requirement(s) removed`);
    }
    return { content, gemini_usage, applied };
  } catch (e) {
    logger.error('unevidenced-requirement repair failed (keeping document):', e.message);
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
  const data = await callGemini(GEMINI_ANALYSIS_MODEL, messages, { reasoning_effort: 'medium', label: 'voice profile' });
  const gemini_usage = geminiUsage('voice profile', data, GEMINI_ANALYSIS_MODEL);

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
    const data = await callGemini(GEMINI_GENERATION_MODEL, messages, { reasoning_effort: 'medium', temperature: 0.9, label: `voice rewrite ${docType}` });
    const gemini_usage = geminiUsage(`voice rewrite ${docType}`, data, GEMINI_GENERATION_MODEL);
    usages.push(gemini_usage);
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

// The model's JSON, out of whatever wrapping it arrived in. A writing model
// fences its JSON about as often as not; anything outside the outermost braces
// is packaging, never content.
function parseSlotJson(raw) {
  const text = String(raw || '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

// The record as an object, or null. getGenerationSource() hands generation the
// master as PROSE, so a caller that wants the skeleton must pass the structured
// master itself — a parse of the prose returns null, which is exactly how two
// runs on 2026-08-25 judged a skeleton that was never in the prompt.
function structuredMaster(master) {
  if (master && typeof master === 'object' && Array.isArray(master.work_experience)) return master;
  return null;
}

// A slot answer that wrote something. An empty bullets map is well-formed JSON
// and assembles into a CV of headings with nothing beneath them.
function hasBullets(content) {
  const map = content?.bullets;
  if (!map || typeof map !== 'object') return false;
  return Object.values(map).some((v) => Array.isArray(v) && v.some((b) => String(b || '').trim()));
}

const OLDER_APPLICANT = 'older applicant';
function isOlderApplicant(analysis) {
  const tags = analysis?.analysis?.scenario_tags;
  const listed = Array.isArray(tags) ? tags : tags ? [tags] : [];
  return listed.some((t) => String(t).trim().toLowerCase() === OLDER_APPLICANT);
}

// ─────────────────────────────────────────────────────────────────────────────
// THE ASSEMBLED CV.
//
// The model is never shown a document shape. It answers a list of slots built
// from the record — which entries exist, in what order, under which parent, with
// which dates — and the markdown is written by prompts/cv-assemble.js. Three
// rounds on 2026-08-25 proved the alternative: stated as rules, written out
// verbatim in the prompt, and written out verbatim in a minimal prompt, the
// writer dissolved every client engagement into its parent's bullets each time.
//
// Layers 1-5 are therefore structure that code guarantees rather than asks for.
// Layer 6 still runs unchanged: what it now catches is the CONTENT — a number
// with no source, an unevidenced claim — because the shape can no longer be wrong.
async function generateCvAssembled({ cv, master, analysis, tone, tweak, core, language, retrieved = null }) {
  const now = new Date();
  // The Earlier Career roster is the analysis's pick, not the writer's and not
  // recency's (CV_RULES.md Layer 1) — Layer 6 check 11 fails a document that
  // drops a rostered employer.
  const roster = analysis?.generation_framework?.cv_blueprint?.job_selection?.earlier_career;
  const skeleton = buildSkeleton(master, { now, roster });
  const slots = skeletonSlots(skeleton);
  const olderApplicant = isOlderApplicant(analysis);

  const messages = buildCvSlotsPrompt(cv, analysis, tone, tweak, core, language, now, slots, retrieved);
  const data = await callGemini(GEMINI_GENERATION_MODEL, messages, { reasoning_effort: 'medium', temperature: 0.55, label: 'generate CV' });
  const gemini_usage = geminiUsage('generate CV', data, GEMINI_GENERATION_MODEL);
  const usages = [gemini_usage];

  const content = parseSlotJson(data.choices?.[0]?.message?.content);
  if (!content) {
    // Unparseable JSON is not a CV. Rather than spend a second call on the same
    // ask, fall back to the document path, which needs no JSON at all — the user
    // paid a token and must receive a document.
    logger.error('[generate cv] slot JSON did not parse; falling back to the document prompt');
    const fallback = await generateCvDocument({ cv, analysis, tone, tweak, core, language });
    return { ...fallback, gemini_usages: [...usages, ...(fallback.gemini_usages || [])] };
  }

  // On 'auto' the writer resolves the language from the record, so the headings
  // code puts around its content must follow the SAME resolution — it declares it.
  const resolved = language === 'auto' ? (content.language || 'en') : language;
  const speakingRoster = analysis?.generation_framework?.cv_blueprint?.evidence_from_speaking;
  const assemble = (c) => assembleCv(master, c, skeleton, { language: resolved, olderApplicant, roster: speakingRoster });

  // Safety net over the prose the model did write. The headings, employers and
  // dates around it came from the record, so they are not the checker's problem.
  let verified = await verifyGeneratedDoc({ document: assemble(content), master: cv, docType: 'cv', language: resolved });
  if (verified.gemini_usage) usages.push(verified.gemini_usage);

  const repair = await repairStockPhrases({ document: verified.content, docType: 'cv', language: resolved });
  if (repair.gemini_usage) usages.push(repair.gemini_usage);
  verified = { ...verified, content: repair.content };

  let validation = validateCv(verified.content, { master: cv, analysis, language: resolved });
  if (!validation.ok) {
    logger.info(`[validate cv] hard failures, regenerating once: ${validation.hard.join(' | ')}`);
    const retryMessages = [...messages, { role: 'user', content: validationFeedback(validation.hard) }];
    const retry = await callGemini(GEMINI_GENERATION_MODEL, retryMessages, { reasoning_effort: 'medium', temperature: 0.55, label: 'generate CV (validation retry)' });
    usages.push(geminiUsage('generate CV (validation retry)', retry, GEMINI_GENERATION_MODEL));

    const retryContent = parseSlotJson(retry.choices?.[0]?.message?.content);
    // A retry that returned nothing usable leaves the draft standing; it is a
    // real document with known failures, which beats no document at all.
    //
    // "Usable" means it actually wrote bullets. Well-formed JSON carrying an
    // empty bullets map assembles into headings with nothing under them, and an
    // empty document trips FEWER hard checks than a full one — so without this
    // guard the emptier document wins the comparison and ships.
    if (retryContent && hasBullets(retryContent)) {
      const reVerified = await verifyGeneratedDoc({ document: assemble(retryContent), master: cv, docType: 'cv', language: resolved });
      if (reVerified.gemini_usage) usages.push(reVerified.gemini_usage);
      const reRepair = await repairStockPhrases({ document: reVerified.content, docType: 'cv', language: resolved });
      if (reRepair.gemini_usage) usages.push(reRepair.gemini_usage);

      const revalidated = validateCv(reRepair.content, { master: cv, analysis, language: resolved });
      if (revalidated.hard.length <= validation.hard.length) {
        verified = { ...reVerified, content: reRepair.content };
        validation = revalidated;
      }
    }
    if (!validation.ok) logger.error(`[validate cv] hard failures survived the retry: ${validation.hard.join(' | ')}`);
  }

  return {
    content: verified.content,
    usage: data.usage,
    gemini_usage,
    validation,
    gemini_usages: usages,
  };
}

/**
 * The CV.
 *
 * With a structured master the document is ASSEMBLED IN CODE
 * (generateCvAssembled): the model returns content per slot and
 * prompts/cv-assemble.js writes the markdown. Without one — an older account, a
 * failed master build — the model is asked for the whole document as before.
 * Both paths run the same verify → repair → validate → one-retry chain.
 */
export async function generateCV({ cv, master = null, analysis, tone, tweak = '', core = '', language = 'auto', retrieved = null }) {
  const record = structuredMaster(master);
  if (record) return generateCvAssembled({ cv, master: record, analysis, tone, tweak, core, language, retrieved });
  return generateCvDocument({ cv, analysis, tone, tweak, core, language, retrieved });
}

async function generateCvDocument({ cv, analysis, tone, tweak = '', core = '', language = 'auto', retrieved = null }) {

  const messages = buildCvPrompt(cv, analysis, tone, tweak, core, language, new Date(), retrieved);
  // medium effort: 'low' is exactly where a writing model drops the constraints
  // that keep it honest (don't upgrade the verb, don't invent a number); the
  // low temperature holds it to the record's own wording rather than a
  // more-impressive paraphrase of it.
  const data = await callGemini(GEMINI_GENERATION_MODEL, messages, { reasoning_effort: 'medium', temperature: 0.4, label: 'generate CV' });
  const gemini_usage = geminiUsage('generate CV', data, GEMINI_GENERATION_MODEL);
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
    const retry = await callGemini(GEMINI_GENERATION_MODEL, retryMessages, { reasoning_effort: 'medium', temperature: 0.4, label: 'generate CV (validation retry)' });
    const retryUsage = geminiUsage('generate CV (validation retry)', retry, GEMINI_GENERATION_MODEL);
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
  const data = await callGemini(GEMINI_GENERATION_MODEL, messages, { reasoning_effort: 'low', temperature: 0.6, label: 'generate headline' });
  const gemini_usage = geminiUsage('generate headline', data, GEMINI_GENERATION_MODEL);

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

  // The letter now opens with a CONTACT HEADER (CV_RULES.md, "The letter's
  // standing shape"), so the model's date line is no longer the first line —
  // it sits below the header, and stripping only the LEADING ones left it on
  // the page with the real date prepended above the header. Any date-only line
  // above the salutation is the model's; there is exactly one date on a letter
  // and this function owns it.
  const salutationAt = lines.findIndex((l) => /^\s*(dear\b|vážen|vazen|szanown)/i.test(l));
  const headerEnd = salutationAt === -1 ? lines.length : salutationAt;
  lines = lines.filter((line, i) => !(i < headerEnd && leadingDateRegex.test(line.trim())));

  // remove placeholders anywhere
  lines = lines.filter(line => !line.includes('[Company Address]') && !line.includes('[Date]'));

  // drop empty lines the date removal left at the top
  while (lines.length && lines[0].trim() === '') lines.shift();

  // Rejoin
  let processedContent = lines.join('\n').trim();

  // If cleaning removed everything, fall back to rawContent (trimmed)
  if (!processedContent) {
    processedContent = rawContent.trim();
  }

  // Today's real date, written ONCE, in its conventional place: under the
  // contact header and above the salutation. With no salutation to anchor it
  // (a fragment, a failed generation) it goes back on top.
  const todayString = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const out = processedContent.split('\n');
  const at = out.findIndex((l) => /^\s*(dear\b|vážen|vazen|szanown)/i.test(l));
  if (at === -1) return `${todayString}\n\n${processedContent}`.trim();
  out.splice(at, 0, todayString, '');
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}


// THE LETTER PLAN — structure before prose (prompts/letter-plan.js).
//
// Judgment about what to argue and in what order, so it runs on the ANALYSIS
// model, not a lite checker. It returns SHAPE only; the writer owns every word.
//
// A failed plan degrades to the old behaviour rather than failing the letter:
// letterPlanBlock() renders nothing for a null plan and the writer chooses for
// itself, exactly as it did before this stage existed. A letter is worth more
// than a plan.
export async function planLetter({ analysis, tweak = '' }) {
  const evidence = analysis?.generation_framework?.cover_evidence;
  const pairs = Array.isArray(evidence?.requirement_evidence) ? evidence.requirement_evidence : [];
  // Nothing to rank means nothing to decide — a standalone pass with no ad.
  if (!pairs.length) return { plan: null, gemini_usage: null };
  try {
    const messages = buildLetterPlanPrompt({ analysis, tweak });
    const data = await callGemini(GEMINI_ANALYSIS_MODEL, messages, { reasoning_effort: 'medium', temperature: 0.3, label: 'plan cover letter' });
    const gemini_usage = geminiUsage('plan cover letter', data, GEMINI_ANALYSIS_MODEL);
    const plan = JSON.parse(stripJsonFences(data.choices?.[0]?.message?.content || '{}'));
    const points = Array.isArray(plan?.points) ? plan.points : [];
    if (!points.length) {
      logger.error('[plan cover letter] plan carried no points, writing without it');
      return { plan: null, gemini_usage };
    }
    // Two is the decision. A third point means the planner did not decide, and
    // the writer must not inherit the indecision.
    plan.points = points.slice(0, 2);
    logger.info(`[plan cover letter] ${plan.points.length} point(s): ${plan.points.map((x) => x?.instance).join(' | ')}`);
    return { plan, gemini_usage };
  } catch (e) {
    logger.error('letter plan failed (writing without it):', e.message);
    return { plan: null, gemini_usage: null };
  }
}

// THE COLD READ (prompts/prose-pass.js). The letter ALONE — no ad, no record,
// no plan — judged the way a stranger opening the envelope judges it.
//
// It cannot be impressed by relevance, because it does not know the job. That
// is the whole point: every other check in this repo reads the letter against
// something and therefore grades the match. This one answers the only question
// the reader actually asks — did a person write this, and would I remember them
// tomorrow.
//
// It REPORTS. It never rewrites and it never blocks: a flat letter is a writing
// or a planning problem, and papering it over with a second model's edit is the
// defect this repo removed once already (applyVoice, see CLAUDE.md).
export async function readLetterCold({ document }) {
  try {
    if (!document || !document.trim()) return { read: null, gemini_usage: null };
    const messages = buildProsePassPrompt({ letter: document });
    const data = await callGemini(GEMINI_VERIFY_MODEL, messages, { reasoning_effort: 'low', label: 'cold read cover letter' });
    const gemini_usage = geminiUsage('cold read cover letter', data, GEMINI_VERIFY_MODEL);
    const read = JSON.parse(stripJsonFences(data.choices?.[0]?.message?.content || '{}'));
    return { read, gemini_usage };
  } catch (e) {
    logger.error('cold read failed:', e.message);
    return { read: null, gemini_usage: null };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// THE ASSEMBLED COVER LETTER.
//
// The model no longer writes the letter. It picks which of the candidate's own
// paragraphs answer this ad (prompts/letter-pick.js over prompts/letter-library.js)
// and prompts/letter-assemble.js writes the document. Owner decision,
// 2026-08-25, after five weeks of trying to make a model write at his standard;
// the runs are in COVER_LETTER_LOG.md.
//
// What still runs, and what deliberately does not:
//   - The TRUTH pass runs on the OPENING ONLY, and only when the model wrote
//     one. His paragraphs are his own true words; a checker cutting spans out of
//     them would damage the exact prose that makes the letter good.
//   - validateCoverLetter REPORTS and never gates. Its word band is 150-250 and
//     his own hand-written Sudolabs letter is 380 words — gating on it would
//     reject the document this path exists to reproduce. There is nothing to
//     regenerate anyway: the body is fixed prose, so a retry would return the
//     same paragraphs.
async function generateCoverAssembled({ cv, master, analysis, tweak, language, retrieved = null }) {
  const messages = buildLetterPickPrompt({ analysis, master: cv, tweak, retrieved });
  const data = await callGemini(GEMINI_GENERATION_MODEL, messages, { reasoning_effort: 'medium', temperature: 0.55, label: 'pick cover letter' });
  const gemini_usage = geminiUsage('pick cover letter', data, GEMINI_GENERATION_MODEL);
  const usages = [gemini_usage];

  let picked = null;
  try {
    picked = JSON.parse(stripJsonFences(data.choices?.[0]?.message?.content || ''));
  } catch (e) {
    logger.error('[pick cover] JSON did not parse:', e.message);
  }

  // Nothing usable came back. The candidate spent a free write and must receive
  // a letter, so fall back to the writing path rather than returning nothing.
  if (!picked || !Array.isArray(picked.instances) || !picked.instances.length) {
    logger.error('[pick cover] no instances chosen; falling back to the writing prompt');
    const fallback = await generateCoverDocument({ cv, analysis, tone: 'Formal', tweak, core: '', language, voiceProfile: null, retrieved });
    return { ...fallback, gemini_usages: [...usages, ...(fallback.gemini_usages || [])] };
  }

  // The library is written in English, so 'auto' resolves there — unlike the CV,
  // whose language follows the record.
  const resolved = language === 'auto' ? 'en' : language;

  // The one paragraph a model wrote is the one paragraph that can be untrue.
  if (picked.opening === 'custom' && String(picked.opening_text || '').trim()) {
    const verified = await verifyGeneratedDoc({
      document: String(picked.opening_text).trim(),
      master: cv,
      docType: 'cover',
      language: resolved,
    });
    if (verified.gemini_usage) usages.push(verified.gemini_usage);
    // A correction that deletes the whole opening leaves its sentence
    // terminator behind (applyGenerationCorrections keeps one so it cannot weld
    // two sentences together). On a one-paragraph document that debris is the
    // entire paragraph, and a letter must never open on a lone full stop — drop
    // it and let the letter open on the first instance instead.
    const opening = /[\p{L}\p{N}]/u.test(verified.content) ? verified.content : '';
    picked = { ...picked, opening_text: opening };
  }

  const content = assembleCover(master, picked, { language: resolved });
  const validation = validateCoverLetter(content, { master: cv, analysis, language: resolved, tweak });
  if (!validation.ok) logger.info(`[validate cover] reported, not gated: ${validation.hard.join(' | ')}`);

  return {
    content,
    usage: data.usage,
    gemini_usage,
    // Hard failures ride out as warnings: this path does not regenerate, and the
    // candidate should see what the checks said rather than have it swallowed.
    validation: { ...validation, ok: true, warnings: [...(validation.warnings || []), ...(validation.hard || [])] },
    gemini_usages: usages,
  };
}

/**
 * The cover letter.
 *
 * With a structured master the letter is ASSEMBLED from the candidate's own
 * paragraphs (generateCoverAssembled). Without one — an older account, a failed
 * master build — the model writes it as before.
 */
export async function generateCoverLetter({ cv, master = null, analysis, tone, tweak = '', core = '', language = 'auto', voiceProfile = null, retrieved = null }) {
  const record = structuredMaster(master);
  if (record) return generateCoverAssembled({ cv, master: record, analysis, tweak, language, retrieved });
  return generateCoverDocument({ cv, analysis, tone, tweak, core, language, voiceProfile, retrieved });
}

async function generateCoverDocument({ cv, analysis, tone, tweak = '', core = '', language = 'auto', voiceProfile = null, retrieved = null }) {
  // NO PLAN CALL. Owner order, 2026-08-24: the letter costs 2 cents or less.
  // planLetter() ran on the analysis model and cost 2.9-3.5 cents on its own —
  // more than the letter it planned — so the stage is off this path. What it
  // bought (the carrying instance told as a sequence rather than a catalogue)
  // is now stated to the writer directly in prompts/cover-letter.js, which
  // reads the same record the plan read. planLetter() is still exported and
  // still tested; nothing on the live path calls it.
  const planned = { plan: null, gemini_usage: null };
  const messages = buildCoverPrompt(cv, analysis, tone, tweak, core, language, new Date(), voiceProfile, planned.plan, retrieved);
  // See generateCV: medium effort + low temperature keep the letter tied to the
  // record instead of drifting into a better-sounding version of it.
  // The LETTER runs hotter than the CV. A CV is a record and 0.4 keeps it tied to
  // one; a letter at 0.4 converges on the same four safe paragraphs for everyone,
  // which is the flatness the voice pass then has to undo. Facts are protected by
  // the verify pass that follows, not by a cold sampler.
  const data = await callGemini(GEMINI_GENERATION_MODEL, messages, { reasoning_effort: 'low', temperature: 0.55, label: 'generate cover letter' });

  const gemini_usage = geminiUsage('generate cover letter', data, GEMINI_GENERATION_MODEL);
  const usages = [];
  if (planned.gemini_usage) usages.push(planned.gemini_usage);
  usages.push(gemini_usage);

  const processedContent = dressLetter(data.choices?.[0]?.message?.content || '');


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

  // NO PROSE REPAIR PASSES ON THE LETTER. Removed 2026-08-24 on the owner's
  // order, after three consecutive letters off this path were read: the
  // Sudolabs one ended with no ask and no CV line at all, because the close had
  // been cut by span surgery downstream of the writer. repairStockPhrases /
  // repairUnsourcedDomains / repairUnevidencedRequirements are three more
  // models re-cutting the one writer's sentences — the applyVoice defect
  // rebuilt under other names. The letter the writer produced is the letter
  // that ships.
  //
  // The TRUTH pass above STAYS: nothing untrue ships (PRODUCT.md section 3).
  // The removed checks still RUN as reports inside validateCoverLetter below,
  // so a stock phrase is shown to the candidate instead of silently excised.
  usages.push(...(voiced.gemini_usages || []));
  if (verified.gemini_usage) usages.push(verified.gemini_usage);

  // Check 25: the same sentence printed twice. Deterministic, no AI call.
  let content = stripDuplicateSentences(verified.content);
  let validation = validateCoverLetter(content, { master: cv, analysis, language, tweak });

  // The word band is a hard failure, so an over-length letter is regenerated
  // ONCE with the count fed back — the same shape as generateCV's retry, and the
  // retry is kept only if it did not make things worse.
  //
  // SHAPE IS NOT IN THIS TRIGGER. Feeding a rhythm measurement back to the
  // writer made it perform the measurement: the Sudolabs letter (2026-08-19)
  // answered "one sentence of seven words or fewer" with a five-word orphan
  // paragraph, exactly as the removed voice rewrite had. coverShapeFaults /
  // coverBreadthFault survive as Layer 6 measurements only.
  if (!validation.ok) {
    const reasons = validation.hard;
    logger.info(`[validate cover] regenerating once: ${reasons.join(' | ')}`);
    const retryMessages = [...messages, { role: 'user', content: validationFeedback(reasons, 'cover') }];
    const retry = await callGemini(GEMINI_GENERATION_MODEL, retryMessages, { reasoning_effort: 'medium', temperature: 0.4, label: 'generate cover letter (validation retry)' });
    const retryUsage = geminiUsage('generate cover letter (validation retry)', retry, GEMINI_GENERATION_MODEL);
    usages.push(retryUsage);

    const reVerified = await verifyGeneratedDoc({
      document: dressLetter(retry.choices?.[0]?.message?.content || ''),
      master: cv,
      docType: 'cover',
      language,
    });
    if (reVerified.gemini_usage) usages.push(reVerified.gemini_usage);

    // Same rule as the first pass: no prose repair after the writer.
    const retryContent = stripDuplicateSentences(reVerified.content);
    const revalidated = validateCoverLetter(retryContent, { master: cv, analysis, language, tweak });
    // No worse than the draft it replaces, or the draft stands.
    if (revalidated.hard.length <= validation.hard.length) {
      content = retryContent;
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
    plan: planned.plan || null,
    voice_fixes: voiced.applied || [],
  };
}
