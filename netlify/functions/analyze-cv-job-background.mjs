// netlify/functions/analyze-cv-job-background.mjs
//
// Long-running CV/job analysis. The *-background suffix tells Netlify to run this
// with the 15-minute background-function budget instead of the 10s synchronous
// limit that was killing Gemini analysis mid-run.
//
// It returns 202 immediately (the platform does that for background functions);
// the result — or an error sentinel — is written to gen_data under the given
// analysis_id, and the client polls /api/get-analysis-status for it.

import { analyzeCvJob } from '../../utils/openai.js';
import { saveGeneratedDoc, supabase } from '../../utils/database.js';

export const handler = async (event) => {
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400 };
  }

  const { user_id, jobText, created_at, file_name, analysis_id } = body;
  if (!user_id || !analysis_id) {
    console.error('[analyze-bg] Missing user_id or analysis_id');
    return { statusCode: 400 };
  }

  try {
    // Fetch the CV the analysis runs against (by user, optionally pinned to a
    // specific upload via created_at).
    let query = supabase.from('cv_data').select('cv_data').eq('user_id', user_id);
    if (created_at) query = query.eq('created_at', created_at);
    const { data, error } = await query.order('created_at', { ascending: false }).limit(1);

    const cv_data = data?.[0]?.cv_data;
    if (error || !cv_data) {
      await saveAnalysisError(user_id, analysis_id, 'CV not found for analysis');
      return { statusCode: 202 };
    }

    const result = await analyzeCvJob(cv_data, jobText, file_name || 'Unnamed file');
    const content = result?.output;
    if (!content) {
      await saveAnalysisError(user_id, analysis_id, 'No analysis content returned');
      return { statusCode: 202 };
    }

    const extractMeta = (label) => {
      const m = content.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`));
      return m ? m[1].trim() : null;
    };
    const company = extractMeta('Company Name');
    const job_title = extractMeta('Position/Title');

    await saveGeneratedDoc({
      user_id,
      source_cv_id: user_id,
      type: 'analysis',
      tone: null,
      company,
      job_title,
      file_name: null,
      content,
      analysis_id,
    });

    // Best-effort transaction log
    const usage = result?.usage || {};
    const baseURL = process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : process.env.NEXT_PUBLIC_SITE_URL;
    try {
      await fetch(`${baseURL}/api/log-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id,
          source_gen_id: analysis_id,
          model: 'gemini-3.5-flash',
          completion_tokens: usage.completion_tokens || 0,
          cache_hit_tokens: usage.prompt_cache_hit_tokens || 0,
          cache_miss_tokens: usage.prompt_cache_miss_tokens || 0,
          job_title,
          company,
        }),
      });
    } catch (logErr) {
      console.error('[analyze-bg] Logging failed:', logErr.message);
    }

    return { statusCode: 202 };
  } catch (e) {
    console.error('[analyze-bg] Analysis error:', e.response?.data || e.message);
    const msg = e.isRateLimit
      ? 'AI service is busy. Please try again in a moment.'
      : (e.message || 'Analysis failed');
    await saveAnalysisError(user_id, analysis_id, msg);
    return { statusCode: 202 };
  }
};

// Persist a sentinel so the poll endpoint can surface the real failure instead
// of letting the client spin until timeout.
async function saveAnalysisError(user_id, analysis_id, message) {
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
    console.error('[analyze-bg] Failed to save error sentinel:', e.message);
  }
}
