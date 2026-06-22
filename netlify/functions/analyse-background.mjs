// netlify/functions/analyse-background.mjs
//
// Background analysis worker. The *-background suffix gives Netlify the 15-min
// budget (free tier) instead of the 10s sync limit that was timing analysis out.
//
// Called DIRECTLY by the browser (relative URL) — no server-to-server hop — so
// it can't fail on a bad NEXT_PUBLIC_SITE_URL. It returns 202 immediately and
// ALWAYS writes either the analysis or an error sentinel to gen_data, so the
// client poll never hangs on silence.
//
// When the body carries `confirmedJob` (the user-confirmed extraction from the
// modal), it is serialised to a clean labelled text block and fed as jobText to
// analyzeCvJob. After the analysis returns, `job_extraction` in the saved doc is
// overridden with the confirmed values so edits survive into generation.

import * as Sentry from '@sentry/node';
import { analyzeCvJob } from '../../utils/openai.js';
import { saveGeneratedDoc, logAiTransaction, setCandidateCoreIfEmpty, supabase } from '../../utils/database.js';
import { verifyToken } from '../../lib/auth.js';
import { logger } from '../../lib/logger.js';

function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key.trim() === name) return rest.join('=').trim();
  }
  return null;
}

async function saveError(user_id, analysis_id, message) {
  try {
    await saveGeneratedDoc({
      user_id,
      source_cv_id: user_id,
      type: 'analysis',
      tone: null,
      content: JSON.stringify({ __analysis_error: message }),
      analysis_id,
    });
  } catch (e) {
    logger.error('[analyse-bg] could not save error sentinel:', e.message);
  }
}

function confirmedJobToText(job) {
  const lines = [];
  if (job.position_title) lines.push(`Position: ${job.position_title}`);
  if (job.company) lines.push(`Company: ${job.company}`);
  if (job.hr_contact) lines.push(`HR Contact: ${job.hr_contact}`);
  if (job.location) lines.push(`Location: ${job.location}`);
  if (job.seniority) lines.push(`Seniority: ${job.seniority}`);
  if (job.employment_type) lines.push(`Employment Type: ${job.employment_type}`);
  if (job.salary) lines.push(`Salary: ${job.salary}`);
  if (Array.isArray(job.required_skills) && job.required_skills.length)
    lines.push(`Required Skills: ${job.required_skills.join(', ')}`);
  if (Array.isArray(job.desired_skills) && job.desired_skills.length)
    lines.push(`Desired Skills: ${job.desired_skills.join(', ')}`);
  if (Array.isArray(job.must_have_requirements) && job.must_have_requirements.length)
    lines.push(`Must Have: ${job.must_have_requirements.join('; ')}`);
  if (Array.isArray(job.nice_to_have) && job.nice_to_have.length)
    lines.push(`Nice to Have: ${job.nice_to_have.join('; ')}`);
  if (Array.isArray(job.responsibilities) && job.responsibilities.length)
    lines.push(`Responsibilities: ${job.responsibilities.join('; ')}`);
  if (Array.isArray(job.keywords_for_ats) && job.keywords_for_ats.length)
    lines.push(`Keywords: ${job.keywords_for_ats.join(', ')}`);
  if (Array.isArray(job.language_requirements) && job.language_requirements.length)
    lines.push(`Language Requirements: ${job.language_requirements.join(', ')}`);
  return lines.join('\n');
}

export const handler = async (event) => {
  const cookieHeader = event.headers?.cookie || event.headers?.Cookie || '';
  const token = parseCookie(cookieHeader, 'auth-token');
  const verified = await verifyToken(token);

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400 };
  }

  const { created_at, file_name, analysis_id, confirmedJob } = body;
  let { jobText } = body;

  const user_id = verified?.user_id || body.user_id;
  if (!user_id) return { statusCode: 401 };
  if (!analysis_id) {
    logger.error('[analyse-bg] missing analysis_id');
    return { statusCode: 400 };
  }

  // Use the confirmed job object (serialised to text) as the job input when present.
  // This ensures the analysis runs on the user-corrected data, not the raw ad.
  if (confirmedJob && typeof confirmedJob === 'object') {
    jobText = confirmedJobToText(confirmedJob);
  }

  try {
    let query = supabase.from('cv_data').select('cv_data').eq('user_id', user_id);
    if (created_at) query = query.eq('created_at', created_at);
    const { data, error } = await query.order('created_at', { ascending: false }).limit(1);

    const cv_data = data?.[0]?.cv_data;
    if (error || !cv_data) {
      await saveError(user_id, analysis_id, 'CV not found for analysis');
      return { statusCode: 202 };
    }

    const result = await analyzeCvJob(cv_data, jobText, file_name || 'Unnamed file');
    const content = result?.output;
    if (!content) {
      await saveError(user_id, analysis_id, 'No analysis content returned');
      return { statusCode: 202 };
    }

    const extractMeta = (label) => {
      const m = content.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`));
      return m ? m[1].trim() : null;
    };

    // Embed the usage/cost so the client can log it (the background function
    // returns no body to the browser). Harmless extra key for all consumers.
    // When the user confirmed the job via the modal, override job_extraction with
    // their edited values so they survive into the generation prompts.
    let toSave = content;
    try {
      const obj = JSON.parse(content);
      obj._gemini_usage = result.gemini_usage;
      if (confirmedJob && typeof confirmedJob === 'object') {
        obj.job_extraction = confirmedJob;
      }
      // Seed the user's persistent candidate-core profile from this analysis,
      // but only if they don't have one yet (never overwrite a user edit).
      if (obj.candidate_core) {
        try {
          await setCandidateCoreIfEmpty(user_id, obj.candidate_core);
        } catch (e) {
          logger.error('[analyse-bg] candidate_core seed failed:', e.message);
        }
      }
      toSave = JSON.stringify(obj);
    } catch { /* keep raw content if it isn't parseable */ }

    const company = confirmedJob?.company || extractMeta('Company Name');
    const job_title = confirmedJob?.position_title || extractMeta('Position/Title');

    await saveGeneratedDoc({
      user_id,
      source_cv_id: user_id,
      type: 'analysis',
      tone: null,
      company,
      job_title,
      file_name: null,
      content: toSave,
      analysis_id,
    });

    const gu = result.gemini_usage;
    await logAiTransaction({
      user_id,
      source_gen_id: analysis_id,
      model: gu.model,
      cache_miss_tokens: gu.inputTokens,
      cache_hit_tokens: 0,
      completion_tokens: gu.outputTokens + gu.thinkingTokens,
      thinking_tokens: gu.thinkingTokens,
      detail: { job_title, company },
    });

    return { statusCode: 202 };
  } catch (e) {
    Sentry.captureException(e);
    logger.error('[analyse-bg] analysis error:', e.response?.data || e.message);
    const msg = e.isRateLimit
      ? 'AI service is busy. Please try again in a moment.'
      : (e.message || 'Analysis failed');
    await saveError(user_id, analysis_id, msg);
    return { statusCode: 202 };
  }
};
