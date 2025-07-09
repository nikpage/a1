// pages/api/analyze-cv-job.js
import { getCvData, saveGeneratedDoc } from '../../utils/database'
import { analyzeCvJob } from '../../utils/openai'
import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { user_id, jobText, created_at } = req.body
  const fileName = req.body.file_name || 'Unnamed file'

  if (!user_id) {
    return res.status(400).json({ error: 'Missing user_id in request body' })
  }

  try {
    const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

let query = supabase
  .from('cv_data')
  .select('cv_data')
  .eq('user_id', user_id);

if (created_at) {
  query = query.eq('created_at', created_at);
}

const { data, error } = await query.single();


if (error || !data) {
  return res.status(404).json({ error: 'CV not found for given timestamp' })
}

const cv_data = data.cv_data

    if (!cv_data) {
      return res.status(404).json({ error: 'CV not found for user' })
    }

    const result = await analyzeCvJob(cv_data, jobText, fileName)

    const content =
      result?.choices?.[0]?.message?.content ||
      result?.output ||
      null

    const extractMeta = (label) => {
      const match = content.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`));
      return match ? match[1].trim() : null;
    };

    const company = extractMeta('Company Name');
    const job_title = extractMeta('Position/Title');
    const hr_contact = extractMeta('HR Contact');

    if (!content) {
      return res.status(500).json({ error: 'No analysis content returned by DeepSeek', raw: result })
    }

    const analysis_id = crypto.randomUUID();

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
      hr_contact
    });

    return res.status(200).json({ analysis: content, analysis_id });

  } catch (e) {
    return res.status(500).json({ error: 'Analysis failed', details: e.message || 'unknown' })
  }
}
