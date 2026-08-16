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
import { analyzeCvJob, buildOrMergeMaster } from '../../utils/openai.js';
import { withOlderApplicant } from '../../prompts/scenarios.js';
import { saveGeneratedDoc, getMasterCv, saveMasterCv, supabase } from '../../utils/database.js';
import { runWithAiContext } from '../../utils/ai-meter.js';
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

  // THE AD AS THE EMPLOYER WROTE IT, kept before anything replaces it.
  //
  // The line below hands ANALYSIS the user-corrected job, which is right: the
  // analysis reasons over facts and the user's corrections are the better facts.
  // But it destroys the ad. The COVER LETTER needs the opposite thing — the
  // employer's own sentences and register, which a re-serialised
  // "Position: … Required Skills: …" list does not carry. A real run proved it:
  // an ad for KUBO produced a letter that never named KUBO, because by the time
  // the writer saw the "ad" it was a bullet list. Kept here, ridden through to
  // the saved record as `job_text`, read by prompts/job-target.js.
  const rawAd = typeof jobText === 'string' ? jobText.trim() : '';

  // Use the confirmed job object (serialised to text) as the job input when present.
  // This ensures the analysis runs on the user-corrected data, not the raw ad.
  if (confirmedJob && typeof confirmedJob === 'object') {
    jobText = confirmedJobToText(confirmedJob);
  }

  // Everything below runs inside the AI cost context, so every Gemini call it
  // makes — teaser, deep pass, master build, master verify — is attributed and
  // recorded by the meter in callGemini. Nothing here logs cost by hand.
  return runWithAiContext({ user_id, context: 'analyse-background', source_gen_id: analysis_id, detail: { job_title: confirmedJob?.position_title || null, company: confirmedJob?.company || null } }, async () => {
  try {
    let query = supabase.from('cv_data').select('cv_data').eq('user_id', user_id);
    if (created_at) query = query.eq('created_at', created_at);
    const { data, error } = await query.order('created_at', { ascending: false }).limit(1);

    const cv_data = data?.[0]?.cv_data;
    if (error || !cv_data) {
      await saveError(user_id, analysis_id, 'CV not found for analysis');
      return { statusCode: 202 };
    }

    // Ensure the per-user MASTER CV exists. It is the durable source-of-truth the
    // analysis reasons from. Build it once from the raw CV text if absent; reuse it
    // thereafter. The expensive deep pass is amortised over every future match.
    let master = await getMasterCv(user_id).catch(() => null);
    let masterUsages = []; // build + verify usages, surfaced to the browser console alongside the analysis call
    if (!master) {
      try {
        const built = await buildOrMergeMaster(cv_data);
        master = built.output;
        masterUsages = built.usages;
        await saveMasterCv(user_id, master);
        // The build and its verify pass were already recorded by the meter, at
        // the moment each responded — including a build that then failed to
        // parse, which this hand-rolled loop never saw.
      } catch (e) {
        // A master-build failure must not sink the analysis — fall back to raw text.
        // But it must NOT pass silently either: the user was charged for the build,
        // so a master that never lands is a real defect, not noise. Surface it to
        // Sentry so an empty master_cv column is diagnosable instead of mysterious.
        logger.error('[analyse-bg] master-cv build/save failed, using raw CV:', e.message);
        Sentry.captureException(e);
        master = null;
      }
    }

    // THE ANALYSIS READS THE MASTER. One pass, one call.
    //
    // There used to be a landing-page teaser here, reading the RAW uploaded CV
    // for first impressions (page order and salience, which the master's
    // reordered record dissolves), seeding a two-call deep pass built on top of
    // it. That shape served visitors dropping a PDF on the landing page. There
    // are none: this is a personal tool, the master record is the source, and
    // the CV is regenerated from it per job — so a first-impression read of the
    // uploaded file, and the fix-your-old-CV advice built on it, described a
    // document nobody will send. Removed 2026-08-16; the single pass classifies
    // the scenario itself.
    //
    // The layout signal went with it: it only ever drove the teaser's ATS gate.
    const analysisCv = master ? JSON.stringify(master) : cv_data;

    if (!verified?.user_id) {
      await saveError(user_id, analysis_id, 'Analysis requires a verified session');
      return { statusCode: 202 };
    }

    let content;
    const analysisUsages = [];
    try {
      const result = await analyzeCvJob(analysisCv, jobText, file_name || 'cv.pdf');
      content = result?.output;
      analysisUsages.push(...(result?.gemini_usages || [result?.gemini_usage]).filter(Boolean));
    } catch (e) {
      logger.error('[analyse-bg] analysis failed:', e.message);
      Sentry.captureException(e);
      await saveError(user_id, analysis_id, `Analysis failed: ${e.message}`);
      return { statusCode: 202 };
    }

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
      // Surface EVERY Gemini call this run made (master build + verify + teaser +
      // deep) so the browser console matches what the transactions table records.
      obj._gemini_usage = [...masterUsages, ...analysisUsages];
      // The Older Applicant trigger is arithmetic over the master's dates, so the
      // code decides it rather than competing for one of the model's 1-2 tag slots
      // (where a co-occurring senior-portfolio read used to crowd it out and the
      // age mitigations never reached the generator).
      if (master && obj.analysis) {
        obj.analysis.scenario_tags = withOlderApplicant(obj.analysis.scenario_tags, master);
      }
      // analyzeCvJob attached whatever job input it was given as `job_text`,
      // which on this path is the CONFIRMED job serialised back into a list.
      // The letter needs the employer's own words, so the ad kept above wins.
      if (rawAd) obj.job_text = rawAd.slice(0, 8000);
      if (confirmedJob && typeof confirmedJob === 'object') {
        obj.job_extraction = confirmedJob;
      }
      // candidate_core is the USER'S OWN statement of their durable value,
      // written on /account. Nothing here seeds it: an AI-written sentence
      // stored in that field was read downstream as the candidate's own claim,
      // and "a seasoned product leader with over 25 years" — an epithet the CV
      // rules ban, over a figure the record never stated — is what the writer
      // then built on.
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
  });
};
