// netlify/functions/analyse-background.mjs
//
// Background analysis worker. The *-background suffix gives Netlify the 15-min
// budget (free tier) instead of the 10s sync limit that was timing analysis out.
//
// Called DIRECTLY by the browser (relative URL) — no server-to-server hop — so
// it can't fail on a bad NEXT_PUBLIC_SITE_URL. It returns 202 immediately and
// ALWAYS writes either the analysis or an error sentinel to gen_data, so the
// client poll never hangs on silence.

import { analyzeCvJob } from '../../utils/openai.js';
import { saveGeneratedDoc, logAiTransaction, supabase } from '../../utils/database.js';

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
    console.error('[analyse-bg] could not save error sentinel:', e.message);
  }
}

export const handler = async (event) => {
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400 };
  }

  const { user_id, jobText, created_at, file_name, analysis_id } = body;
  if (!user_id || !analysis_id) {
    console.error('[analyse-bg] missing user_id or analysis_id');
    return { statusCode: 400 };
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
    let toSave = content;
    try {
      const obj = JSON.parse(content);
      obj._gemini_usage = result.gemini_usage;
      toSave = JSON.stringify(obj);
    } catch { /* keep raw content if it isn't parseable */ }

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
      content: toSave,
      analysis_id,
    });

    const usage = result?.usage || {};
    await logAiTransaction({
      user_id,
      source_gen_id: analysis_id,
      model: 'gemini-3.5-flash',
      completion_tokens: usage.completion_tokens || 0,
      cache_hit_tokens: usage.prompt_cache_hit_tokens || 0,
      cache_miss_tokens: usage.prompt_cache_miss_tokens || 0,
      detail: { job_title, company },
    });

    return { statusCode: 202 };
  } catch (e) {
    console.error('[analyse-bg] analysis error:', e.response?.data || e.message);
    const msg = e.isRateLimit
      ? 'AI service is busy. Please try again in a moment.'
      : (e.message || 'Analysis failed');
    await saveError(user_id, analysis_id, msg);
    return { statusCode: 202 };
  }
};
