// pages/api/analyze-cv-job.js
import { getCvData, saveGeneratedDoc } from '../../utils/database';
import { analyzeCvJob } from '../../utils/openai';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { KeyManager } from '../../utils/key-manager.js';

const keyManager = new KeyManager();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, jobText, created_at } = req.body;
  const fileName = req.body.file_name || 'Unnamed file';

  if (!user_id) {
    return res.status(400).json({ error: 'Missing user_id in request body' });
  }

  const analysis_id = crypto.randomUUID();

  try {
    // Create an initial "processing" record so the client immediately gets an id.
    await saveGeneratedDoc({
      user_id,
      source_cv_id: user_id,
      type: 'analysis',
      tone: null,
      company: null,
      job_title: null,
      file_name: fileName,
      content: 'processing',
      analysis_id,
      hr_contact: null,
    });

    // Immediately return to client so proxies won't time out while we do heavy work.
    res.status(200).json({ analysis_id, status: 'processing' });

    // Background work (detached)
    (async () => {
      try {
        // Fetch cv_data (same logic as original)
        let query = supabase
          .from('cv_data')
          .select('cv_data')
          .eq('user_id', user_id);

        if (created_at) query = query.eq('created_at', created_at);

        const { data, error } = await query.single();

        if (error || !data || !data.cv_data) {
          // Save a final record indicating failure so user can see it in UI.
          await saveGeneratedDoc({
            user_id,
            source_cv_id: user_id,
            type: 'analysis',
            tone: null,
            company: null,
            job_title: null,
            file_name: fileName,
            content: `ERROR: CV not found for given timestamp or CV empty. (${error?.message || 'no data'})`,
            analysis_id,
            hr_contact: null,
          });
          console.error('Background: CV not found or empty', error);
          return;
        }

        const cv_data = data.cv_data;

        // Call the analyzer (this may take time)
        const result = await analyzeCvJob(cv_data, jobText, fileName);

        const content = result?.output || null;

        if (!content) {
          // Save the raw result so it's visible in DB for debugging.
          await saveGeneratedDoc({
            user_id,
            source_cv_id: user_id,
            type: 'analysis',
            tone: null,
            company: null,
            job_title: null,
            file_name: fileName,
            content: `ERROR: No analysis content returned by DeepSeek or analyzer. Raw result: ${JSON.stringify(result)}`,
            analysis_id,
            hr_contact: null,
          });
          console.error('Background: No analysis content returned', result);
        } else {
          const extractMeta = (label) => {
            const match = content.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`));
            return match ? match[1].trim() : null;
          };

          const company = extractMeta('Company Name');
          const job_title = extractMeta('Position/Title');
          const hr_contact = extractMeta('HR Contact');

          await saveGeneratedDoc({
            user_id,
            source_cv_id: user_id,
            type: 'analysis',
            tone: null,
            company,
            job_title,
            file_name: fileName,
            content,
            analysis_id,
            hr_contact,
          });

          const usage = result?.usage || {};

          // Fire-and-forget logging to /api/log-transaction
          try {
            const baseURL = process.env.NODE_ENV === 'development'
              ? 'http://localhost:3000'
              : `https://${process.env.VERCEL_URL}`;

            // Non-blocking fetch
            fetch(`${baseURL}/api/log-transaction`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_id,
                source_gen_id: analysis_id,
                model: 'DS-v3',
                completion_tokens: usage.completion_tokens || 0,
                cache_hit_tokens: usage.prompt_cache_hit_tokens || 0,
                cache_miss_tokens: usage.prompt_cache_miss_tokens || 0,
                job_title,
                company,
                key_index: keyManager.currentKeyIndex
              }),
            }).catch(err => console.error('Background: Logging failed:', err));
          } catch (logErr) {
            console.error('Background: log transaction error', logErr);
          }
        }
      } catch (bgErr) {
        console.error('Background processing error:', bgErr);
        // Save failure into DB so the UI can show there was an error
        try {
          await saveGeneratedDoc({
            user_id,
            source_cv_id: user_id,
            type: 'analysis',
            tone: null,
            company: null,
            job_title: null,
            file_name: fileName,
            content: `ERROR during analysis: ${bgErr.message || JSON.stringify(bgErr)}`,
            analysis_id,
            hr_contact: null,
          });
        } catch (saveErr) {
          console.error('Background: failed to save error result', saveErr);
        }
      }
    })();

    // End of handler — response already sent
    return;
  } catch (e) {
    console.error('API Error (main):', e);
    if (!res.headersSent) {
      return res.status(500).json({ error: e.message });
    }
    // If headers already sent, we can't modify the response; log and exit.
    return;
  }
}
